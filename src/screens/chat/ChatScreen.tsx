import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  Platform,
  Image,
  Alert,
  ActionSheetIOS,
  Modal,
  Keyboard,
} from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, {
  FadeIn,
  FadeInDown,
  SlideInUp,
  useAnimatedStyle,
  interpolate,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { ChatBubble, TypingIndicator, OpeningMoveCard, ReportModal } from '../../components';
import { useChat, useUser } from '../../context';
import { Message, Profile } from '../../types';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';
import { blockUser, unblockUser } from '../../services/blocking.service';
import { uploadChatImage, MAX_IMAGE_SIZE } from '../../services/chat.service';
import { trackEvent } from '../../lib/analytics';
import { getOnlineStatus } from '../../utils/timeUtils';

type RootStackParamList = {
  ChatScreen: { matchId?: string | null; conversationId: string; profile: Profile };
  ProfileDetail: { profile: Profile; isMatched?: boolean };
};

type ChatScreenRouteProp = RouteProp<RootStackParamList, 'ChatScreen'>;

export const ChatScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<ChatScreenRouteProp>();
  const insets = useSafeAreaInsets();
  const {
    subscribeToConversation,
    unsubscribeFromConversation,
    sendMessage,
    getMessages,
    typingUsers,
    markAsRead,
    setTyping,
    deleteMessage,
    muteConversation,
    unmuteConversation,
    isConversationMuted,
  } = useChat();
  const { user } = useUser();

  const { matchId, conversationId, profile } = route.params;
  const [messageText, setMessageText] = useState('');
  const [isBlocked, setIsBlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showMuteOptions, setShowMuteOptions] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keyboard animation for edge-to-edge compatible input positioning
  const { height: keyboardHeight, progress } = useReanimatedKeyboardAnimation();

  // Animated spacer pushes content up by exact keyboard height
  const spacerStyle = useAnimatedStyle(() => ({
    height: Math.abs(keyboardHeight.value),
  }));

  // Input paddingBottom transitions: insets.bottom (above nav bar) → 0 (keyboard replaces nav bar)
  const safeBottom = Math.max(insets.bottom, 34);
  const inputAnimatedStyle = useAnimatedStyle(() => ({
    paddingBottom: interpolate(
      progress.value,
      [0, 1],
      [safeBottom, spacing.sm]
    ),
  }));

  const messages = getMessages(conversationId);
  const isTyping = typingUsers.has(conversationId);

  const onlineStatus = getOnlineStatus(profile.lastActive);

  // Subscribe to conversation on mount, unsubscribe on unmount
  useEffect(() => {
    console.log('[ChatScreen] Subscribing to conversation:', conversationId);
    subscribeToConversation(conversationId, profile.id);

    return () => {
      console.log('[ChatScreen] Unsubscribing from conversation:', conversationId);
      unsubscribeFromConversation(conversationId);
    };
  }, [conversationId, profile.id, subscribeToConversation, unsubscribeFromConversation]);

  // Mark messages as read when screen is focused
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('[ChatScreen] Screen focused, marking as read:', conversationId);
      markAsRead(conversationId);
    });

    return unsubscribe;
  }, [navigation, conversationId, markAsRead]);

  // Check mute status on mount
  useEffect(() => {
    const checkMuteStatus = async () => {
      try {
        const muted = await isConversationMuted(conversationId);
        setIsMuted(muted);
      } catch (error) {
        console.error('[ChatScreen] Failed to check mute status:', error);
      }
    };

    checkMuteStatus();
  }, [conversationId, isConversationMuted]);

  // Cleanup typing timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        console.log('[ChatScreen] Clearing typing timeout on unmount');
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
        // Clear typing indicator on unmount
        setTyping(conversationId, false);
      }
    };
  }, [conversationId, setTyping]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // Scroll to bottom when keyboard shows
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const showSub = Keyboard.addListener(showEvent, () => {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });
    return () => {
      showSub.remove();
    };
  }, []);

  const handleSend = useCallback(async () => {
    if (!messageText.trim()) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const messageToSend = messageText.trim();
    setMessageText(''); // Clear input immediately for better UX

    try {
      await sendMessage(conversationId, {
        senderId: user?.id || 'current-user',
        text: messageToSend,
        type: 'text',
      });
      trackEvent('message_sent', { type: 'text', length: messageToSend.length });
    } catch (error) {
      console.error('[ChatScreen] Failed to send message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
      // Restore message text on error
      setMessageText(messageToSend);
    }
  }, [messageText, conversationId, sendMessage, user?.id]);

  const handlePickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.7,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];

    // Client-side size check (fileSize may be undefined on some platforms)
    if (asset.fileSize && asset.fileSize > MAX_IMAGE_SIZE) {
      Alert.alert('Image Too Large', 'Please select an image under 10 MB.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPendingImage(asset.uri);
  }, []);

  const handleSendImage = useCallback(async () => {
    if (!pendingImage) return;

    // Capture any typed text as a caption
    const caption = messageText.trim();

    setImageUploading(true);
    setMessageText('');
    try {
      const imageUrl = await uploadChatImage(pendingImage);

      await sendMessage(conversationId, {
        senderId: user?.id || 'current-user',
        text: caption,
        type: 'image',
        mediaUrl: imageUrl,
      });
      trackEvent('message_sent', { type: 'image' });

      setPendingImage(null);
    } catch (error) {
      console.error('[ChatScreen] Failed to send image:', error);
      Alert.alert('Error', 'Failed to send image. Please try again.');
      // Restore caption on error
      if (caption) setMessageText(caption);
    } finally {
      setImageUploading(false);
    }
  }, [pendingImage, messageText, conversationId, sendMessage, user?.id]);

  // Handle typing indicator
  const handleTextChange = useCallback((text: string) => {
    setMessageText(text);

    // Clear existing typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set typing indicator
    if (text.length > 0) {
      setTyping(conversationId, true);

      // Clear typing indicator after 3 seconds of no typing
      typingTimeoutRef.current = setTimeout(() => {
        setTyping(conversationId, false);
      }, 3000);
    } else {
      setTyping(conversationId, false);
    }
  }, [conversationId, setTyping]);

  const handleOpeningMoveReply = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    inputRef.current?.focus();
  }, []);

  const handleProfilePress = useCallback(() => {
    navigation.navigate('ProfileDetail', { profile, isMatched: !!matchId });
  }, [navigation, profile]);

  const handleMessageLongPress = useCallback((message: Message) => {
    const isOwnMessage = message.senderId === (user?.id || 'current-user');
    if (!isOwnMessage) return; // Only allow deleting own messages

    // Check if message is within 1-hour window for "delete for everyone"
    const oneHourInMs = 60 * 60 * 1000;
    const timeSinceSent = Date.now() - message.timestamp.getTime();
    const canDeleteForEveryone = timeSinceSent <= oneHourInMs;

    const options = ['Delete for Me'];
    if (canDeleteForEveryone) {
      options.push('Delete for Everyone');
    }
    options.push('Cancel');

    const destructiveButtonIndex = canDeleteForEveryone ? 1 : 0;
    const cancelButtonIndex = options.length - 1;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          destructiveButtonIndex,
          cancelButtonIndex,
          title: 'Delete Message',
        },
        async (buttonIndex) => {
          if (buttonIndex === 0) {
            // Delete for Me
            try {
              await deleteMessage(conversationId, message.id, false);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete message. Please try again.');
            }
          } else if (buttonIndex === 1 && canDeleteForEveryone) {
            // Delete for Everyone
            Alert.alert(
              'Delete for Everyone',
              'This message will be deleted for both you and the recipient.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await deleteMessage(conversationId, message.id, true);
                    } catch (error) {
                      Alert.alert('Error', 'Failed to delete message. Please try again.');
                    }
                  },
                },
              ]
            );
          }
        }
      );
    } else {
      // Android
      Alert.alert(
        'Delete Message',
        'Choose an option',
        [
          {
            text: 'Delete for Me',
            onPress: async () => {
              try {
                await deleteMessage(conversationId, message.id, false);
              } catch (error) {
                Alert.alert('Error', 'Failed to delete message. Please try again.');
              }
            },
          },
          ...(canDeleteForEveryone
            ? [
                {
                  text: 'Delete for Everyone',
                  style: 'destructive' as const,
                  onPress: async () => {
                    try {
                      await deleteMessage(conversationId, message.id, true);
                    } catch (error) {
                      Alert.alert('Error', 'Failed to delete message. Please try again.');
                    }
                  },
                },
              ]
            : []),
          { text: 'Cancel', style: 'cancel' as const },
        ]
      );
    }
  }, [conversationId, deleteMessage, user?.id]);

  const handleMenu = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowMuteOptions(false);
    setShowMenuModal(true);
  }, []);

  const closeMenu = useCallback(() => {
    setShowMenuModal(false);
    setShowMuteOptions(false);
  }, []);

  const handleMuteSelect = useCallback(async (muteUntil: Date | null) => {
    closeMenu();
    try {
      await muteConversation(conversationId, muteUntil);
      setIsMuted(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Error', 'Failed to mute conversation.');
    }
  }, [conversationId, muteConversation, closeMenu]);

  const handleUnmuteSelect = useCallback(async () => {
    closeMenu();
    try {
      await unmuteConversation(conversationId);
      setIsMuted(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Error', 'Failed to unmute conversation.');
    }
  }, [conversationId, unmuteConversation, closeMenu]);

  const handleBlockSelect = useCallback(async () => {
    closeMenu();
    if (isBlocked) {
      try {
        await unblockUser(profile.id);
        setIsBlocked(false);
      } catch {
        Alert.alert('Error', 'Failed to unblock user.');
      }
    } else {
      Alert.alert(
        'Block User',
        `Are you sure you want to block ${profile.name}? You will no longer receive messages from them.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Block',
            style: 'destructive',
            onPress: async () => {
              try {
                await blockUser(profile.id);
                setIsBlocked(true);
                navigation.goBack();
              } catch {
                Alert.alert('Error', 'Failed to block user.');
              }
            },
          },
        ]
      );
    }
  }, [isBlocked, profile.id, profile.name, navigation, closeMenu]);

  const handleReportSelect = useCallback(() => {
    closeMenu();
    // Delay so menu modal closes before report modal opens
    setTimeout(() => setShowReportModal(true), 350);
  }, [closeMenu]);

  const renderMessage = useCallback(({ item, index }: { item: Message; index: number }) => {
    const isOwn = item.senderId === (user?.id || 'current-user');

    if (item.type === 'opening_move') {
      return (
        <OpeningMoveCard
          message={item}
          isOwn={isOwn}
          onReply={isOwn ? undefined : handleOpeningMoveReply}
        />
      );
    }

    const showTimestamp = index === 0 ||
      messages[index - 1]?.senderId !== item.senderId ||
      (item.timestamp.getTime() - messages[index - 1]?.timestamp.getTime()) > 300000; // 5 minutes

    return (
      <ChatBubble
        message={item}
        isOwn={isOwn}
        showTimestamp={showTimestamp}
        onLongPress={handleMessageLongPress}
      />
    );
  }, [user?.id, messages, handleMessageLongPress, handleOpeningMoveReply]);

  const renderListFooter = useCallback(() => {
    if (!isTyping) return null;
    return <TypingIndicator name={profile.name} />;
  }, [isTyping, profile.name]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View
        entering={FadeInDown}
        style={[styles.header, { paddingTop: insets.top }]}
      >
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </Pressable>

        <Pressable style={styles.profileInfo} onPress={handleProfilePress}>
          {profile.photos[0] ? (
            <Image source={{ uri: profile.photos[0] }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={22} color={colors.textSecondary} />
            </View>
          )}
          <View style={styles.profileText}>
            <Text style={styles.profileName}>{profile.name}</Text>
            <Text style={[styles.profileStatus, !onlineStatus.isOnline && styles.profileStatusOffline]}>
              {onlineStatus.text}
            </Text>
          </View>
        </Pressable>

        <Pressable style={styles.headerButton} onPress={handleMenu}>
          <Ionicons name="ellipsis-vertical" size={22} color={colors.text} />
        </Pressable>
      </Animated.View>

      {/* Messages + Input */}
      <View style={styles.keyboardView}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={renderListFooter}
          ListEmptyComponent={
            <Animated.View entering={FadeIn} style={styles.emptyChat}>
              <View style={styles.emptyChatBubble}>
                <Ionicons name="chatbubbles" size={40} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyChatText}>
                Say hello to {profile.name}!{'\n'}
                Start a conversation and get to know each other.
              </Text>
            </Animated.View>
          }
        />

        {/* Input */}
        <Animated.View
          style={[styles.inputContainer, inputAnimatedStyle]}
        >
          {/* Image preview strip */}
          {pendingImage && (
            <View style={styles.imagePreviewStrip}>
              <Image source={{ uri: pendingImage }} style={styles.imagePreviewThumb} />
              {imageUploading && (
                <View style={styles.imagePreviewOverlay}>
                  <Text style={styles.imagePreviewUploading}>Sending...</Text>
                </View>
              )}
              {!imageUploading && (
                <Pressable
                  style={styles.imagePreviewCancel}
                  onPress={() => setPendingImage(null)}
                >
                  <Ionicons name="close-circle" size={22} color={colors.text} />
                </Pressable>
              )}
            </View>
          )}

          <View style={styles.inputRow}>
            {/* Image picker button */}
            <Pressable
              style={styles.imagePickerButton}
              onPress={handlePickImage}
              disabled={imageUploading}
            >
              <Ionicons
                name="image-outline"
                size={24}
                color={imageUploading ? colors.textMuted : colors.textSecondary}
              />
            </Pressable>

            <View style={styles.inputWrapper}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder="Type a message..."
                placeholderTextColor={colors.textMuted}
                value={messageText}
                onChangeText={handleTextChange}
                multiline
                maxLength={1000}
              />
            </View>

            <Pressable
              style={[
                styles.sendButton,
                (messageText.trim() || pendingImage) && styles.sendButtonActive,
              ]}
              onPress={pendingImage ? handleSendImage : handleSend}
              disabled={(!messageText.trim() && !pendingImage) || imageUploading}
            >
              <Ionicons
                name="send"
                size={20}
                color={(messageText.trim() || pendingImage) ? colors.text : colors.textMuted}
              />
            </Pressable>
          </View>
        </Animated.View>

        {/* Animated spacer — grows to keyboard height, pushing content up */}
        <Animated.View style={spacerStyle} />
      </View>

      {/* Menu Modal */}
      <Modal
        visible={showMenuModal}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <Pressable style={styles.modalOverlay} onPress={closeMenu}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{profile.name}</Text>
              <Pressable style={styles.modalCloseButton} onPress={closeMenu}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.modalDivider} />

            {!showMuteOptions ? (
              <>
                {/* Mute / Unmute */}
                <Pressable
                  style={styles.modalOption}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    if (isMuted) {
                      handleUnmuteSelect();
                    } else {
                      setShowMuteOptions(true);
                    }
                  }}
                >
                  <Ionicons
                    name={isMuted ? 'notifications' : 'notifications-off'}
                    size={22}
                    color={colors.text}
                  />
                  <Text style={styles.modalOptionText}>
                    {isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
                  </Text>
                </Pressable>

                {/* Block / Unblock */}
                <Pressable
                  style={styles.modalOption}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    handleBlockSelect();
                  }}
                >
                  <Ionicons
                    name={isBlocked ? 'lock-open' : 'ban'}
                    size={22}
                    color={colors.error}
                  />
                  <Text style={[styles.modalOptionText, { color: colors.error }]}>
                    {isBlocked ? 'Unblock User' : 'Block User'}
                  </Text>
                </Pressable>

                {/* Report */}
                <Pressable
                  style={styles.modalOption}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    handleReportSelect();
                  }}
                >
                  <Ionicons name="flag" size={22} color={colors.warning} />
                  <Text style={[styles.modalOptionText, { color: colors.warning }]}>
                    Report User
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                {/* Mute Duration Options */}
                <Pressable
                  style={styles.modalBackRow}
                  onPress={() => setShowMuteOptions(false)}
                >
                  <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
                  <Text style={styles.modalSubtitle}>Mute for...</Text>
                </Pressable>

                <Pressable
                  style={styles.modalOption}
                  onPress={() => handleMuteSelect(new Date(Date.now() + 60 * 60 * 1000))}
                >
                  <Ionicons name="time-outline" size={22} color={colors.text} />
                  <Text style={styles.modalOptionText}>1 hour</Text>
                </Pressable>

                <Pressable
                  style={styles.modalOption}
                  onPress={() => handleMuteSelect(new Date(Date.now() + 8 * 60 * 60 * 1000))}
                >
                  <Ionicons name="time-outline" size={22} color={colors.text} />
                  <Text style={styles.modalOptionText}>8 hours</Text>
                </Pressable>

                <Pressable
                  style={styles.modalOption}
                  onPress={() => handleMuteSelect(new Date(Date.now() + 24 * 60 * 60 * 1000))}
                >
                  <Ionicons name="time-outline" size={22} color={colors.text} />
                  <Text style={styles.modalOptionText}>24 hours</Text>
                </Pressable>

                <Pressable
                  style={styles.modalOption}
                  onPress={() => handleMuteSelect(null)}
                >
                  <Ionicons name="volume-mute" size={22} color={colors.text} />
                  <Text style={styles.modalOptionText}>Until I unmute</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Report Modal */}
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        reportedUserId={profile.id}
        reportedUserName={profile.name}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.xs,
  },
  profileInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: spacing.sm,
  },
  avatarPlaceholder: {
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileText: {
    flex: 1,
  },
  profileName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  profileStatus: {
    fontSize: fontSize.sm,
    color: colors.success,
  },
  profileStatusOffline: {
    color: colors.textMuted,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardView: {
    flex: 1,
  },
  messagesContainer: {
    padding: spacing.md,
    flexGrow: 1,
  },
  emptyChat: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyChatBubble: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyChatText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  inputContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  imagePreviewStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: spacing.sm,
  },
  imagePreviewThumb: {
    width: 60,
    height: 80,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
  },
  imagePreviewOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 60,
    height: 80,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreviewUploading: {
    fontSize: fontSize.xs,
    color: colors.text,
    fontWeight: fontWeight.medium,
  },
  imagePreviewCancel: {
    marginLeft: spacing.sm,
  },
  imagePickerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.background,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginRight: spacing.sm,
    minHeight: 44,
    maxHeight: 120,
  },
  input: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
    paddingVertical: spacing.sm,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.cardLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  modalOptionText: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: fontWeight.medium,
  },
  modalBackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  modalSubtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
});
