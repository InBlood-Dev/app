import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Dimensions, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withDelay,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SplashScreenProps {
  onFinish: () => void;
  shouldDismiss?: boolean;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish, shouldDismiss }) => {
  const scale = useSharedValue(0.3);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(50);
  const rotate = useSharedValue(0);
  const hasDismissed = useRef(false);

  useEffect(() => {
    // Initial fade in and scale up
    opacity.value = withTiming(1, { duration: 400 });
    translateY.value = withSpring(0, { damping: 12, stiffness: 100 });

    // Bouncing animation sequence
    scale.value = withSequence(
      withSpring(1.2, { damping: 8, stiffness: 150 }),
      withSpring(0.9, { damping: 8, stiffness: 150 }),
      withSpring(1.1, { damping: 10, stiffness: 150 }),
      withSpring(0.95, { damping: 10, stiffness: 150 }),
      withSpring(1, { damping: 15, stiffness: 200 }),
    );

    // Subtle rotation for playfulness
    rotate.value = withSequence(
      withTiming(-5, { duration: 150 }),
      withTiming(5, { duration: 150 }),
      withTiming(-3, { duration: 150 }),
      withTiming(3, { duration: 150 }),
      withTiming(0, { duration: 150 }),
    );
  }, []);

  // External dismiss control: fade out when shouldDismiss becomes true
  useEffect(() => {
    if (shouldDismiss && !hasDismissed.current) {
      hasDismissed.current = true;
      opacity.value = withTiming(0, { duration: 300 }, () => {
        runOnJS(onFinish)();
      });
      scale.value = withTiming(0.8, { duration: 300 });
    }
  }, [shouldDismiss]);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.background, '#1a0505', colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Animated glow effect */}
        <Animated.View style={[styles.glowContainer, logoAnimatedStyle]}>
          <View style={styles.glowOuter} />
          <View style={styles.glowInner} />
        </Animated.View>

        {/* Logo */}
        <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Pulsing rings */}
        <PulsingRings />
      </LinearGradient>
    </View>
  );
};

const PulsingRings: React.FC = () => {
  const ring1Scale = useSharedValue(1);
  const ring1Opacity = useSharedValue(0.5);
  const ring2Scale = useSharedValue(1);
  const ring2Opacity = useSharedValue(0.3);
  const ring3Scale = useSharedValue(1);
  const ring3Opacity = useSharedValue(0.2);

  useEffect(() => {
    const animateRing = (scaleVal: any, opacityVal: any, delay: number) => {
      scaleVal.value = withDelay(
        delay,
        withSequence(
          withTiming(1.8, { duration: 1500, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 0 })
        )
      );
      opacityVal.value = withDelay(
        delay,
        withSequence(
          withTiming(0, { duration: 1500, easing: Easing.out(Easing.ease) }),
          withTiming(0.5, { duration: 0 })
        )
      );
    };

    animateRing(ring1Scale, ring1Opacity, 0);
    animateRing(ring2Scale, ring2Opacity, 300);
    animateRing(ring3Scale, ring3Opacity, 600);
  }, []);

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring1Scale.value }],
    opacity: ring1Opacity.value,
  }));

  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring2Scale.value }],
    opacity: ring2Opacity.value,
  }));

  const ring3Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring3Scale.value }],
    opacity: ring3Opacity.value,
  }));

  return (
    <>
      <Animated.View style={[styles.ring, ring1Style]} />
      <Animated.View style={[styles.ring, ring2Style]} />
      <Animated.View style={[styles.ring, ring3Style]} />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: 150,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  logo: {
    width: 140,
    height: 140,
  },
  glowContainer: {
    position: 'absolute',
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowOuter: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.primary,
    opacity: 0.15,
  },
  glowInner: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.primary,
    opacity: 0.2,
  },
  ring: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 2,
    borderColor: colors.primary,
  },
});
