import React, { useCallback, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useMatches, useChat, useUser } from '../../context';
import { Match } from '../../types';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type RootStackParamList = {
  MatchesList: undefined;
  ChatScreen: { matchId: string; conversationId: string; profile: any };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Section header component
const SectionHeader: React.FC<{
  title: string;
  count?: number;
}> = ({ title, count }) => {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>
        {title}
        {count !== undefined && count > 0 && (
          <Text style={styles.sectionHeaderCount}> ({count})</Text>
        )}
      </Text>
    </View>
  );
};

// Pinned card component (first card with heart/likes)
const LikesCard: React.FC<{ likesCount: number; onPress: () => void }> = ({
  likesCount,
  onPress,
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.95, { damping: 10, stiffness: 400 });
  }, []);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 10, stiffness: 400 });
  }, []);

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      style={[styles.pinnedCard, styles.likesCard, animatedStyle]}
    >
      <LinearGradient
        colors={['#FF6B6B', '#E53935']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.likesGradient}
      >
        <View style={styles.likesIconContainer}>
          <Ionicons name="heart" size={32} color="#FFFFFF" />
        </View>
        <Text style={styles.likesCount}>{likesCount}</Text>
        <Text style={styles.likesLabel}>Likes</Text>
      </LinearGradient>
    </AnimatedPressable>
  );
};

// Pinned profile card component
const PinnedProfileCard: React.FC<{
  match: Match;
  onPress: () => void;
  index: number;
}> = ({ match, onPress, index }) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.95, { damping: 10, stiffness: 400 });
  }, []);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 10, stiffness: 400 });
  }, []);

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      style={[styles.pinnedCard, animatedStyle]}
    >
      {match.profile.photos[0] ? (
        <Image
          source={{ uri: match.profile.photos[0] }}
          style={styles.pinnedImage}
        />
      ) : (
        <View style={styles.pinnedImagePlaceholder}>
          <Ionicons name="person" size={36} color={colors.textSecondary} />
        </View>
      )}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        style={styles.pinnedGradient}
      >
        <Text style={styles.pinnedName} numberOfLines={1}>
          {match.profile.name}
        </Text>
      </LinearGradient>
    </AnimatedPressable>
  );
};

// Chat item component
const ChatItem: React.FC<{
  match: Match;
  onPress: () => void;
  onLongPress?: () => void;
  index: number;
  showNewBadge?: boolean;
}> = ({ match, onPress, onLongPress, index, showNewBadge = false }) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.98, { damping: 10, stiffness: 400 });
  }, []);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 10, stiffness: 400 });
  }, []);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  const handleLongPress = useCallback(() => {
    if (onLongPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onLongPress();
    }
  }, [onLongPress]);

  const formatTime = (date: Date) => {
    if (!date || isNaN(date.getTime())) return '';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return 'Now';
  };

  const hasUnread = match.unreadCount > 0;

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={500}
      style={[styles.chatItem, hasUnread && styles.chatItemUnread, animatedStyle]}
    >
      <View style={styles.avatarContainer}>
        {match.profile.photos[0] ? (
          <Image
            source={{ uri: match.profile.photos[0] }}
            style={[styles.chatAvatar, hasUnread && styles.chatAvatarUnread]}
          />
        ) : (
          <View style={[styles.chatAvatar, styles.avatarPlaceholder, hasUnread && styles.chatAvatarUnread]}>
            <Ionicons name="person" size={28} color={colors.textSecondary} />
          </View>
        )}
        {showNewBadge && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>NEW</Text>
          </View>
        )}
      </View>

      <View style={styles.chatContent}>
        <View style={styles.chatNameRow}>
          <Text style={[styles.chatName, hasUnread && styles.chatNameUnread]} numberOfLines={1}>
            {match.profile.name}
          </Text>
          {match.isPinned && (
            <Ionicons name="pin" size={14} color={colors.primary} style={styles.pinIcon} />
          )}
        </View>
        <Text style={[styles.chatMessage, hasUnread && styles.chatMessageUnread]} numberOfLines={1}>
          {match.lastMessage?.text || 'Say hello! 👋'}
        </Text>
      </View>

      <View style={styles.chatMeta}>
        {match.lastMessage && (
          <Text style={[styles.chatTime, hasUnread && styles.chatTimeUnread]}>
            {formatTime(match.lastMessage.timestamp)}
          </Text>
        )}
        {hasUnread && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>
              {match.unreadCount > 9 ? '9+' : match.unreadCount}
            </Text>
          </View>
        )}
      </View>
    </AnimatedPressable>
  );
};

export const MatchesListScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { matches, conversations, fetchMatches, fetchConversations, pinMatch, unpinMatch, fetchPendingLikes } = useMatches();
  const { chats, subscribeToConversationPreviews } = useChat();
  const { user } = useUser();
  const insets = useSafeAreaInsets();

  // Force-refresh matches, conversations, and pending likes every time screen gains focus.
  // fetchConversations pulls GET /conversations which includes non-matched DMs.
  useFocusEffect(
    useCallback(() => {
      fetchMatches(20, 0, true);
      fetchConversations();
      fetchPendingLikes();
    }, [fetchMatches, fetchConversations, fetchPendingLikes])
  );

  // Subscribe to last-message previews for ALL conversations (matched + non-matched)
  useEffect(() => {
    const matchedIds = matches.map(m => m.conversationId || m.id).filter(Boolean);
    const requestIds = conversations.map(c => c.conversationId || c.id).filter(Boolean);
    const allIds = [...new Set([...matchedIds, ...requestIds])];
    if (allIds.length > 0) {
      subscribeToConversationPreviews(allIds);
    }
  }, [matches, conversations, subscribeToConversationPreviews]);

  // Separate conversations into pinned, new matches, regular messages, and message requests
  const { pinnedMatches, newMatches, regularMatches, messageRequests, likesCount } = useMemo(() => {
    const pinned: Match[] = [];
    const newM: Match[] = [];
    const regular: Match[] = [];

    const now = Date.now();
    const oneDayInMs = 24 * 60 * 60 * 1000;

    matches.forEach(match => {
      const chat = chats.get(match.conversationId || match.id);
      const realMessages = chat ? chat.messages.filter(m => m.type !== 'opening_move') : [];
      const hasMessages = realMessages.length > 0;
      const matchTime = match.matchedAt?.getTime?.() || 0;
      const matchAge = now - matchTime;
      const isNew = !hasMessages && matchAge > 0 && matchAge < oneDayInMs;

      const enrichedMatch = {
        ...match,
        lastMessage: hasMessages ? realMessages[realMessages.length - 1] : undefined,
      };

      if (enrichedMatch.isPinned) {
        pinned.push(enrichedMatch);
      } else if (isNew) {
        newM.push(enrichedMatch);
      } else {
        regular.push(enrichedMatch);
      }
    });

    // Build set of matched conversation IDs to exclude from requests.
    // Prevents a conversation from appearing in both "Messages" and "Message Requests"
    // during the brief window when a non-matched conversation becomes a match.
    const matchedConvIds = new Set(
      matches.map(m => m.conversationId || m.id).filter(Boolean)
    );

    // Enrich non-matched conversations with the latest message preview from Firebase,
    // skipping any that have already been promoted to a match.
    const requests: Match[] = conversations
      .filter(conv => !matchedConvIds.has(conv.conversationId || conv.id))
      .map(conv => {
        const chat = chats.get(conv.conversationId || conv.id);
        const realMessages = chat ? chat.messages.filter(m => m.type !== 'opening_move') : [];
        const hasMessages = realMessages.length > 0;
        return {
          ...conv,
          lastMessage: hasMessages
            ? realMessages[realMessages.length - 1]
            : conv.lastMessage,
        };
      });

    // Sort each section by last message time (or match time for new matches)
    const sortByTime = (a: Match, b: Match) => {
      const timeA = a.lastMessage?.timestamp?.getTime?.() || a.matchedAt?.getTime?.() || 0;
      const timeB = b.lastMessage?.timestamp?.getTime?.() || b.matchedAt?.getTime?.() || 0;
      return timeB - timeA;
    };

    pinned.sort(sortByTime);
    newM.sort((a, b) => (b.matchedAt?.getTime?.() || 0) - (a.matchedAt?.getTime?.() || 0));
    regular.sort(sortByTime);
    requests.sort(sortByTime);

    return {
      pinnedMatches: pinned,
      newMatches: newM,
      regularMatches: regular,
      messageRequests: requests,
      likesCount: user?.stats?.likes ?? 0,
    };
  }, [matches, conversations, chats, user?.stats?.likes]);

  const handleMatchPress = useCallback((match: Match) => {
    navigation.navigate('ChatScreen', {
      matchId: match.id,
      conversationId: match.conversationId || match.id,
      profile: match.profile,
    });
  }, [navigation]);

  const handleLikesPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Navigate to likes screen or show premium modal
  }, []);

  const handlePinToggle = useCallback((match: Match) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (match.isPinned) {
      // Unpin the conversation
      unpinMatch(match.id);
    } else {
      // Pin the conversation
      pinMatch(match.id);
    }
  }, [pinMatch, unpinMatch]);

  const hasAnyConversations =
    pinnedMatches.length > 0 ||
    newMatches.length > 0 ||
    regularMatches.length > 0 ||
    messageRequests.length > 0;

  return (
    <View style={styles.container}>
      {/* Red Header Section */}
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.headerGradient}
      >
        <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
          {/* Header Title */}
          <Animated.View entering={FadeInDown.delay(100)} style={styles.header}>
            <Pressable style={styles.backButton}>
              <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.headerTitle}>Messages</Text>
            <View style={styles.headerRight} />
          </Animated.View>

          {/* Pinned Messages Section */}
          <Animated.View entering={FadeIn.delay(200)} style={styles.pinnedSection}>
            <Text style={styles.pinnedTitle}>New Matches</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pinnedContainer}
            >
              {/* Likes Card */}
              <LikesCard likesCount={likesCount} onPress={handleLikesPress} />

              {/* Pinned Profile Cards */}
              {newMatches.slice(0, 5).map((match, index) => (
                <PinnedProfileCard
                  key={match.id}
                  match={match}
                  index={index}
                  onPress={() => handleMatchPress(match)}
                />
              ))}
            </ScrollView>
          </Animated.View>
        </SafeAreaView>
      </LinearGradient>

      {/* Dark Chat List Section (Bottom Sheet Style) */}
      <View style={styles.chatListContainer}>
        {/* Handle Indicator */}
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        {!hasAnyConversations ? (
          <View style={styles.emptyContainer}>
            <Animated.View entering={FadeIn} style={styles.emptyContent}>
              <View style={styles.emptyIcon}>
                <Ionicons name="chatbubbles" size={48} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyText}>
                When you match with someone,{'\n'}start a conversation here!
              </Text>
            </Animated.View>
          </View>
        ) : (
          <ScrollView
            style={styles.chatScrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.chatScrollContent, { paddingBottom: 100 + insets.bottom }]}
          >
            {/* Pinned Section */}
            {pinnedMatches.length > 0 && (
              <>
                <SectionHeader title="Pinned" count={pinnedMatches.length} />
                {pinnedMatches.map((match, index) => (
                  <ChatItem
                    key={match.id}
                    match={match}
                    index={index}
                    onPress={() => handleMatchPress(match)}
                    onLongPress={() => handlePinToggle(match)}
                  />
                ))}
              </>
            )}

            {/* New Matches Section */}
            {newMatches.length > 0 && (
              <>
                <SectionHeader title="New Matches" count={newMatches.length} />
                {newMatches.map((match, index) => (
                  <ChatItem
                    key={match.id}
                    match={match}
                    index={index}
                    showNewBadge
                    onPress={() => handleMatchPress(match)}
                    onLongPress={() => handlePinToggle(match)}
                  />
                ))}
              </>
            )}

            {/* Regular Messages Section */}
            {regularMatches.length > 0 && (
              <>
                <SectionHeader title="Messages" />
                {regularMatches.map((match, index) => (
                  <ChatItem
                    key={match.id}
                    match={match}
                    index={index}
                    onPress={() => handleMatchPress(match)}
                    onLongPress={() => handlePinToggle(match)}
                  />
                ))}
              </>
            )}

            {/* Message Requests Section — non-matched users who initiated a conversation */}
            {messageRequests.length > 0 && (
              <>
                <SectionHeader title="Message Requests" count={messageRequests.length} />
                {messageRequests.map((conv, index) => (
                  <ChatItem
                    key={conv.id}
                    match={conv}
                    index={index}
                    onPress={() => handleMatchPress(conv)}
                  />
                ))}
              </>
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  headerGradient: {
    paddingBottom: spacing.lg,
  },
  headerSafeArea: {
    // flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  pinnedSection: {
    paddingTop: spacing.sm,
  },
  pinnedTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  pinnedContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  pinnedCard: {
    width: 100,
    height: 130,
    borderRadius: borderRadius.lg,
    marginRight: spacing.md,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  likesCard: {
    backgroundColor: 'transparent',
  },
  likesGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
  },
  likesIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  likesCount: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  likesLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  pinnedImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  pinnedImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinnedGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  pinnedName: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  chatListContainer: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    paddingTop: spacing.sm,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  chatScrollView: {
    flex: 1,
  },
  chatScrollContent: {
    paddingHorizontal: spacing.md,
  },
  sectionHeader: {
    paddingVertical: spacing.sm,
    paddingTop: spacing.lg,
  },
  sectionHeaderText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHeaderCount: {
    color: colors.textMuted,
    fontWeight: '500',
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    borderRadius: borderRadius.lg,
  },
  chatItemUnread: {
    backgroundColor: 'rgba(229, 57, 53, 0.06)',
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: spacing.md,
  },
  chatAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  chatAvatarUnread: {
    borderColor: colors.primary,
  },
  avatarPlaceholder: {
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.background,
  },
  newBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  chatContent: {
    flex: 1,
    justifyContent: 'center',
  },
  chatNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: fontSize.lg,
    fontWeight: '500',
    color: colors.text,
    flex: 1,
  },
  chatNameUnread: {
    fontWeight: '700',
  },
  pinIcon: {
    marginLeft: spacing.xs,
    transform: [{ rotate: '45deg' }],
  },
  chatMessage: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  chatMessageUnread: {
    color: colors.text,
    fontWeight: '500',
  },
  chatMeta: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  chatTime: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: 6,
  },
  chatTimeUnread: {
    color: colors.primary,
    fontWeight: '600',
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyContent: {
    alignItems: 'center',
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
