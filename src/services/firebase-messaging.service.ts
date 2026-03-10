import {
  ref,
  push,
  set,
  update,
  onValue,
  onChildAdded,
  off,
  query,
  orderByChild,
  limitToLast,
  get,
  serverTimestamp,
  DatabaseReference,
  DataSnapshot
} from 'firebase/database';
import { getFirebaseDatabase } from '../config/firebase.config';

/**
 * Message type matching backend structure
 */
export interface FirebaseMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  message_type: 'text' | 'image' | 'video' | 'audio' | 'opening_move';
  media_url?: string;
  sent_at: number;
  delivered_at?: number;
  seen_at?: number;
  deleted_for_sender?: boolean;
  deleted_for_receiver?: boolean;
  deleted_at?: number;
  status?: 'sending' | 'sent' | 'delivered' | 'seen' | 'failed';
}

/**
 * Send a message to Firebase
 * Paths: conversations/{id}/messages, conversations/{id}/last_message, unread/{receiverId}/{conversationId}
 */
export const sendMessageToFirebase = async (
  conversationId: string,
  senderId: string,
  receiverId: string,
  content: string,
  messageType: 'text' | 'image' | 'video' | 'audio' = 'text',
  mediaUrl?: string
): Promise<string> => {
  try {
    const db = getFirebaseDatabase();
    const messagesRef = ref(db, `conversations/${conversationId}/messages`);

    // Create new message reference
    const newMessageRef = push(messagesRef);
    const messageId = newMessageRef.key!;

    const messageData: Partial<FirebaseMessage> = {
      id: messageId,
      conversation_id: conversationId,
      sender_id: senderId,
      receiver_id: receiverId,
      content,
      message_type: messageType,
      sent_at: Date.now(),
      ...(mediaUrl && { media_url: mediaUrl }),
    };

    // Write message to Firebase
    await set(newMessageRef, messageData);

    // Update last_message at conversations/{id}/last_message
    const lastMessageRef = ref(db, `conversations/${conversationId}/last_message`);
    await set(lastMessageRef, {
      content: messageType === 'text' ? content : `Sent a ${messageType}`,
      sender_id: senderId,
      message_type: messageType,
      sent_at: Date.now(),
    });

    // Increment unread count at unread/{receiverId}/{conversationId}
    const unreadRef = ref(db, `unread/${receiverId}/${conversationId}`);
    const snapshot = await get(unreadRef);
    const currentCount = snapshot.val() || 0;
    await set(unreadRef, currentCount + 1);

    // Update last_message_at for both users so conversation list ordering stays current
    const now = Date.now();
    const senderConvRef = ref(db, `user_conversations/${senderId}/${conversationId}/last_message_at`);
    const receiverConvRef = ref(db, `user_conversations/${receiverId}/${conversationId}/last_message_at`);
    await Promise.all([set(senderConvRef, now), set(receiverConvRef, now)]);

    console.log('[Firebase Messaging] Message sent:', messageId);
    return messageId;
  } catch (error) {
    console.error('[Firebase Messaging] Failed to send message:', error);
    throw error;
  }
};

/**
 * Subscribe to messages in a conversation
 * Path: conversations/{id}/messages
 */
export const subscribeToMessages = (
  conversationId: string,
  callback: (messages: FirebaseMessage[]) => void,
  limit: number = 50
): (() => void) => {
  try {
    const db = getFirebaseDatabase();
    const messagesRef = query(
      ref(db, `conversations/${conversationId}/messages`),
      orderByChild('sent_at'),
      limitToLast(limit)
    );

    const listener = onValue(messagesRef, (snapshot: DataSnapshot) => {
      const messagesData = snapshot.val();

      if (!messagesData) {
        console.log('[Firebase Messaging] No messages found for conversation:', conversationId);
        callback([]);
        return;
      }

      // Convert object to array and sort by sent_at
      const messages: FirebaseMessage[] = Object.values(messagesData)
        .map((msg: any) => ({
          ...msg,
          status: msg.seen_at ? 'seen' : msg.delivered_at ? 'delivered' : 'sent',
        }))
        .sort((a: any, b: any) => a.sent_at - b.sent_at);

      console.log('[Firebase Messaging] Messages updated:', messages.length);
      callback(messages);
    }, (error) => {
      console.error('[Firebase Messaging] Error subscribing to messages:', error);
    });

    // Return unsubscribe function
    return () => {
      console.log('[Firebase Messaging] Unsubscribing from messages:', conversationId);
      off(messagesRef, 'value', listener);
    };
  } catch (error) {
    console.error('[Firebase Messaging] Failed to subscribe to messages:', error);
    return () => {};
  }
};

/**
 * Mark messages as delivered
 * Path: conversations/{id}/messages/{messageId}/delivered_at
 */
export const markMessagesAsDelivered = async (
  conversationId: string,
  userId: string
): Promise<void> => {
  try {
    const db = getFirebaseDatabase();
    const messagesRef = ref(db, `conversations/${conversationId}/messages`);

    const snapshot = await get(messagesRef);
    const messagesData = snapshot.val();

    if (!messagesData) return;

    const updates: Record<string, any> = {};
    const now = Date.now();

    Object.entries(messagesData).forEach(([messageId, message]: [string, any]) => {
      if (message.message_type === 'opening_move') return;
      if (message.receiver_id === userId && !message.delivered_at) {
        updates[`${messageId}/delivered_at`] = now;
      }
    });

    if (Object.keys(updates).length > 0) {
      await update(messagesRef, updates);
      console.log('[Firebase Messaging] Marked messages as delivered:', Object.keys(updates).length);
    }
  } catch (error) {
    console.error('[Firebase Messaging] Failed to mark messages as delivered:', error);
  }
};

/**
 * Mark messages as seen and reset unread count
 * Paths: conversations/{id}/messages, unread/{userId}/{conversationId}
 */
export const markMessagesAsSeen = async (
  conversationId: string,
  userId: string
): Promise<void> => {
  try {
    const db = getFirebaseDatabase();
    const messagesRef = ref(db, `conversations/${conversationId}/messages`);

    const snapshot = await get(messagesRef);
    const messagesData = snapshot.val();

    if (!messagesData) return;

    const updates: Record<string, any> = {};
    const now = Date.now();

    Object.entries(messagesData).forEach(([messageId, message]: [string, any]) => {
      if (message.message_type === 'opening_move') return;
      if (message.receiver_id === userId && !message.seen_at) {
        updates[`${messageId}/seen_at`] = now;
        if (!message.delivered_at) {
          updates[`${messageId}/delivered_at`] = now;
        }
      }
    });

    if (Object.keys(updates).length > 0) {
      await update(messagesRef, updates);

      // Reset unread count at unread/{userId}/{conversationId}
      const unreadRef = ref(db, `unread/${userId}/${conversationId}`);
      await set(unreadRef, 0);

      console.log('[Firebase Messaging] Marked messages as seen:', Object.keys(updates).length);
    }
  } catch (error) {
    console.error('[Firebase Messaging] Failed to mark messages as seen:', error);
  }
};

/**
 * Subscribe to typing indicator for the other user
 * Path: conversations/{id}/typing/{otherUserId}
 */
export const subscribeToTypingIndicator = (
  conversationId: string,
  otherUserId: string,
  callback: (isTyping: boolean) => void
): (() => void) => {
  try {
    const db = getFirebaseDatabase();
    const typingRef = ref(db, `conversations/${conversationId}/typing/${otherUserId}`);

    const listener = onValue(typingRef, (snapshot: DataSnapshot) => {
      const isTyping = snapshot.val() || false;
      callback(isTyping);
    }, (error) => {
      console.error('[Firebase Messaging] Error subscribing to typing:', error);
    });

    return () => {
      off(typingRef, 'value', listener);
    };
  } catch (error) {
    console.error('[Firebase Messaging] Failed to subscribe to typing:', error);
    return () => {};
  }
};

/**
 * Set typing indicator
 * Path: conversations/{id}/typing/{userId}
 */
export const setTypingIndicator = async (
  conversationId: string,
  userId: string,
  isTyping: boolean
): Promise<void> => {
  try {
    const db = getFirebaseDatabase();
    const typingRef = ref(db, `conversations/${conversationId}/typing/${userId}`);

    await set(typingRef, isTyping);
  } catch (error) {
    console.error('[Firebase Messaging] Failed to set typing indicator:', error);
  }
};

/**
 * Delete message for current user
 */
export const deleteMessageForMe = async (
  conversationId: string,
  messageId: string,
  userId: string
): Promise<void> => {
  try {
    const db = getFirebaseDatabase();
    const messageRef = ref(db, `conversations/${conversationId}/messages/${messageId}`);

    const snapshot = await get(messageRef);
    const message = snapshot.val();

    if (!message) {
      throw new Error('Message not found');
    }

    const deleteField = message.sender_id === userId ? 'deleted_for_sender' : 'deleted_for_receiver';

    await update(messageRef, {
      [deleteField]: true,
      deleted_at: Date.now(),
    });

    console.log('[Firebase Messaging] Message deleted for user:', messageId);
  } catch (error) {
    console.error('[Firebase Messaging] Failed to delete message:', error);
    throw error;
  }
};

/**
 * Delete message for everyone (only if sent within 1 hour)
 */
export const deleteMessageForEveryone = async (
  conversationId: string,
  messageId: string,
  userId: string
): Promise<void> => {
  try {
    const db = getFirebaseDatabase();
    const messageRef = ref(db, `conversations/${conversationId}/messages/${messageId}`);

    const snapshot = await get(messageRef);
    const message = snapshot.val();

    if (!message) {
      throw new Error('Message not found');
    }

    if (message.sender_id !== userId) {
      throw new Error('Only sender can delete message for everyone');
    }

    const oneHourInMs = 60 * 60 * 1000;
    if (Date.now() - message.sent_at > oneHourInMs) {
      throw new Error('Cannot delete message older than 1 hour');
    }

    await update(messageRef, {
      deleted_for_sender: true,
      deleted_for_receiver: true,
      deleted_at: Date.now(),
      content: 'This message was deleted',
    });

    console.log('[Firebase Messaging] Message deleted for everyone:', messageId);
  } catch (error) {
    console.error('[Firebase Messaging] Failed to delete message for everyone:', error);
    throw error;
  }
};

/**
 * Mute a conversation
 * Path: user_conversations/{userId}/{conversationId}
 */
export const muteConversation = async (
  conversationId: string,
  userId: string,
  muteUntil: number | null = null
): Promise<void> => {
  try {
    const db = getFirebaseDatabase();
    const convRef = ref(db, `user_conversations/${userId}/${conversationId}`);

    await update(convRef, {
      is_muted: true,
      mute_until: muteUntil,
    });

    console.log('[Firebase Messaging] Conversation muted:', conversationId);
  } catch (error) {
    console.error('[Firebase Messaging] Failed to mute conversation:', error);
    throw error;
  }
};

/**
 * Unmute a conversation
 * Path: user_conversations/{userId}/{conversationId}
 */
export const unmuteConversation = async (
  conversationId: string,
  userId: string
): Promise<void> => {
  try {
    const db = getFirebaseDatabase();
    const convRef = ref(db, `user_conversations/${userId}/${conversationId}`);

    await update(convRef, {
      is_muted: false,
      mute_until: null,
    });

    console.log('[Firebase Messaging] Conversation unmuted:', conversationId);
  } catch (error) {
    console.error('[Firebase Messaging] Failed to unmute conversation:', error);
    throw error;
  }
};

/**
 * Check if conversation is currently muted for user
 * Path: user_conversations/{userId}/{conversationId}
 */
export const isConversationMuted = async (
  conversationId: string,
  userId: string
): Promise<boolean> => {
  try {
    const db = getFirebaseDatabase();
    const convRef = ref(db, `user_conversations/${userId}/${conversationId}`);

    const snapshot = await get(convRef);
    const data = snapshot.val();

    if (!data || !data.is_muted) return false;

    // If muted indefinitely (no mute_until), return true
    if (!data.mute_until) return true;

    // If mute_until is in the past, automatically unmute
    if (Date.now() > data.mute_until) {
      await unmuteConversation(conversationId, userId);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Firebase Messaging] Failed to check mute status:', error);
    return false;
  }
};

/**
 * Lightweight last_message data from Firebase
 */
export interface FirebaseLastMessage {
  content: string;
  sender_id: string;
  message_type: string;
  sent_at: number;
}

/**
 * Subscribe to the current user's conversation index for real-time detection of
 * new conversations (e.g. when an unmatched user messages them from search/explore).
 * Path: user_conversations/{userId}
 *
 * onChildAdded fires for each existing child when first attached, then for any
 * genuinely new child afterward. The caller is responsible for debouncing if needed.
 */
export const subscribeToUserConversations = (
  userId: string,
  onNewConversation: (conversationId: string, otherUserId: string) => void
): (() => void) => {
  try {
    const db = getFirebaseDatabase();
    const userConvsRef = ref(db, `user_conversations/${userId}`);

    // In Firebase v9 modular SDK, onChildAdded returns an Unsubscribe function directly.
    // We must return it as-is — do NOT wrap it in off(), which expects the original
    // callback reference and won't find it (causing listener leaks on auth cycles).
    const unsubscribe = onChildAdded(
      userConvsRef,
      (snapshot: DataSnapshot) => {
        const conversationId = snapshot.key;
        const data = snapshot.val();
        if (conversationId && data?.other_user_id) {
          onNewConversation(conversationId, data.other_user_id);
        }
      },
      (error: Error) => {
        console.error('[Firebase Messaging] Error in user conversations listener:', error);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('[Firebase Messaging] Failed to subscribe to user conversations:', error);
    return () => {};
  }
};

/**
 * Subscribe to a conversation's last_message node (lightweight preview).
 * Path: conversations/{id}/last_message
 */
export const subscribeToLastMessage = (
  conversationId: string,
  callback: (lastMessage: FirebaseLastMessage | null) => void
): (() => void) => {
  try {
    const db = getFirebaseDatabase();
    const lastMessageRef = ref(db, `conversations/${conversationId}/last_message`);

    const listener = onValue(lastMessageRef, (snapshot: DataSnapshot) => {
      callback(snapshot.val());
    }, (error) => {
      console.error('[Firebase Messaging] Error subscribing to last message:', error);
    });

    return () => {
      off(lastMessageRef, 'value', listener);
    };
  } catch (error) {
    console.error('[Firebase Messaging] Failed to subscribe to last message:', error);
    return () => {};
  }
};
