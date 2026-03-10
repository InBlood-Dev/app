import React, { useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  Dimensions,
  Pressable,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  withDelay,
  Easing,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { AnimatedButton } from '../../components';
import { Match } from '../../types';
import { useMatches, useUser } from '../../context';
import { colors, fontSize, fontWeight, spacing, borderRadius, shadows } from '../../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type RootStackParamList = {
  MatchScreen: { match: Match };
  ChatScreen: { matchId: string; conversationId: string; profile: any };
  Discover: undefined;
};

type MatchScreenRouteProp = RouteProp<RootStackParamList, 'MatchScreen'>;

// Sparkle particle component
const Sparkle: React.FC<{ delay: number; x: number; y: number; size: number }> = ({ delay, x, y, size }) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: 300 }),
        withDelay(500, withTiming(0, { duration: 500 }))
      )
    );
    scale.value = withDelay(
      delay,
      withSequence(
        withSpring(1, { damping: 8, stiffness: 150 }),
        withDelay(300, withTiming(0.5, { duration: 500 }))
      )
    );
    translateY.value = withDelay(
      delay,
      withTiming(-30, { duration: 1300, easing: Easing.out(Easing.cubic) })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.sparkle, { left: x, top: y }, animatedStyle]}>
      <Ionicons name="sparkles" size={size} color="#FFD700" />
    </Animated.View>
  );
};

// Floating heart particle
const FloatingHeart: React.FC<{ delay: number; startX: number; duration: number; size: number }> = ({
  delay,
  startX,
  duration,
  size,
}) => {
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);
  const rotation = useSharedValue(0);
  const scale = useSharedValue(0.5);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withTiming(-100, { duration, easing: Easing.out(Easing.quad) })
    );
    translateX.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(30, { duration: duration / 3, easing: Easing.inOut(Easing.sin) }),
          withTiming(-30, { duration: duration / 3, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: duration / 3, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      )
    );
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(0.8, { duration: 400 }),
        withDelay(duration - 1000, withTiming(0, { duration: 600 }))
      )
    );
    rotation.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(20, { duration: duration / 4 }),
          withTiming(-20, { duration: duration / 2 }),
          withTiming(0, { duration: duration / 4 })
        ),
        -1,
        true
      )
    );
    scale.value = withDelay(
      delay,
      withSequence(
        withSpring(1, { damping: 10 }),
        withDelay(duration - 800, withTiming(0.3, { duration: 500 }))
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.floatingHeart, { left: startX }, animatedStyle]}>
      <Ionicons name="heart" size={size} color={colors.primary} />
    </Animated.View>
  );
};

// Ring pulse animation
const PulseRing: React.FC<{ delay: number; size: number }> = ({ delay, size }) => {
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0.8);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.5, { duration: 1500, easing: Easing.out(Easing.cubic) }),
          withTiming(0.5, { duration: 0 })
        ),
        -1,
        false
      )
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0, { duration: 1500 }),
          withTiming(0.8, { duration: 0 })
        ),
        -1,
        false
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.pulseRing, { width: size, height: size, borderRadius: size / 2 }, animatedStyle]} />
  );
};

export const MatchScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<MatchScreenRouteProp>();
  const insets = useSafeAreaInsets();
  const { dismissMatchNotification } = useMatches();
  const { user } = useUser();

  const { match } = route.params;

  // Animation values
  const mainScale = useSharedValue(0);
  const photo1X = useSharedValue(-200);
  const photo2X = useSharedValue(200);
  const photo1Rotate = useSharedValue(-30);
  const photo2Rotate = useSharedValue(30);
  const heartScale = useSharedValue(0);
  const heartRotate = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(30);
  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.8);
  const bgPulse = useSharedValue(0);

  // Generate sparkles
  const sparkles = React.useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      id: i,
      delay: 800 + i * 100,
      x: SCREEN_WIDTH / 2 - 80 + Math.random() * 160,
      y: SCREEN_HEIGHT * 0.3 - 50 + Math.random() * 100,
      size: 12 + Math.random() * 12,
    }));
  }, []);

  // Generate floating hearts
  const floatingHearts = React.useMemo(() => {
    return Array.from({ length: 15 }, (_, i) => ({
      id: i,
      delay: 500 + Math.random() * 2000,
      startX: Math.random() * SCREEN_WIDTH,
      duration: 4000 + Math.random() * 3000,
      size: 14 + Math.random() * 18,
    }));
  }, []);

  useEffect(() => {
    // Haptic feedback sequence
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, 300);

    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, 600);

    // Background pulse
    bgPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Photos slide in
    photo1X.value = withDelay(100, withSpring(0, { damping: 14, stiffness: 90 }));
    photo2X.value = withDelay(100, withSpring(0, { damping: 14, stiffness: 90 }));
    photo1Rotate.value = withDelay(100, withSpring(-12, { damping: 12, stiffness: 80 }));
    photo2Rotate.value = withDelay(100, withSpring(12, { damping: 12, stiffness: 80 }));

    // Heart bounce in
    heartScale.value = withDelay(
      400,
      withSequence(
        withSpring(1.3, { damping: 6, stiffness: 150 }),
        withSpring(1, { damping: 10, stiffness: 100 })
      )
    );

    // Heart subtle rotation
    heartRotate.value = withDelay(
      600,
      withRepeat(
        withSequence(
          withTiming(5, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(-5, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );

    // Text fade in
    textOpacity.value = withDelay(700, withTiming(1, { duration: 500 }));
    textTranslateY.value = withDelay(700, withSpring(0, { damping: 15, stiffness: 100 }));

    // Glow effect
    glowOpacity.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(0.6, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 1200, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
    glowScale.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(1.1, { duration: 1200 }),
          withTiming(0.9, { duration: 1200 })
        ),
        -1,
        true
      )
    );
  }, []);

  const photo1AnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: photo1X.value },
      { rotate: `${photo1Rotate.value}deg` },
    ],
  }));

  const photo2AnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: photo2X.value },
      { rotate: `${photo2Rotate.value}deg` },
    ],
  }));

  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: heartScale.value },
      { rotate: `${heartRotate.value}deg` },
    ],
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  const bgPulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(bgPulse.value, [0, 1], [0.1, 0.25]),
  }));

  const handleSayHello = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    dismissMatchNotification();
    navigation.replace('ChatScreen', {
      matchId: match.id,
      conversationId: match.conversationId,
      profile: match.profile,
    });
  }, [navigation, match, dismissMatchNotification]);

  const handleKeepSwiping = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dismissMatchNotification();
    navigation.goBack();
  }, [navigation, dismissMatchNotification]);

  return (
    <View style={styles.container}>
      {/* Background Gradient */}
      <LinearGradient
        colors={['#1a0a0a', colors.background, colors.background]}
        locations={[0, 0.4, 1]}
        style={styles.gradient}
      />

      {/* Animated Background Pulse */}
      <Animated.View style={[styles.bgPulse, bgPulseStyle]}>
        <LinearGradient
          colors={[colors.primary, 'transparent']}
          style={styles.bgPulseGradient}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </Animated.View>

      {/* Floating Hearts */}
      {floatingHearts.map(heart => (
        <FloatingHeart
          key={heart.id}
          delay={heart.delay}
          startX={heart.startX}
          duration={heart.duration}
          size={heart.size}
        />
      ))}

      {/* Pulse Rings */}
      <View style={styles.pulseRingsContainer}>
        <PulseRing delay={0} size={250} />
        <PulseRing delay={500} size={250} />
        <PulseRing delay={1000} size={250} />
      </View>

      {/* Sparkles */}
      {sparkles.map(sparkle => (
        <Sparkle
          key={sparkle.id}
          delay={sparkle.delay}
          x={sparkle.x}
          y={sparkle.y}
          size={sparkle.size}
        />
      ))}

      {/* Content */}
      <View style={[styles.content, { paddingTop: insets.top + 20 }]}>
        {/* Close button */}
        <Animated.View entering={FadeIn.delay(1200).duration(400)}>
          <Pressable style={styles.closeButton} onPress={handleKeepSwiping}>
            <Ionicons name="close" size={28} color={colors.text} />
          </Pressable>
        </Animated.View>

        {/* Match Animation */}
        <View style={styles.matchContainer}>
          {/* Photos with Heart */}
          <View style={styles.photosContainer}>
            <Animated.View style={[styles.photoWrapper, styles.photoLeft, photo1AnimatedStyle]}>
              <LinearGradient
                colors={['rgba(229, 57, 53, 0.3)', 'rgba(229, 57, 53, 0)']}
                style={styles.photoGlow}
              />
              <Image
                source={{ uri: user?.photos?.[0] || 'https://images.unsplash.com/photo-1618077360395-f3068be8e001?w=200&h=200&fit=crop' }}
                style={styles.photo}
              />
            </Animated.View>

            <Animated.View style={[styles.heartWrapper, heartAnimatedStyle]}>
              <View style={styles.logoContainer}>
                <Image
                  source={require('../../assets/images/logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
            </Animated.View>

            <Animated.View style={[styles.photoWrapper, styles.photoRight, photo2AnimatedStyle]}>
              <LinearGradient
                colors={['rgba(229, 57, 53, 0.3)', 'rgba(229, 57, 53, 0)']}
                style={styles.photoGlow}
              />
              <Image
                source={{ uri: match.profile.photos[0] }}
                style={styles.photo}
              />
            </Animated.View>
          </View>

          {/* Match Text */}
          <Animated.View style={[styles.textContainer, textAnimatedStyle]}>
            <Text style={styles.matchTitle}>It's a Match!</Text>
            <Text style={styles.matchSubtitle}>
              You and {match.profile.name} liked each other
            </Text>

            {/* Match percentage */}
            {match.profile.matchPercentage && (
              <View style={styles.matchPercentContainer}>
                <LinearGradient
                  colors={['rgba(229, 57, 53, 0.2)', 'rgba(229, 57, 53, 0.1)']}
                  style={styles.matchPercentGradient}
                >
                  <Text style={styles.matchPercent}>{match.profile.matchPercentage}%</Text>
                  <Text style={styles.matchPercentLabel}>Compatibility</Text>
                </LinearGradient>
              </View>
            )}
          </Animated.View>
        </View>

        {/* Buttons */}
        <Animated.View
          entering={FadeInUp.delay(1000).duration(500).springify()}
          style={[styles.buttonsContainer, { paddingBottom: insets.bottom + spacing.lg }]}
        >
          <AnimatedButton
            title="Say Hello"
            onPress={handleSayHello}
            fullWidth
            size="large"
            icon={<Ionicons name="chatbubble" size={20} color={colors.text} />}
          />
          <Pressable style={styles.keepSwipingButton} onPress={handleKeepSwiping}>
            <Text style={styles.keepSwipingText}>Keep Swiping</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  bgPulse: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.5,
  },
  bgPulseGradient: {
    flex: 1,
  },
  pulseRingsContainer: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.32,
    left: SCREEN_WIDTH / 2 - 125,
    width: 250,
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  sparkle: {
    position: 'absolute',
    zIndex: 10,
  },
  floatingHeart: {
    position: 'absolute',
    bottom: 0,
    zIndex: 1,
  },
  content: {
    flex: 1,
    zIndex: 5,
  },
  closeButton: {
    position: 'absolute',
    top: 0,
    right: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  matchContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    marginTop: -spacing.xxl,
  },
  photosContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  photoWrapper: {
    position: 'relative',
    ...shadows.lg,
  },
  photoLeft: {
    zIndex: 1,
    marginRight: -30,
  },
  photoRight: {
    zIndex: 1,
    marginLeft: -30,
  },
  photoGlow: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: borderRadius.xl + 10,
  },
  photo: {
    width: 140,
    height: 180,
    borderRadius: borderRadius.xl,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  heartWrapper: {
    position: 'absolute',
    zIndex: 3,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.text,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  logoImage: {
    width: 40,
    height: 40,
    tintColor: colors.text,
  },
  textContainer: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  matchTitle: {
    fontSize: 48,
    fontWeight: fontWeight.black,
    color: colors.text,
    marginBottom: spacing.sm,
    textShadowColor: 'rgba(229, 57, 53, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  matchSubtitle: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  matchPercentContainer: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  matchPercentGradient: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(229, 57, 53, 0.3)',
  },
  matchPercent: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  matchPercentLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  buttonsContainer: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  keepSwipingButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  keepSwipingText: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
});
