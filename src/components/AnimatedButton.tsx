import React, { useCallback } from 'react';
import {
  StyleSheet,
  Text,
  Pressable,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, borderRadius, fontSize, fontWeight, spacing } from '../theme';

interface AnimatedButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
  fullWidth = false,
}) => {
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const handlePressIn = useCallback(() => {
    opacity.value = 0.7;
  }, []);

  const handlePressOut = useCallback(() => {
    opacity.value = 1;
  }, []);

  const handlePress = useCallback(() => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  }, [disabled, loading, onPress]);

  const sizeStyles = {
    small: {
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
      minHeight: 40,
    },
    medium: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      minHeight: 52,
    },
    large: {
      paddingVertical: spacing.md + 4,
      paddingHorizontal: spacing.xl,
      minHeight: 60,
    },
  };

  const textSizeStyles = {
    small: { fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.4 },
    medium: { fontSize: fontSize.lg, lineHeight: fontSize.lg * 1.4 },
    large: { fontSize: fontSize.xl, lineHeight: fontSize.xl * 1.4 },
  };

  const renderContent = () => (
    <>
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? colors.primary : colors.text}
          size="small"
        />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.text,
              textSizeStyles[size],
              variant === 'outline' && styles.outlineText,
              variant === 'ghost' && styles.ghostText,
              variant === 'secondary' && styles.secondaryText,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </>
  );

  if (variant === 'primary') {
    return (
      <AnimatedPressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={disabled || loading}
        style={[animatedStyle, fullWidth && styles.fullWidth, style]}
      >
        <LinearGradient
          colors={disabled ? [colors.textMuted, colors.textMuted] : [colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.button,
            sizeStyles[size],
            disabled && styles.disabled,
          ]}
        >
          {renderContent()}
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled || loading}
      style={[
        animatedStyle,
        styles.button,
        sizeStyles[size],
        variant === 'secondary' && styles.secondary,
        variant === 'outline' && styles.outline,
        variant === 'ghost' && styles.ghost,
        disabled && styles.disabled,
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {renderContent()}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.xl,
    gap: spacing.sm,
  },
  fullWidth: {
    width: '100%',
  },
  text: {
    color: colors.text,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  secondary: {
    backgroundColor: colors.card,
  },
  secondaryText: {
    color: colors.text,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  outlineText: {
    color: colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  ghostText: {
    color: colors.primary,
  },
  disabled: {
    opacity: 0.5,
  },
});
