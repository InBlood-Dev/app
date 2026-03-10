# Firebase Messaging & Notifications Implementation Plan - InBlood Frontend

## Context

The InBlood dating app frontend (React Native/Expo) currently has a **fully functional mock-based messaging UI** but is completely disconnected from the real-time Firebase backend. Users can see conversations and send messages in the UI, but everything is simulated with in-memory state and auto-replies.

**Current State:**
- ✅ Backend: Firebase Realtime Database + MongoDB hybrid architecture (complete)
- ✅ Frontend UI: ChatScreen, MatchesListScreen, ChatBubble components (complete)
- ❌ Frontend Integration: No Firebase Client SDK, no real-time listeners
- ❌ Notifications: No push notification system at all
- ❌ Features: No block/unblock, delete, mute functionality

**Why This Matters:**
The backend team has completed Phase 6 of Firebase implementation with:
- Real-time messaging via Firebase Realtime Database
- Presence tracking (online/offline status)
- Typing indicators
- Message deletion, reactions
- Notification infrastructure (FCM tokens stored, backend ready to send)

The frontend needs to connect to this backend infrastructure to enable real-time conversations.

**User Requirements to Accomplish:**
1. Can start conversation with matched users
2. Block/unblock users
3. Delete messages (for me / for everyone)
4. Push notifications: new match, new message, someone liked you
5. New match conversations appear on top of conversation list
6. Mute individual conversations and all notifications
7. Notification permission flow

---

## Architecture Overview

### Technology Stack
- **Firebase SDK:** `firebase` v10.8+ (Web SDK, NOT @react-native-firebase for Expo compatibility)
- **Push Notifications:** `@react-native-firebase/messaging` OR `expo-notifications` (recommend Firebase for FCM)
- **Navigation:** React Navigation (already in place)
- **State Management:** React Context API (refactor existing ChatContext)
- **Backend API:** https://backend-cfh1.onrender.com/api/v1

### Data Flow
```
User Action (send message)
    ↓
ChatContext (optimistic UI update)
    ↓
Firebase Realtime Database (direct write)
    ↓
Backend Firebase Admin SDK (listener) → Update MongoDB metadata
    ↓
Firebase Real-time listener on recipient device
    ↓
Recipient ChatContext (real-time update)
    ↓
UI updates automatically
```

### Backend Architecture (Already Complete)
```
Firebase Realtime Database:
├── /conversations/{conversationId}/messages/{messageId}
├── /user_conversations/{userId}/{conversationId} (metadata)
├── /presence/{userId} (online status)
├── /typing/{conversationId}/{userId} (typing indicator)
└── /unread/{userId}/{conversationId} (unread counts)

MongoDB:
├── User (profiles, FCM tokens)
├── Conversation (metadata, settings)
├── Match (match records)
└── Block (blocked users)
```

---

## Implementation Plan

### Phase 1: Firebase SDK Setup & Authentication

#### 1.1 Install Dependencies

```bash
npm install firebase@^10.8.0
npm install @react-native-firebase/app @react-native-firebase/messaging
# OR for Expo-only approach:
# npm install expo-notifications
```

**package.json additions:**
```json
{
  "dependencies": {
    "firebase": "^10.8.0",
    "@react-native-firebase/app": "^21.0.0",
    "@react-native-firebase/messaging": "^21.0.0"
  }
}
```

#### 1.2 Create Firebase Configuration

**New File:** `src/config/firebase.config.ts`

```typescript
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';
import { getAuth, Auth, signInWithCustomToken } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY", // Get from Firebase Console
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

let app: FirebaseApp | null = null;
let database: Database | null = null;
let auth: Auth | null = null;

export const initializeFirebase = () => {
  if (app) return { app, database, auth };

  app = initializeApp(firebaseConfig);
  database = getDatabase(app);
  auth = getAuth(app);

  console.log('[Firebase] Initialized');
  return { app, database, auth };
};

export const getFirebaseDatabase = (): Database => {
  if (!database) {
    initializeFirebase();
  }
  return database!;
};

export const getFirebaseAuth = (): Auth => {
  if (!auth) {
    initializeFirebase();
  }
  return auth!;
};

export const authenticateFirebase = async (customToken: string): Promise<void> => {
  const authInstance = getFirebaseAuth();
  await signInWithCustomToken(authInstance, customToken);
  console.log('[Firebase] Authenticated with custom token');
};
```

**Where to get Firebase config:**
1. Go to Firebase Console → Project Settings → General
2. Scroll to "Your apps" → Web app
3. Copy the firebaseConfig object
4. Ensure `databaseURL` matches backend's Firebase project

#### 1.3 Create Firebase Authentication Service

**New File:** `src/services/firebase-auth.service.ts`

```typescript
import { get } from './api';
import { authenticateFirebase } from '../config/firebase.config';

let firebaseToken: string | null = null;
let tokenExpiry: number | null = null;

export const getFirebaseToken = async (): Promise<string> => {
  // Return cached token if valid (refresh 1 min before expiry)
  if (firebaseToken && tokenExpiry && Date.now() < tokenExpiry) {
    return firebaseToken;
  }

  try {
    // Fetch custom token from backend
    const response = await get<{ firebase_token: string; expires_in: number }>(
      '/auth/firebase-token'
    );

    if (!response.success || !response.data) {
      throw new Error('Failed to get Firebase token');
    }

    firebaseToken = response.data.firebase_token;
    tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;

    // Authenticate Firebase SDK
    await authenticateFirebase(firebaseToken);

    console.log('[Firebase Auth] Token obtained and authenticated');
    return firebaseToken;
  } catch (error) {
    console.error('[Firebase Auth] Failed to get token:', error);
    throw error;
  }
};

export const initializeFirebaseAuth = async (): Promise<void> => {
  await getFirebaseToken();
};

export const clearFirebaseAuth = (): void => {
  firebaseToken = null;
  tokenExpiry = null;
  console.log('[Firebase Auth] Cleared');
};
```

**Integration Point:** Call `initializeFirebaseAuth()` in `AuthContext` after successful login

**Modify:** `src/context/AuthContext.tsx`

```typescript
import { initializeFirebaseAuth, clearFirebaseAuth } from '../services/firebase-auth.service';

// In login function (after setting access token)
const handleGoogleLogin = async () => {
  // ... existing login logic ...

  // Initialize Firebase auth
  try {
    await initializeFirebaseAuth();
    console.log('[Auth] Firebase authenticated');
  } catch (error) {
    console.error('[Auth] Firebase auth failed:', error);
    // Don't block login if Firebase fails
  }
};

// In logout function
const logout = async () => {
  // ... existing logout logic ...
  clearFirebaseAuth();
};
```

---

### Phase 2: Real-Time Messaging Implementation

#### 2.1 Create Firebase Messaging Service

**New File:** `src/services/firebase-messaging.service.ts`

```typescript
import {
  ref,
  push,
  set,
  onValue,
  off,
  serverTimestamp,
  get,
  update,
  query,
  orderByChild,
  limitToLast,
} from 'firebase/database';
import { getFirebaseDatabase } from '../config/firebase.config';
import { Message } from '../types';

/**
 * Send message to Firebase Realtime Database
 */
export const sendMessageToFirebase = async (
  conversationId: string,
  senderId: string,
  content: string,
  type: 'text' | 'image' | 'gif',
  mediaUrl?: string
): Promise<string> => {
  const db = getFirebaseDatabase();
  const messagesRef = ref(db, `conversations/${conversationId}/messages`);
  const newMessageRef = push(messagesRef);

  const messageData = {
    message_id: newMessageRef.key,
    sender_id: senderId,
    content: type === 'text' ? content : null,
    type,
    media_url: mediaUrl || null,
    sent_at: serverTimestamp(),
    is_deleted: false,
    deleted_for: null,
    reactions: {},
  };

  await set(newMessageRef, messageData);

  // Update last_message in conversation root
  await update(ref(db, `conversations/${conversationId}`), {
    last_message: {
      message_id: newMessageRef.key,
      content: type === 'text' ? content : `[${type}]`,
      sent_at: serverTimestamp(),
      sender_id: senderId,
      type,
    },
  });

  return newMessageRef.key!;
};

/**
 * Subscribe to messages in real-time
 */
export const subscribeToMessages = (
  conversationId: string,
  callback: (messages: Message[]) => void,
  limit: number = 50
): (() => void) => {
  const db = getFirebaseDatabase();
  const messagesRef = query(
    ref(db, `conversations/${conversationId}/messages`),
    orderByChild('sent_at'),
    limitToLast(limit)
  );

  const listener = onValue(
    messagesRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        callback([]);
        return;
      }

      const messagesData = snapshot.val();
      const messages: Message[] = Object.values(messagesData)
        .filter((msg: any) => !msg.is_deleted || msg.deleted_for !== 'both')
        .map((msg: any) => ({
          id: msg.message_id,
          senderId: msg.sender_id,
          text: msg.is_deleted ? 'This message was deleted' : msg.content || '',
          timestamp: new Date(msg.sent_at),
          status: 'delivered', // Status tracking handled separately
          type: msg.type,
          imageUrl: msg.media_url,
        }));

      callback(messages);
    },
    (error) => {
      console.error('[Firebase Messaging] Subscription error:', error);
    }
  );

  // Return cleanup function
  return () => {
    off(messagesRef, 'value', listener);
  };
};

/**
 * Set typing indicator
 */
export const setTypingIndicator = async (
  conversationId: string,
  userId: string,
  isTyping: boolean
): Promise<void> => {
  const db = getFirebaseDatabase();
  const typingRef = ref(db, `conversations/${conversationId}/typing/${userId}`);

  if (isTyping) {
    await set(typingRef, serverTimestamp());
  } else {
    await set(typingRef, null);
  }
};

/**
 * Subscribe to typing indicator
 */
export const subscribeToTyping = (
  conversationId: string,
  otherUserId: string,
  callback: (isTyping: boolean) => void
): (() => void) => {
  const db = getFirebaseDatabase();
  const typingRef = ref(db, `conversations/${conversationId}/typing/${otherUserId}`);

  const listener = onValue(typingRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback(false);
      return;
    }

    const timestamp = snapshot.val();
    const isRecent = Date.now() - timestamp < 5000; // 5 seconds timeout
    callback(isRecent);
  });

  return () => {
    off(typingRef, 'value', listener);
  };
};

/**
 * Mark messages as read
 */
export const markMessagesAsRead = async (
  userId: string,
  conversationId: string
): Promise<void> => {
  const db = getFirebaseDatabase();
  await set(ref(db, `unread/${userId}/${conversationId}`), 0);
};

/**
 * Subscribe to unread count
 */
export const subscribeToUnreadCount = (
  userId: string,
  conversationId: string,
  callback: (count: number) => void
): (() => void) => {
  const db = getFirebaseDatabase();
  const unreadRef = ref(db, `unread/${userId}/${conversationId}`);

  const listener = onValue(unreadRef, (snapshot) => {
    const count = snapshot.val() || 0;
    callback(count);
  });

  return () => {
    off(unreadRef, 'value', listener);
  };
};

/**
 * Delete message
 */
export const deleteMessage = async (
  conversationId: string,
  messageId: string,
  deleteFor: 'me' | 'everyone'
): Promise<void> => {
  const db = getFirebaseDatabase();
  const messageRef = ref(db, `conversations/${conversationId}/messages/${messageId}`);

  if (deleteFor === 'everyone') {
    await update(messageRef, {
      is_deleted: true,
      deleted_for: 'both',
      content: null,
      media_url: null,
    });
  } else {
    // For "delete for me", we mark locally (handled in UI filter)
    // Or use user-specific deleted_for field
    await update(messageRef, {
      is_deleted: true,
      deleted_for: 'sender', // or 'receiver' based on current user
    });
  }
};
```

#### 2.2 Refactor ChatContext

**Modify:** `src/context/ChatContext.tsx`

**Key Changes:**
1. Replace in-memory `Map<string, Chat>` with Firebase-backed state
2. Add subscription management
3. Implement optimistic UI for sending
4. Handle connection state

```typescript
import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Chat, Message } from '../types';
import { useUser } from './UserContext';
import {
  sendMessageToFirebase,
  subscribeToMessages,
  setTypingIndicator,
  subscribeToTyping,
  markMessagesAsRead,
  subscribeToUnreadCount,
  deleteMessage,
} from '../services/firebase-messaging.service';
import { initializeFirebase, getFirebaseDatabase } from '../config/firebase.config';
import { ref, onValue } from 'firebase/database';

interface ChatContextType {
  chats: Map<string, Chat>;
  typingUsers: Map<string, boolean>; // conversationId -> isTyping
  unreadCounts: Map<string, number>; // conversationId -> count
  isConnected: boolean;
  sendMessage: (conversationId: string, message: Omit<Message, 'id' | 'timestamp' | 'status'>) => Promise<void>;
  subscribeToConversation: (conversationId: string) => void;
  unsubscribeFromConversation: (conversationId: string) => void;
  markAsRead: (conversationId: string) => void;
  setTyping: (conversationId: string, isTyping: boolean) => void;
  deleteMessageForMe: (conversationId: string, messageId: string) => Promise<void>;
  deleteMessageForEveryone: (conversationId: string, messageId: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useUser();
  const [chats, setChats] = useState<Map<string, Chat>>(new Map());
  const [typingUsers, setTypingUsers] = useState<Map<string, boolean>>(new Map());
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const subscriptionsRef = useRef<Map<string, () => void>>(new Map());

  // Initialize Firebase on mount
  useEffect(() => {
    initializeFirebase();

    // Monitor connection state
    const db = getFirebaseDatabase();
    const connectedRef = ref(db, '.info/connected');

    const cleanup = onValue(connectedRef, (snapshot) => {
      const connected = snapshot.val() === true;
      setIsConnected(connected);
      console.log('[ChatContext] Connection state:', connected);
    });

    return () => {
      // Cleanup all subscriptions
      subscriptionsRef.current.forEach((cleanupFn) => cleanupFn());
      cleanup();
    };
  }, []);

  // Handle app state changes (foreground/background)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        console.log('[ChatContext] App became active');
        // Reconnect subscriptions if needed
      } else if (nextAppState === 'background') {
        console.log('[ChatContext] App went to background');
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Send message with optimistic UI
  const sendMessage = useCallback(
    async (conversationId: string, messageInput: Omit<Message, 'id' | 'timestamp' | 'status'>) => {
      if (!user?.id) {
        console.error('[ChatContext] Cannot send message: user not logged in');
        return;
      }

      // Optimistic update
      const tempId = `temp-${Date.now()}`;
      const optimisticMessage: Message = {
        id: tempId,
        senderId: user.id,
        text: messageInput.text,
        timestamp: new Date(),
        status: 'sending',
        type: messageInput.type,
        imageUrl: messageInput.imageUrl,
      };

      setChats((prev) => {
        const newMap = new Map(prev);
        const chat = newMap.get(conversationId);
        if (chat) {
          chat.messages = [...chat.messages, optimisticMessage];
          newMap.set(conversationId, { ...chat });
        } else {
          newMap.set(conversationId, {
            matchId: conversationId,
            messages: [optimisticMessage],
          });
        }
        return newMap;
      });

      try {
        // Send to Firebase
        const messageId = await sendMessageToFirebase(
          conversationId,
          user.id,
          messageInput.text,
          messageInput.type,
          messageInput.imageUrl
        );

        // Update optimistic message with real ID
        setChats((prev) => {
          const newMap = new Map(prev);
          const chat = newMap.get(conversationId);
          if (chat) {
            chat.messages = chat.messages.map((m) =>
              m.id === tempId ? { ...m, id: messageId, status: 'sent' } : m
            );
            newMap.set(conversationId, { ...chat });
          }
          return newMap;
        });

        console.log('[ChatContext] Message sent successfully:', messageId);
      } catch (error) {
        console.error('[ChatContext] Failed to send message:', error);

        // Mark as failed
        setChats((prev) => {
          const newMap = new Map(prev);
          const chat = newMap.get(conversationId);
          if (chat) {
            chat.messages = chat.messages.map((m) =>
              m.id === tempId ? { ...m, status: 'sent' } : m // Change to 'failed' status if needed
            );
            newMap.set(conversationId, { ...chat });
          }
          return newMap;
        });
      }
    },
    [user?.id]
  );

  // Subscribe to conversation
  const subscribeToConversation = useCallback(
    (conversationId: string) => {
      if (!user?.id) return;

      // Check if already subscribed
      if (subscriptionsRef.current.has(conversationId)) {
        console.log('[ChatContext] Already subscribed to:', conversationId);
        return;
      }

      console.log('[ChatContext] Subscribing to conversation:', conversationId);

      // Subscribe to messages
      const messagesCleanup = subscribeToMessages(conversationId, (messages) => {
        setChats((prev) => {
          const newMap = new Map(prev);
          newMap.set(conversationId, {
            matchId: conversationId,
            messages,
          });
          return newMap;
        });
      });

      // Subscribe to typing indicator
      const typingCleanup = subscribeToTyping(conversationId, 'other-user-id', (isTyping) => {
        setTypingUsers((prev) => {
          const newMap = new Map(prev);
          newMap.set(conversationId, isTyping);
          return newMap;
        });
      });

      // Subscribe to unread count
      const unreadCleanup = subscribeToUnreadCount(user.id, conversationId, (count) => {
        setUnreadCounts((prev) => {
          const newMap = new Map(prev);
          newMap.set(conversationId, count);
          return newMap;
        });
      });

      // Store cleanup functions
      const cleanup = () => {
        messagesCleanup();
        typingCleanup();
        unreadCleanup();
      };
      subscriptionsRef.current.set(conversationId, cleanup);
    },
    [user?.id]
  );

  // Unsubscribe from conversation
  const unsubscribeFromConversation = useCallback((conversationId: string) => {
    const cleanup = subscriptionsRef.current.get(conversationId);
    if (cleanup) {
      cleanup();
      subscriptionsRef.current.delete(conversationId);
      console.log('[ChatContext] Unsubscribed from:', conversationId);
    }
  }, []);

  // Mark as read
  const markAsRead = useCallback(
    (conversationId: string) => {
      if (!user?.id) return;
      markMessagesAsRead(user.id, conversationId).catch((error) =>
        console.error('[ChatContext] Failed to mark as read:', error)
      );
    },
    [user?.id]
  );

  // Set typing indicator
  const setTyping = useCallback(
    (conversationId: string, isTyping: boolean) => {
      if (!user?.id) return;
      setTypingIndicator(conversationId, user.id, isTyping).catch((error) =>
        console.error('[ChatContext] Failed to set typing:', error)
      );
    },
    [user?.id]
  );

  // Delete message for me
  const deleteMessageForMe = useCallback(async (conversationId: string, messageId: string) => {
    await deleteMessage(conversationId, messageId, 'me');
  }, []);

  // Delete message for everyone
  const deleteMessageForEveryone = useCallback(async (conversationId: string, messageId: string) => {
    await deleteMessage(conversationId, messageId, 'everyone');
  }, []);

  // Helper to get messages for a conversation
  const getMessages = useCallback(
    (conversationId: string): Message[] => {
      return chats.get(conversationId)?.messages || [];
    },
    [chats]
  );

  return (
    <ChatContext.Provider
      value={{
        chats,
        typingUsers,
        unreadCounts,
        isConnected,
        sendMessage,
        subscribeToConversation,
        unsubscribeFromConversation,
        markAsRead,
        setTyping,
        deleteMessageForMe,
        deleteMessageForEveryone,
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
```

#### 2.3 Update ChatScreen to Use Firebase

**Modify:** `src/screens/chat/ChatScreen.tsx`

**Key Changes:**
1. Subscribe to conversation when screen mounts
2. Unsubscribe when screen unmounts
3. Mark as read when screen is focused
4. Send typing indicator on text input

```typescript
// Add to imports
import { useFocusEffect } from '@react-navigation/native';

// In component body, update subscriptions
const {
  subscribeToConversation,
  unsubscribeFromConversation,
  sendMessage,
  markAsRead,
  setTyping,
  chats,
  typingUsers,
  isConnected
} = useChat();

const messages = chats.get(route.params.conversationId || matchId)?.messages || [];
const isTyping = typingUsers.get(route.params.conversationId || matchId) || false;

// Subscribe when screen mounts
useEffect(() => {
  const conversationId = route.params.conversationId || matchId;
  if (conversationId) {
    console.log('[ChatScreen] Subscribing to:', conversationId);
    subscribeToConversation(conversationId);
  }

  return () => {
    if (conversationId) {
      console.log('[ChatScreen] Unsubscribing from:', conversationId);
      unsubscribeFromConversation(conversationId);
    }
  };
}, [route.params.conversationId, matchId]);

// Mark as read when screen is focused
useFocusEffect(
  useCallback(() => {
    const conversationId = route.params.conversationId || matchId;
    if (conversationId) {
      markAsRead(conversationId);
    }
  }, [route.params.conversationId, matchId, markAsRead])
);

// Update handleSend to use conversationId
const handleSend = useCallback(() => {
  if (!messageText.trim()) return;

  const conversationId = route.params.conversationId || matchId;

  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  sendMessage(conversationId, {
    senderId: user?.id || 'current-user',
    text: messageText.trim(),
    type: 'text',
  });
  setMessageText('');
  setTyping(conversationId, false); // Clear typing indicator
}, [messageText, route.params.conversationId, matchId, sendMessage, user?.id, setTyping]);

// Add typing indicator on text change
const handleTextChange = useCallback((text: string) => {
  setMessageText(text);

  const conversationId = route.params.conversationId || matchId;
  if (text.length > 0) {
    setTyping(conversationId, true);
  } else {
    setTyping(conversationId, false);
  }
}, [route.params.conversationId, matchId, setTyping]);

// Update TextInput
<TextInput
  style={styles.input}
  placeholder="Type a message..."
  placeholderTextColor={colors.textMuted}
  value={messageText}
  onChangeText={handleTextChange} // Updated
  multiline
  maxLength={1000}
/>

// Add connection indicator
{!isConnected && (
  <View style={styles.offlineBanner}>
    <Ionicons name="cloud-offline" size={16} color={colors.text} />
    <Text style={styles.offlineText}>No internet connection</Text>
  </View>
)}
```

---

### Phase 3: Block/Unblock Feature

#### 3.1 Create Blocking Service

**New File:** `src/services/blocking.service.ts`

```typescript
import { post, del, get } from './api';

export const blockUser = async (userId: string): Promise<void> => {
  const response = await post('/blocks', { blocked_user_id: userId });
  if (!response.success) {
    throw new Error(response.message || 'Failed to block user');
  }
};

export const unblockUser = async (blockId: string): Promise<void> => {
  const response = await del(`/blocks/${blockId}`);
  if (!response.success) {
    throw new Error(response.message || 'Failed to unblock user');
  }
};

export const getBlockedUsers = async (): Promise<any[]> => {
  const response = await get('/blocks');
  if (!response.success) {
    throw new Error(response.message || 'Failed to get blocked users');
  }
  return response.data.blocks || [];
};
```

#### 3.2 Add Block Menu to ChatScreen

**Modify:** `src/screens/chat/ChatScreen.tsx`

Add overflow menu button in header:

```typescript
// Add state for menu
const [showMenu, setShowMenu] = useState(false);

// Add menu handler
const handleMenuPress = useCallback(() => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  setShowMenu(true);
}, []);

const handleBlockUser = useCallback(() => {
  setShowMenu(false);

  Alert.alert(
    `Block ${profile.name}?`,
    `${profile.name} won't be able to message you or see your profile.`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          try {
            await blockUser(profile.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            navigation.goBack();
          } catch (error) {
            Alert.alert('Error', 'Failed to block user');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }
        },
      },
    ]
  );
}, [profile]);

// Add to header
<View style={styles.headerActions}>
  <Pressable style={styles.headerButton} onPress={handleVideoCall}>
    <Ionicons name="videocam" size={24} color={colors.text} />
  </Pressable>
  <Pressable style={styles.headerButton} onPress={handleVoiceCall}>
    <Ionicons name="call" size={22} color={colors.text} />
  </Pressable>
  <Pressable style={styles.headerButton} onPress={handleMenuPress}>
    <Ionicons name="ellipsis-vertical" size={22} color={colors.text} />
  </Pressable>
</View>

// Add menu modal (use ActionSheet or custom bottom sheet)
<Modal visible={showMenu} transparent animationType="slide">
  <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
    <View style={styles.menuContainer}>
      <Pressable style={styles.menuItem} onPress={handleMuteConversation}>
        <Ionicons name="notifications-off" size={20} />
        <Text>Mute Conversation</Text>
      </Pressable>
      <Pressable style={styles.menuItem} onPress={handleBlockUser}>
        <Ionicons name="ban" size={20} color={colors.error} />
        <Text style={{ color: colors.error }}>Block {profile.name}</Text>
      </Pressable>
    </View>
  </Pressable>
</Modal>
```

#### 3.3 Add Blocked Users Screen

**New File:** `src/screens/settings/BlockedUsersScreen.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getBlockedUsers, unblockUser } from '../../services/blocking.service';

export const BlockedUsersScreen = () => {
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchBlockedUsers();
  }, []);

  const fetchBlockedUsers = async () => {
    try {
      setIsLoading(true);
      const users = await getBlockedUsers();
      setBlockedUsers(users);
    } catch (error) {
      Alert.alert('Error', 'Failed to load blocked users');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnblock = (blockId: string, userName: string) => {
    Alert.alert(
      `Unblock ${userName}?`,
      `${userName} will be able to see your profile and message you again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            try {
              await unblockUser(blockId);
              fetchBlockedUsers();
            } catch (error) {
              Alert.alert('Error', 'Failed to unblock user');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={blockedUsers}
        renderItem={({ item }) => (
          <View style={styles.userItem}>
            <Image source={{ uri: item.photo }} style={styles.avatar} />
            <Text style={styles.userName}>{item.name}</Text>
            <Pressable
              style={styles.unblockButton}
              onPress={() => handleUnblock(item.block_id, item.name)}
            >
              <Text>Unblock</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text>You haven't blocked anyone</Text>
          </View>
        }
      />
    </View>
  );
};
```

---

### Phase 4: Delete Message Feature

#### 4.1 Add Long-Press to ChatBubble

**Modify:** `src/components/ChatBubble.tsx`

```typescript
import { Pressable, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';

interface ChatBubbleProps {
  message: Message;
  isOwn: boolean;
  showTimestamp: boolean;
  onDelete?: (messageId: string, deleteFor: 'me' | 'everyone') => void;
}

export const ChatBubble = ({ message, isOwn, showTimestamp, onDelete }: ChatBubbleProps) => {
  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const options = isOwn
      ? ['Copy Text', 'Delete for Me', 'Delete for Everyone', 'Cancel']
      : ['Copy Text', 'Delete for Me', 'Report', 'Cancel'];

    Alert.alert('Message Actions', '', [
      { text: 'Copy Text', onPress: () => handleCopy() },
      isOwn && {
        text: 'Delete for Me',
        style: 'destructive',
        onPress: () => onDelete?.(message.id, 'me'),
      },
      isOwn && {
        text: 'Delete for Everyone',
        style: 'destructive',
        onPress: () => handleDeleteForEveryone(),
      },
      !isOwn && {
        text: 'Delete for Me',
        style: 'destructive',
        onPress: () => onDelete?.(message.id, 'me'),
      },
      { text: 'Cancel', style: 'cancel' },
    ].filter(Boolean));
  };

  const handleDeleteForEveryone = () => {
    // Check if message is < 1 hour old
    const hourAgo = Date.now() - 60 * 60 * 1000;
    const canDelete = message.timestamp.getTime() > hourAgo;

    if (!canDelete) {
      Alert.alert('Cannot Delete', 'You can only delete messages within 1 hour of sending.');
      return;
    }

    Alert.alert(
      'Delete for Everyone?',
      'This message will be deleted for all participants.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete?.(message.id, 'everyone'),
        },
      ]
    );
  };

  const handleCopy = () => {
    // Copy to clipboard
    console.log('Copy:', message.text);
  };

  return (
    <Pressable onLongPress={handleLongPress} delayLongPress={500}>
      {/* Existing bubble UI */}
    </Pressable>
  );
};
```

#### 4.2 Wire Delete to ChatScreen

**Modify:** `src/screens/chat/ChatScreen.tsx`

```typescript
import { useChat } from '../../context';

const { deleteMessageForMe, deleteMessageForEveryone } = useChat();

const handleDeleteMessage = useCallback(
  async (messageId: string, deleteFor: 'me' | 'everyone') => {
    const conversationId = route.params.conversationId || matchId;

    try {
      if (deleteFor === 'everyone') {
        await deleteMessageForEveryone(conversationId, messageId);
      } else {
        await deleteMessageForMe(conversationId, messageId);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert('Error', 'Failed to delete message');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  },
  [route.params.conversationId, matchId, deleteMessageForMe, deleteMessageForEveryone]
);

// Pass to ChatBubble
<ChatBubble
  message={item}
  isOwn={isOwn}
  showTimestamp={showTimestamp}
  onDelete={handleDeleteMessage}
/>
```

---

### Phase 5: Push Notifications

#### 5.1 Install Firebase Cloud Messaging

```bash
npm install @react-native-firebase/app @react-native-firebase/messaging
```

**For Expo (alternative):**
```bash
npx expo install expo-notifications expo-device expo-constants
```

#### 5.2 Create Notification Service

**New File:** `src/services/notifications.service.ts`

```typescript
import messaging from '@react-native-firebase/messaging';
import { Platform, Alert, Linking } from 'react-native';
import { post } from './api';

class NotificationService {
  private fcmToken: string | null = null;

  async initialize(): Promise<boolean> {
    // Request permission
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.log('[Notifications] Permission denied');
      return false;
    }

    // Get FCM token
    this.fcmToken = await messaging().getToken();
    console.log('[Notifications] FCM Token:', this.fcmToken);

    // Register token with backend
    await this.registerToken();

    // Set up listeners
    this.setupListeners();

    return true;
  }

  private async registerToken() {
    if (!this.fcmToken) return;

    try {
      await post('/notifications/register-token', {
        fcm_token: this.fcmToken,
        device_type: Platform.OS,
      });
      console.log('[Notifications] Token registered');
    } catch (error) {
      console.error('[Notifications] Failed to register token:', error);
    }
  }

  private setupListeners() {
    // Foreground messages
    messaging().onMessage(async (remoteMessage) => {
      console.log('[Notifications] Foreground message:', remoteMessage);
      // Show in-app notification
    });

    // Background/quit state messages
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('[Notifications] Background message:', remoteMessage);
    });

    // Notification tapped
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('[Notifications] Notification opened:', remoteMessage);
      this.handleNotificationTap(remoteMessage);
    });

    // App opened from killed state
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          this.handleNotificationTap(remoteMessage);
        }
      });
  }

  private handleNotificationTap(message: any) {
    const { data } = message;

    switch (data.type) {
      case 'new_match':
        // Navigate to MatchScreen
        break;
      case 'new_message':
        // Navigate to ChatScreen
        break;
      case 'match_liked_you':
        // Navigate to Likes screen
        break;
    }
  }

  async unregister() {
    if (!this.fcmToken) return;

    try {
      await post('/notifications/unregister-token', {});
      await messaging().deleteToken();
      this.fcmToken = null;
    } catch (error) {
      console.error('[Notifications] Failed to unregister:', error);
    }
  }
}

export const notificationService = new NotificationService();
```

#### 5.3 Create Permission Modal

**New File:** `src/components/modals/NotificationPermissionModal.tsx`

```typescript
import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors } from '../../theme';

interface NotificationPermissionModalProps {
  visible: boolean;
  onClose: () => void;
  onEnable: () => void;
}

export const NotificationPermissionModal = ({
  visible,
  onClose,
  onEnable,
}: NotificationPermissionModalProps) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <Animated.View entering={FadeIn} style={styles.card}>
          <View style={styles.iconContainer}>
            <Ionicons name="notifications" size={64} color={colors.primary} />
          </View>

          <Text style={styles.title}>Never Miss a Match</Text>
          <Text style={styles.subtitle}>
            Get notified when someone matches with you or sends a message
          </Text>

          <View style={styles.benefits}>
            <BenefitItem icon="heart" text="Instant match notifications" />
            <BenefitItem icon="chatbubbles" text="New message alerts" />
            <BenefitItem icon="flame" text="Know when someone likes you" />
          </View>

          <Pressable style={styles.enableButton} onPress={onEnable}>
            <Text style={styles.enableText}>Enable Notifications</Text>
          </Pressable>

          <Pressable style={styles.notNowButton} onPress={onClose}>
            <Text style={styles.notNowText}>Not Now</Text>
          </Pressable>

          <Text style={styles.privacyNote}>You can change this anytime in Settings</Text>
        </Animated.View>
      </View>
    </Modal>
  );
};

const BenefitItem = ({ icon, text }) => (
  <View style={styles.benefitItem}>
    <Ionicons name={icon} size={20} color={colors.primary} />
    <Text style={styles.benefitText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  benefits: {
    width: '100%',
    marginBottom: 24,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitText: {
    marginLeft: 12,
    fontSize: 14,
    color: colors.text,
  },
  enableButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    marginBottom: 12,
  },
  enableText: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  notNowButton: {
    paddingVertical: 12,
  },
  notNowText: {
    color: colors.textMuted,
  },
  privacyNote: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 12,
  },
});
```

#### 5.4 Integrate Permission Modal

**Modify:** `src/context/MatchesContext.tsx`

```typescript
import { notificationService } from '../services/notifications.service';

const [showNotificationPermission, setShowNotificationPermission] = useState(false);

// After first match
const swipeProfile = async (profileId: string, direction: SwipeDirection) => {
  // ... existing logic ...

  if (match && !hasShownNotificationPermission) {
    setTimeout(() => {
      setShowNotificationPermission(true);
    }, 3000); // 3 seconds after match modal
  }
};

const handleEnableNotifications = async () => {
  try {
    const enabled = await notificationService.initialize();
    if (enabled) {
      setShowNotificationPermission(false);
    }
  } catch (error) {
    Alert.alert('Error', 'Failed to enable notifications');
  }
};

// In return value
return (
  <MatchesContext.Provider value={{...}}>
    {children}
    <NotificationPermissionModal
      visible={showNotificationPermission}
      onClose={() => setShowNotificationPermission(false)}
      onEnable={handleEnableNotifications}
    />
  </MatchesContext.Provider>
);
```

---

### Phase 6: Mute Functionality

#### 6.1 Add Mute to Conversation Metadata

**Update:** `src/services/firebase-messaging.service.ts`

```typescript
import { ref, update } from 'firebase/database';
import { getFirebaseDatabase } from '../config/firebase.config';

export const muteConversation = async (
  userId: string,
  conversationId: string,
  muteUntil: Date | null
): Promise<void> => {
  const db = getFirebaseDatabase();
  await update(ref(db, `user_conversations/${userId}/${conversationId}`), {
    is_muted: true,
    mute_until: muteUntil?.getTime() || null,
  });
};

export const unmuteConversation = async (
  userId: string,
  conversationId: string
): Promise<void> => {
  const db = getFirebaseDatabase();
  await update(ref(db, `user_conversations/${userId}/${conversationId}`), {
    is_muted: false,
    mute_until: null,
  });
};
```

#### 6.2 Add Mute Action to ChatScreen Menu

**Modify:** `src/screens/chat/ChatScreen.tsx`

```typescript
const [isMuted, setIsMuted] = useState(false);

const handleMuteConversation = () => {
  setShowMenu(false);

  const options = [
    { label: 'For 1 hour', value: 60 },
    { label: 'For 8 hours', value: 480 },
    { label: 'For 24 hours', value: 1440 },
    { label: 'Until I unmute', value: null },
  ];

  Alert.alert('Mute Conversation', 'Mute notifications for:', [
    ...options.map((opt) => ({
      text: opt.label,
      onPress: async () => {
        const muteUntil = opt.value
          ? new Date(Date.now() + opt.value * 60 * 1000)
          : null;

        try {
          await muteConversation(user.id, conversationId, muteUntil);
          setIsMuted(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
          Alert.alert('Error', 'Failed to mute conversation');
        }
      },
    })),
    { text: 'Cancel', style: 'cancel' },
  ]);
};
```

---

### Phase 7: Conversation List Ordering

#### 7.1 Update MatchesListScreen Sorting

**Modify:** `src/screens/chat/MatchesListScreen.tsx`

```typescript
const sortedMatches = useMemo(() => {
  const pinned: Match[] = [];
  const newMatches: Match[] = [];
  const recent: Match[] = [];

  matches.forEach((match) => {
    const hasMessages = match.lastMessage !== undefined;
    const isNew = !hasMessages && Date.now() - match.matchedAt.getTime() < 24 * 60 * 60 * 1000;

    if (match.isPinned) {
      pinned.push(match);
    } else if (isNew) {
      newMatches.push(match);
    } else {
      recent.push(match);
    }
  });

  // Sort each section
  pinned.sort((a, b) => {
    const timeA = a.lastMessage?.timestamp?.getTime() || a.matchedAt.getTime();
    const timeB = b.lastMessage?.timestamp?.getTime() || b.matchedAt.getTime();
    return timeB - timeA;
  });

  newMatches.sort((a, b) => b.matchedAt.getTime() - a.matchedAt.getTime());

  recent.sort((a, b) => {
    const timeA = a.lastMessage?.timestamp?.getTime() || 0;
    const timeB = b.lastMessage?.timestamp?.getTime() || 0;
    return timeB - timeA;
  });

  return [...pinned, ...newMatches, ...recent];
}, [matches]);
```

#### 7.2 Add Section Headers

```typescript
<ScrollView>
  {pinnedMatches.length > 0 && (
    <>
      <SectionHeader title="Pinned" />
      {pinnedMatches.map((match) => (
        <ChatItem key={match.id} match={match} isPinned />
      ))}
    </>
  )}

  {newMatches.length > 0 && (
    <>
      <SectionHeader title="New Matches" badge={newMatches.length} />
      {newMatches.map((match) => (
        <ChatItem key={match.id} match={match} isNew />
      ))}
    </>
  )}

  <SectionHeader title="Messages" />
  {recentMatches.map((match) => (
    <ChatItem key={match.id} match={match} />
  ))}
</ScrollView>
```

---

## Verification Plan

### Test Scenarios

**1. Real-Time Messaging**
- [ ] Open ChatScreen → See Firebase authentication success
- [ ] Send message from Device A → See message appear on Device B in real-time
- [ ] Type on Device A → See typing indicator on Device B
- [ ] Send 100+ messages → Verify pagination works
- [ ] Go offline → Send message → Come online → Message delivered

**2. Conversation Initialization**
- [ ] Match with user → Conversation created in Firebase
- [ ] Tap "Say Hello" → Navigate to ChatScreen with conversationId
- [ ] Send first message → Message appears in Firebase `/conversations/{id}/messages`

**3. Block/Unblock**
- [ ] Block user from ChatScreen menu → User blocked, conversation removed
- [ ] Go to Settings → Blocked Users → See blocked user
- [ ] Unblock user → User can message again

**4. Delete Message**
- [ ] Long-press own message → See "Delete for Me" and "Delete for Everyone"
- [ ] Delete for everyone (< 1 hour) → Message deleted for both users
- [ ] Delete for me → Message hidden locally, other user still sees it
- [ ] Long-press message > 1 hour old → "Delete for Everyone" disabled

**5. Push Notifications**
- [ ] First match → See notification permission modal
- [ ] Grant permission → FCM token registered on backend
- [ ] Receive message while app in background → Push notification appears
- [ ] Tap notification → App opens to ChatScreen
- [ ] Receive match notification → Navigate to MatchScreen

**6. Mute Functionality**
- [ ] Mute conversation for 1 hour → No notifications for 1 hour
- [ ] Mute until unmuted → No notifications until manually unmuted
- [ ] Unmute → Notifications resume
- [ ] Muted conversation shows mute icon in list

**7. Conversation List**
- [ ] Pin conversation → Moves to top
- [ ] New match (no messages) → Appears in "New Matches" section with "NEW" badge
- [ ] Send first message in new match → Moves to "Messages" section
- [ ] Conversations sorted by last_message_at descending

---

## Critical Files

### Files to Create
1. `src/config/firebase.config.ts` - Firebase SDK initialization
2. `src/services/firebase-auth.service.ts` - Firebase authentication
3. `src/services/firebase-messaging.service.ts` - Real-time messaging operations
4. `src/services/notifications.service.ts` - Push notification handling
5. `src/services/blocking.service.ts` - Block/unblock API calls
6. `src/components/modals/NotificationPermissionModal.tsx` - Permission request modal
7. `src/screens/settings/BlockedUsersScreen.tsx` - Blocked users list

### Files to Modify
1. `src/context/ChatContext.tsx` - Refactor to use Firebase (major refactor)
2. `src/context/AuthContext.tsx` - Add Firebase auth initialization
3. `src/context/MatchesContext.tsx` - Integrate notification permission modal
4. `src/screens/chat/ChatScreen.tsx` - Add subscriptions, menu, delete
5. `src/screens/chat/MatchesListScreen.tsx` - Update sorting logic
6. `src/components/ChatBubble.tsx` - Add long-press for delete
7. `package.json` - Add Firebase dependencies

### Backend Endpoints (Already Complete)
- `GET /auth/firebase-token` - Get custom Firebase token
- `POST /notifications/register-token` - Register FCM token
- `POST /blocks` - Block user
- `DELETE /blocks/:blockId` - Unblock user
- `GET /blocks` - List blocked users

---

## Implementation Timeline

**Week 1: Firebase Setup & Real-Time Messaging**
- Install Firebase SDK
- Create firebase.config.ts
- Implement firebase-auth.service.ts
- Refactor ChatContext to use Firebase
- Test real-time messaging

**Week 2: Features (Block, Delete, Mute)**
- Implement blocking.service.ts
- Add block menu to ChatScreen
- Create BlockedUsersScreen
- Add message deletion
- Implement mute functionality

**Week 3: Push Notifications**
- Install @react-native-firebase/messaging
- Create notifications.service.ts
- Build NotificationPermissionModal
- Implement notification handling
- Test deep linking

**Week 4: Polish & Testing**
- Update conversation list sorting
- Add loading states
- Add error handling
- End-to-end testing
- Bug fixes

---

## Notes for Implementation

1. **Firebase Config:** Get credentials from Firebase Console matching backend project
2. **Testing:** Use two physical devices or device + emulator for real-time testing
3. **Token Refresh:** Firebase tokens expire after 1 hour - implement proactive refresh
4. **Offline Support:** Firebase Realtime Database has built-in offline persistence
5. **Performance:** Unsubscribe from conversations when screen unmounts
6. **Error Handling:** All Firebase operations should have try-catch
7. **Optimistic UI:** Show messages immediately, update status after Firebase confirms
8. **Connection State:** Monitor `.info/connected` to show offline banner

---

This comprehensive plan provides all the details needed to implement Firebase messaging and notifications in the InBlood frontend. The backend infrastructure is already complete, so implementation can begin immediately.
