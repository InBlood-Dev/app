import React, { createContext, useContext, useState, useCallback, useRef, ReactNode, useEffect } from 'react';
import { Chat, Message } from '../types';
import { useAuth } from './AuthContext';
import {
  FirebaseMessage,
  FirebaseLastMessage,
  sendMessageToFirebase,
  subscribeToMessages,
  subscribeToLastMessage,
  markMessagesAsSeen,
  markMessagesAsDelivered,
  setTypingIndicator,
  deleteMessageForMe,
  deleteMessageForEveryone,
  subscribeToTypingIndicator,
  muteConversation,
  unmuteConversation,
  isConversationMuted,
} from '../services/firebase-messaging.service';
import { post } from '../services/api';

interface ChatContextType {
  chats: Map<string, Chat>;
  typingUsers: Set<string>;
  subscribeToConversation: (conversationId: string, otherUserId: string) => void;
  unsubscribeFromConversation: (conversationId: string) => void;
  subscribeToConversationPreviews: (conversationIds: string[]) => void;
  sendMessage: (conversationId: string, message: Omit<Message, 'id' | 'timestamp' | 'status'>) => Promise<void>;
  getMessages: (conversationId: string) => Message[];
  markAsRead: (conversationId: string) => void;
  setTyping: (conversationId: string, isTyping: boolean) => void;
  deleteMessage: (conversationId: string, messageId: string, deleteForEveryone: boolean) => Promise<void>;
  isSubscribed: (conversationId: string) => boolean;
  muteConversation: (conversationId: string, muteUntil?: Date | null) => Promise<void>;
  unmuteConversation: (conversationId: string) => Promise<void>;
  isConversationMuted: (conversationId: string) => Promise<boolean>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

/**
 * Convert Firebase message to app Message type
 */
const convertFirebaseMessage = (firebaseMsg: FirebaseMessage, currentUserId: string): Message => {
  // Check if message is deleted for current user
  const isDeletedForMe =
    (firebaseMsg.sender_id === currentUserId && firebaseMsg.deleted_for_sender) ||
    (firebaseMsg.receiver_id === currentUserId && firebaseMsg.deleted_for_receiver);

  let text = isDeletedForMe ? 'This message was deleted' : firebaseMsg.content;
  let openingMoveQuestion: string | undefined;
  let openingMoveAnswer: string | undefined;

  if (firebaseMsg.message_type === 'opening_move' && !isDeletedForMe) {
    try {
      const parsed = JSON.parse(firebaseMsg.content);
      openingMoveQuestion = parsed.question;
      openingMoveAnswer = parsed.answer;
      text = parsed.answer;
    } catch {
      // Fall back to treating content as plain text
    }
  }

  return {
    id: firebaseMsg.id,
    senderId: firebaseMsg.sender_id,
    text,
    timestamp: new Date(firebaseMsg.sent_at),
    status: firebaseMsg.status || 'sent',
    type: firebaseMsg.message_type || 'text',
    mediaUrl: firebaseMsg.media_url,
    isDeleted: isDeletedForMe,
    openingMoveQuestion,
    openingMoveAnswer,
  };
};

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated, userId } = useAuth();
  const [chats, setChats] = useState<Map<string, Chat>>(new Map());
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  // Track active subscriptions
  const subscriptionsRef = useRef<Map<string, () => void>>(new Map());
  const typingSubscriptionsRef = useRef<Map<string, () => void>>(new Map());
  const previewSubscriptionsRef = useRef<Map<string, () => void>>(new Map());

  // Track otherUserId per conversation (for sendMessage)
  const otherUserIdsRef = useRef<Map<string, string>>(new Map());

  // Track current user ID from AuthContext
  const currentUserIdRef = useRef<string | null>(null);

  // Sync user ID from AuthContext to ref for Firebase operations
  useEffect(() => {
    if (isAuthenticated && userId) {
      currentUserIdRef.current = userId;
      console.log('[ChatContext] User authenticated with ID:', userId);
      console.log('[ChatContext] Ready for Firebase subscriptions');
    } else {
      // Clean up all subscriptions on logout
      console.log('[ChatContext] User logged out, cleaning up subscriptions');
      currentUserIdRef.current = null;
      subscriptionsRef.current.forEach(unsubscribe => unsubscribe());
      subscriptionsRef.current.clear();
      typingSubscriptionsRef.current.forEach(unsubscribe => unsubscribe());
      typingSubscriptionsRef.current.clear();
      previewSubscriptionsRef.current.forEach(unsubscribe => unsubscribe());
      previewSubscriptionsRef.current.clear();
      otherUserIdsRef.current.clear();
      setChats(new Map());
      setTypingUsers(new Set());
    }
  }, [isAuthenticated, userId]);

  /**
   * Subscribe to a conversation's messages and metadata
   */
  const subscribeToConversation = useCallback((conversationId: string, otherUserId: string) => {
    // Don't subscribe if already subscribed
    if (subscriptionsRef.current.has(conversationId)) {
      console.log('[ChatContext] Already subscribed to conversation:', conversationId);
      return;
    }

    const currentUserId = currentUserIdRef.current;
    if (!currentUserId) {
      console.error('[ChatContext] Cannot subscribe: user ID not available');
      return;
    }

    // Cancel lightweight preview subscription if it exists (full subscription replaces it)
    const existingPreview = previewSubscriptionsRef.current.get(conversationId);
    if (existingPreview) {
      existingPreview();
      previewSubscriptionsRef.current.delete(conversationId);
    }

    console.log('[ChatContext] Subscribing to conversation:', conversationId);

    // Subscribe to messages
    const unsubscribeMessages = subscribeToMessages(
      conversationId,
      (firebaseMessages: FirebaseMessage[]) => {
        console.log('[ChatContext] Messages updated for', conversationId, ':', firebaseMessages.length);

        // Convert Firebase messages to app messages
        const messages = firebaseMessages.map(msg => convertFirebaseMessage(msg, currentUserId));

        // Update chats state
        setChats(prev => {
          const newChats = new Map(prev);
          newChats.set(conversationId, {
            matchId: conversationId,
            messages,
          });
          return newChats;
        });

        // Mark messages as delivered
        markMessagesAsDelivered(conversationId, currentUserId).catch(err => {
          console.error('[ChatContext] Failed to mark messages as delivered:', err);
        });
      },
      50 // Limit to last 50 messages
    );

    // Store otherUserId for this conversation (used by sendMessage)
    otherUserIdsRef.current.set(conversationId, otherUserId);

    // Subscribe to typing indicator for the other user
    const unsubscribeTyping = subscribeToTypingIndicator(
      conversationId,
      otherUserId,
      (isTyping: boolean) => {
        setTypingUsers(prev => {
          const newSet = new Set(prev);
          if (isTyping) {
            newSet.add(conversationId);
          } else {
            newSet.delete(conversationId);
          }
          return newSet;
        });
      }
    );

    // Store unsubscribe functions
    subscriptionsRef.current.set(conversationId, unsubscribeMessages);
    typingSubscriptionsRef.current.set(conversationId, unsubscribeTyping);

    console.log('[ChatContext] Successfully subscribed to conversation:', conversationId);
  }, []);

  /**
   * Unsubscribe from a conversation
   */
  const unsubscribeFromConversation = useCallback((conversationId: string) => {
    console.log('[ChatContext] Unsubscribing from conversation:', conversationId);

    // Unsubscribe from messages
    const unsubscribeMessages = subscriptionsRef.current.get(conversationId);
    if (unsubscribeMessages) {
      unsubscribeMessages();
      subscriptionsRef.current.delete(conversationId);
    }

    // Unsubscribe from typing
    const unsubscribeTyping = typingSubscriptionsRef.current.get(conversationId);
    if (unsubscribeTyping) {
      unsubscribeTyping();
      typingSubscriptionsRef.current.delete(conversationId);
    }

    // Clean up stored otherUserId
    otherUserIdsRef.current.delete(conversationId);

    // Remove from typing users
    setTypingUsers(prev => {
      const newSet = new Set(prev);
      newSet.delete(conversationId);
      return newSet;
    });
  }, []);

  /**
   * Subscribe to last_message previews for multiple conversations.
   * Lightweight: only listens to conversations/{id}/last_message (not full messages).
   * Skips conversations that already have a full subscription.
   */
  const subscribeToConversationPreviews = useCallback((conversationIds: string[]) => {
    for (const conversationId of conversationIds) {
      // Skip if already has a full subscription or a preview subscription
      if (subscriptionsRef.current.has(conversationId) || previewSubscriptionsRef.current.has(conversationId)) {
        continue;
      }

      const unsubscribe = subscribeToLastMessage(conversationId, (lastMsg: FirebaseLastMessage | null) => {
        if (!lastMsg) return;

        // Only update if there's no full subscription for this conversation
        // (full subscription provides richer data and should take precedence)
        if (subscriptionsRef.current.has(conversationId)) return;

        const previewMessage: Message = {
          id: `preview-${conversationId}`,
          senderId: lastMsg.sender_id,
          text: lastMsg.content,
          timestamp: new Date(lastMsg.sent_at),
          status: 'sent',
          type: (lastMsg.message_type as Message['type']) || 'text',
        };

        setChats(prev => {
          const newChats = new Map(prev);
          newChats.set(conversationId, {
            matchId: conversationId,
            messages: [previewMessage],
          });
          return newChats;
        });
      });

      previewSubscriptionsRef.current.set(conversationId, unsubscribe);
    }
  }, []);

  /**
   * Send a message with optimistic UI
   */
  const sendMessage = useCallback(async (
    conversationId: string,
    message: Omit<Message, 'id' | 'timestamp' | 'status'>
  ): Promise<void> => {
    const currentUserId = currentUserIdRef.current;
    if (!currentUserId) {
      console.error('[ChatContext] Cannot send message: user ID not available');
      throw new Error('User not authenticated');
    }

    // Generate temporary ID for optimistic UI
    const tempId = `temp-${Date.now()}`;

    // Create optimistic message
    const optimisticMessage: Message = {
      ...message,
      id: tempId,
      timestamp: new Date(),
      status: 'sending',
    };

    console.log('[ChatContext] Sending message (optimistic):', optimisticMessage);

    // Immediately add to local state (optimistic UI)
    setChats(prev => {
      const newChats = new Map(prev);
      const chat = newChats.get(conversationId);
      if (chat) {
        newChats.set(conversationId, {
          ...chat,
          messages: [...chat.messages, optimisticMessage],
        });
      } else {
        // Create new chat if doesn't exist
        newChats.set(conversationId, {
          matchId: conversationId,
          messages: [optimisticMessage],
        });
      }
      return newChats;
    });

    try {
      // Get other user ID from stored mapping
      const otherUserId = otherUserIdsRef.current.get(conversationId);
      if (!otherUserId) {
        throw new Error('Other user ID not found. Subscribe to conversation first.');
      }

      // Send to Firebase
      const messageId = await sendMessageToFirebase(
        conversationId,
        currentUserId,
        otherUserId,
        message.text || '',
        message.type === 'image' ? 'image' : message.type === 'video' ? 'video' : 'text',
        message.mediaUrl
      );

      console.log('[ChatContext] Message sent successfully:', messageId);

      // Notify receiver via push notification (fire-and-forget)
      post('/notifications/message-sent', {
        receiver_id: otherUserId,
        conversation_id: conversationId,
        message_preview: message.text || (message.type === 'image' ? 'Sent a photo' : 'Sent a message'),
      }).catch(err => console.log('[ChatContext] Message notification failed:', err.message));

      // Update optimistic message with real ID
      setChats(prev => {
        const newChats = new Map(prev);
        const chat = newChats.get(conversationId);
        if (chat) {
          const updatedMessages = chat.messages.map(msg =>
            msg.id === tempId
              ? { ...msg, id: messageId, status: 'sent' as const }
              : msg
          );
          newChats.set(conversationId, { ...chat, messages: updatedMessages });
        }
        return newChats;
      });

      // Clear typing indicator
      await setTypingIndicator(conversationId, currentUserId, false);
    } catch (error) {
      console.error('[ChatContext] Failed to send message:', error);

      // Mark message as failed
      setChats(prev => {
        const newChats = new Map(prev);
        const chat = newChats.get(conversationId);
        if (chat) {
          const updatedMessages = chat.messages.map(msg =>
            msg.id === tempId
              ? { ...msg, status: 'failed' as const }
              : msg
          );
          newChats.set(conversationId, { ...chat, messages: updatedMessages });
        }
        return newChats;
      });

      throw error;
    }
  }, []);

  /**
   * Get messages for a conversation
   */
  const getMessages = useCallback((conversationId: string): Message[] => {
    return chats.get(conversationId)?.messages || [];
  }, [chats]);

  /**
   * Mark conversation as read
   */
  const markAsRead = useCallback((conversationId: string) => {
    const currentUserId = currentUserIdRef.current;
    if (!currentUserId) {
      console.error('[ChatContext] Cannot mark as read: user ID not available');
      return;
    }

    console.log('[ChatContext] Marking conversation as read:', conversationId);

    markMessagesAsSeen(conversationId, currentUserId).catch(err => {
      console.error('[ChatContext] Failed to mark messages as seen:', err);
    });
  }, []);

  /**
   * Set typing indicator
   */
  const setTyping = useCallback((conversationId: string, isTyping: boolean) => {
    const currentUserId = currentUserIdRef.current;
    if (!currentUserId) return;

    setTypingIndicator(conversationId, currentUserId, isTyping).catch(err => {
      console.error('[ChatContext] Failed to set typing indicator:', err);
    });
  }, []);

  /**
   * Delete a message
   */
  const deleteMessage = useCallback(async (
    conversationId: string,
    messageId: string,
    deleteForEveryone: boolean
  ): Promise<void> => {
    const currentUserId = currentUserIdRef.current;
    if (!currentUserId) {
      throw new Error('User not authenticated');
    }

    try {
      if (deleteForEveryone) {
        await deleteMessageForEveryone(conversationId, messageId, currentUserId);
      } else {
        await deleteMessageForMe(conversationId, messageId, currentUserId);
      }

      console.log('[ChatContext] Message deleted successfully:', messageId);
    } catch (error) {
      console.error('[ChatContext] Failed to delete message:', error);
      throw error;
    }
  }, []);

  /**
   * Check if subscribed to conversation
   */
  const isSubscribed = useCallback((conversationId: string): boolean => {
    return subscriptionsRef.current.has(conversationId);
  }, []);

  /**
   * Mute a conversation
   */
  const handleMuteConversation = useCallback(async (
    conversationId: string,
    muteUntil?: Date | null
  ): Promise<void> => {
    const currentUserId = currentUserIdRef.current;
    if (!currentUserId) {
      throw new Error('User not authenticated');
    }

    try {
      const muteTimestamp = muteUntil ? muteUntil.getTime() : null;
      await muteConversation(conversationId, currentUserId, muteTimestamp);
      console.log('[ChatContext] Conversation muted:', conversationId);
    } catch (error) {
      console.error('[ChatContext] Failed to mute conversation:', error);
      throw error;
    }
  }, []);

  /**
   * Unmute a conversation
   */
  const handleUnmuteConversation = useCallback(async (
    conversationId: string
  ): Promise<void> => {
    const currentUserId = currentUserIdRef.current;
    if (!currentUserId) {
      throw new Error('User not authenticated');
    }

    try {
      await unmuteConversation(conversationId, currentUserId);
      console.log('[ChatContext] Conversation unmuted:', conversationId);
    } catch (error) {
      console.error('[ChatContext] Failed to unmute conversation:', error);
      throw error;
    }
  }, []);

  /**
   * Check if conversation is muted
   */
  const handleIsConversationMuted = useCallback(async (
    conversationId: string
  ): Promise<boolean> => {
    const currentUserId = currentUserIdRef.current;
    if (!currentUserId) {
      return false;
    }

    try {
      return await isConversationMuted(conversationId, currentUserId);
    } catch (error) {
      console.error('[ChatContext] Failed to check mute status:', error);
      return false;
    }
  }, []);

  // Cleanup subscriptions on unmount
  useEffect(() => {
    return () => {
      console.log('[ChatContext] Cleaning up all subscriptions on unmount');
      subscriptionsRef.current.forEach(unsubscribe => unsubscribe());
      typingSubscriptionsRef.current.forEach(unsubscribe => unsubscribe());
      previewSubscriptionsRef.current.forEach(unsubscribe => unsubscribe());
    };
  }, []);

  return (
    <ChatContext.Provider
      value={{
        chats,
        typingUsers,
        subscribeToConversation,
        unsubscribeFromConversation,
        subscribeToConversationPreviews,
        sendMessage,
        getMessages,
        markAsRead,
        setTyping,
        deleteMessage,
        isSubscribed,
        muteConversation: handleMuteConversation,
        unmuteConversation: handleUnmuteConversation,
        isConversationMuted: handleIsConversationMuted,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
