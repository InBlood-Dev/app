/**
 * Story thumbnail card component
 * Displays a story preview with view count and expiry countdown
 */

import React from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Story } from '../../types';
import { formatStoryExpiry } from '../../utils/timeUtils';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - spacing.lg * 2 - spacing.md) / 2;
const CARD_HEIGHT = CARD_WIDTH * (16 / 9); // 9:16 aspect ratio

interface StoryThumbnailCardProps {
  story: Story;
  onPress: () => void;
  onLongPress: () => void;
}

export const StoryThumbnailCard: React.FC<StoryThumbnailCardProps> = ({
  story,
  onPress,
  onLongPress,
}) => {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const expiryText = formatStoryExpiry(story.expires_at);
  const isExpired = expiryText === 'Expired';

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLongPress={handleLongPress}
        style={styles.card}
      >
        {/* Story Image */}
        <Image
          source={{ uri: story.thumbnail_url || story.media_url }}
          style={styles.image}
          resizeMode="cover"
        />

        {/* Glassmorphic overlay at bottom */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.6)']}
          style={styles.bottomGradient}
        >
          {/* Expiry Countdown */}
          <View style={styles.expiryBadge}>
            <Ionicons name="time-outline" size={14} color={colors.text} />
            <Text style={[styles.expiryText, isExpired && styles.expiredText]}>
              {expiryText}
            </Text>
          </View>
        </LinearGradient>

        {/* View Count Badge (top-right) */}
        <View style={styles.viewCountBadge}>
          <Ionicons name="eye" size={14} color={colors.text} />
          <Text style={styles.viewCountText}>
            {story.view_count}
          </Text>
        </View>

        {/* Expired Overlay */}
        {isExpired && (
          <View style={styles.expiredOverlay}>
            <Ionicons name="time-outline" size={32} color={colors.text} />
            <Text style={styles.expiredLabel}>Expired</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
  },
  card: {
    width: '100%',
    height: CARD_HEIGHT,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  image: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    justifyContent: 'flex-end',
    padding: spacing.sm,
  },
  expiryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  expiryText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semiBold,
    color: colors.text,
  },
  expiredText: {
    color: colors.primary,
  },
  viewCountBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
  },
  viewCountText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semiBold,
    color: colors.text,
  },
  expiredOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  expiredLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
});

export default StoryThumbnailCard;
