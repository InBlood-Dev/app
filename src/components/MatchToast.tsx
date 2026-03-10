import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, Image, Pressable, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, fontSize, fontWeight, spacing, borderRadius, shadows } from '../theme';
import { MatchToastData } from '../types';

interface MatchToastProps {
  visible: boolean;
  matchData: MatchToastData | null;
  onDismiss: () => void;
  onPress: () => void;
}

const AUTO_DISMISS_MS = 4000;

export const MatchToast: React.FC<MatchToastProps> = ({ visible, matchData, onDismiss, onPress }) => {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-140);
  const heartScale = useSharedValue(1);
  const dismissTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (visible && matchData) {
      // Slide in
      translateY.value = withSpring(0, { damping: 18, stiffness: 140 });

      // Pulse heart icon
      heartScale.value = withDelay(
        300,
        withRepeat(
          withSequence(
            withTiming(1.25, { duration: 400 }),
            withTiming(1, { duration: 400 })
          ),
          3,
          true
        )
      );

      // Haptic
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Auto-dismiss
      dismissTimer.current = setTimeout(() => {
        dismiss();
      }, AUTO_DISMISS_MS);
    } else {
      // Slide out
      translateY.value = withTiming(-140, { duration: 250 });
    }

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [visible, matchData]);

  const dismiss = () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    translateY.value = withTiming(-140, { duration: 250 }, () => {
      runOnJS(onDismiss)();
    });
  };

  const handlePress = () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    translateY.value = withTiming(-140, { duration: 200 }, () => {
      runOnJS(onPress)();
    });
  };

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  if (!matchData) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { paddingTop: insets.top + spacing.xs },
        containerStyle,
      ]}
    >
      <Pressable style={styles.toast} onPress={handlePress}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <Image source={{ uri: matchData.photo }} style={styles.avatar} />
          <View style={styles.avatarGlow} />
        </View>

        {/* Text */}
        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>It's a Match!</Text>
            <Animated.View style={heartStyle}>
              <Ionicons name="heart" size={14} color={colors.primary} />
            </Animated.View>
          </View>
          <Text style={styles.subtitle} numberOfLines={1}>
            {matchData.name} liked you too!
          </Text>
        </View>

        {/* Arrow */}
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(229, 57, 53, 0.25)',
    gap: spacing.sm + 2,
    ...shadows.lg,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  avatarGlow: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(229, 57, 53, 0.3)',
  },
  textContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 1,
  },
});
