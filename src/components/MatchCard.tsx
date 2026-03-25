import React, { useCallback } from 'react';
import { StyleSheet, View, Text, Image, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInRight,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Match } from '../types';
import { colors, borderRadius, fontSize, fontWeight, spacing, shadows } from '../theme';
import { isUserOnline } from '../utils/timeUtils';

interface MatchCardProps {
  match: Match;
  onPress: () => void;
  index?: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const MatchCard: React.FC<MatchCardProps> = ({ match, onPress, index = 0 }) => {
  const scale = useSharedValue(1);
  const online = isUserOnline(match.profile.lastActive);

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

  const formatLastMessage = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'Just now';
  };

  return (
    <AnimatedPressable
      entering={FadeInRight.delay(index * 100).duration(300)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={[styles.container, shadows.sm, animatedStyle]}
    >
      <View style={styles.avatarContainer}>
        {match.profile.photos[0] ? (
          <Image
            source={{ uri: match.profile.photos[0] }}
            style={styles.avatar}
          />
        ) : (
          <View style={[styles.avatar, { backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="person" size={22} color={colors.textMuted} />
          </View>
        )}
        {online && <View style={styles.avatarOnlineDot} />}
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={1}>
            {match.profile.name}, {match.profile.age}
          </Text>
          {match.lastMessage && (
            <Text style={styles.time}>
              {formatLastMessage(match.lastMessage.timestamp)}
            </Text>
          )}
        </View>

        {match.lastMessage ? (
          <Text style={styles.lastMessage} numberOfLines={1}>
            {match.lastMessage.text}
          </Text>
        ) : (
          <Text style={styles.newMatch}>New match! Say hello 👋</Text>
        )}
      </View>

      {match.unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{match.unreadCount}</Text>
        </View>
      )}
    </AnimatedPressable>
  );
};

// Circular match preview for new matches section
export const NewMatchBubble: React.FC<{ match: Match; onPress: () => void }> = ({
  match,
  onPress,
}) => {
  const scale = useSharedValue(1);
  const online = isUserOnline(match.profile.lastActive);

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
      style={[styles.bubbleContainer, animatedStyle]}
    >
      <View style={styles.bubbleImageContainer}>
        {match.profile.photos[0] ? (
          <Image
            source={{ uri: match.profile.photos[0] }}
            style={styles.bubbleImage}
          />
        ) : (
          <View style={[styles.bubbleImage, { backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="person" size={24} color={colors.textMuted} />
          </View>
        )}
        {online && <View style={styles.onlineDot} />}
      </View>
      <Text style={styles.bubbleName} numberOfLines={1}>
        {match.profile.name}
      </Text>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
  },
  avatarOnlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.card,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  name: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    flex: 1,
  },
  time: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  lastMessage: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  newMatch: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    marginLeft: spacing.sm,
  },
  badgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  bubbleContainer: {
    alignItems: 'center',
    marginRight: spacing.md,
    width: 72,
  },
  bubbleImageContainer: {
    position: 'relative',
  },
  bubbleImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.background,
  },
  bubbleName: {
    fontSize: fontSize.sm,
    color: colors.text,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});
