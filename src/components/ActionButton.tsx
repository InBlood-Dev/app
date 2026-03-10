import React, { useCallback } from 'react';
import { StyleSheet, Pressable, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, shadows } from '../theme';

interface ActionButtonProps {
  type: 'pass' | 'like' | 'superLike' | 'undo' | 'chat';
  onPress: () => void;
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  style?: ViewStyle;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const buttonConfig = {
  pass: {
    icon: 'close',
    colors: ['rgba(255, 255, 255, 0.25)', 'rgba(255, 255, 255, 0.15)'],
    iconColor: '#FFFFFF',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  like: {
    icon: 'heart',
    colors: [colors.primary, colors.primaryDark],
    iconColor: colors.text,
    borderColor: 'transparent',
  },
  superLike: {
    icon: 'star',
    colors: [colors.superLike, '#FFA000'],
    iconColor: colors.background,
    borderColor: 'transparent',
  },
  undo: {
    icon: 'arrow-undo',
    colors: ['rgba(255, 255, 255, 0.2)', 'rgba(255, 255, 255, 0.1)'],
    iconColor: colors.info,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  chat: {
    icon: 'chatbubble-ellipses',
    colors: ['#4FC3F7', '#0288D1'],
    iconColor: '#FFFFFF',
    borderColor: 'transparent',
  },
};

const sizeConfig = {
  small: { size: 44, iconSize: 20 },
  medium: { size: 56, iconSize: 26 },
  large: { size: 68, iconSize: 32 },
};

export const ActionButton: React.FC<ActionButtonProps> = ({
  type,
  onPress,
  size = 'medium',
  disabled = false,
  style,
}) => {
  const scale = useSharedValue(1);
  const config = buttonConfig[type];
  const sizeStyle = sizeConfig[size];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.9, { damping: 10, stiffness: 400 });
  }, []);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 10, stiffness: 400 });
  }, []);

  const handlePress = useCallback(() => {
    if (disabled) return;
    Haptics.impactAsync(
      type === 'superLike'
        ? Haptics.ImpactFeedbackStyle.Heavy
        : Haptics.ImpactFeedbackStyle.Medium
    );
    onPress();
  }, [disabled, type, onPress]);

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled}
      style={[
        animatedStyle,
        styles.container,
        { width: sizeStyle.size, height: sizeStyle.size },
        shadows.md,
        disabled && styles.disabled,
        style,
      ]}
    >
      <LinearGradient
        colors={config.colors as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.gradient,
          {
            borderRadius: sizeStyle.size / 2,
            borderWidth: config.borderColor !== 'transparent' ? 1 : 0,
            borderColor: config.borderColor,
          },
        ]}
      >
        <Ionicons
          name={config.icon as any}
          size={sizeStyle.iconSize}
          color={config.iconColor}
        />
      </LinearGradient>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
});
