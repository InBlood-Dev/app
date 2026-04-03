import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Asset } from 'expo-asset';
import {
  StyleSheet,
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  Image,
  Alert,
  Dimensions,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { AnimatedButton } from '../../components';
import { useAuth, useLocation } from '../../context';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';
import { TermsModal } from '../../components/modals/TermsModal';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const COL_COUNT = 3;
const COL_GAP = 8;
const SIDE_PAD = 8;
const COL_WIDTH = (SCREEN_WIDTH - SIDE_PAD * 2 - COL_GAP * (COL_COUNT - 1)) / COL_COUNT;
const IMAGE_HEIGHT = COL_WIDTH * 1.45;
const ROW_GAP = 8;

// Local marquee images
import { ImageSourcePropType } from 'react-native';

const img1 = require('../../../assets/marquee1.png');
const img2 = require('../../../assets/marquee2.png');
const img3 = require('../../../assets/marquee3.png');
const img4 = require('../../../assets/marquee4.png');
const img5 = require('../../../assets/marquee5.png');
const img6 = require('../../../assets/marquee6.png');
const img7 = require('../../../assets/marquee7.png');
const img8 = require('../../../assets/marquee8.png');
const img9 = require('../../../assets/marquee9.png');
const img10 = require('../../../assets/marquee10.png');
const img11 = require('../../../assets/marquee11.png');
const img12 = require('../../../assets/marquee12.png');
const img13 = require('../../../assets/marquee13.png');
const img14 = require('../../../assets/marquee14.png');
const img15 = require('../../../assets/marquee15.png');
const img16 = require('../../../assets/marquee16.png');
const img17 = require('../../../assets/marquee17.png');

// 17 images spread across 3 columns (6 each, shuffled)
const MARQUEE_IMAGES: ImageSourcePropType[][] = [
  [img1, img6, img11, img15, img9, img4],
  [img8, img3, img16, img13, img5, img14],
  [img12, img17, img7, img2, img10, img4],
];

// Single marquee column that scrolls continuously
const MarqueeColumn: React.FC<{ images: ImageSourcePropType[]; speed: number; initialOffset: number }> = React.memo(
  ({ images, speed, initialOffset }) => {
    const translateY = useSharedValue(initialOffset);
    // Double images for seamless loop
    const doubledImages = useMemo(() => [...images, ...images], [images]);
    const singleSetHeight = images.length * (IMAGE_HEIGHT + ROW_GAP);

    useEffect(() => {
      translateY.value = initialOffset;
      translateY.value = withRepeat(
        withTiming(initialOffset - singleSetHeight, {
          duration: speed,
          easing: Easing.linear,
        }),
        -1,
        false,
      );
    }, []);

    const animStyle = useAnimatedStyle(() => ({
      transform: [{ translateY: translateY.value }],
    }));

    return (
      <View style={marqueeStyles.columnWrapper}>
        <Animated.View style={animStyle}>
          {doubledImages.map((src, idx) => (
            <Image
              key={`${idx}`}
              source={src}
              style={marqueeStyles.image}
              resizeMode="cover"
            />
          ))}
        </Animated.View>
      </View>
    );
  },
);

// Marquee background with 3 columns
const MarqueeBackground: React.FC = React.memo(() => {
  return (
    <View style={styles.backgroundContainer}>
      <View style={marqueeStyles.columnsRow}>
        <MarqueeColumn images={MARQUEE_IMAGES[0]} speed={25000} initialOffset={0} />
        <MarqueeColumn images={MARQUEE_IMAGES[1]} speed={20000} initialOffset={-IMAGE_HEIGHT * 0.5} />
        <MarqueeColumn images={MARQUEE_IMAGES[2]} speed={28000} initialOffset={-IMAGE_HEIGHT * 0.3} />
      </View>

      {/* Dark overlay for readability */}
      <View style={styles.grayscaleOverlay} />
      <LinearGradient
        colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.97)']}
        locations={[0, 0.25, 0.6, 1]}
        style={styles.vignetteOverlay}
      />
    </View>
  );
});

const marqueeStyles = StyleSheet.create({
  columnsRow: {
    flexDirection: 'row',
    paddingHorizontal: SIDE_PAD,
    gap: COL_GAP,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  columnWrapper: {
    width: COL_WIDTH,
    overflow: 'hidden',
  },
  image: {
    width: COL_WIDTH,
    height: IMAGE_HEIGHT,
    borderRadius: 12,
    marginBottom: ROW_GAP,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
});

type AuthStackParamList = {
  Login: undefined;
};

type NavigationProp = NativeStackNavigationProp<AuthStackParamList>;

// All images to preload
const ALL_IMAGES = [img1, img2, img3, img4, img5, img6, img7, img8, img9, img10, img11, img12, img13, img14, img15, img16, img17];

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { googleLogin, isLoading } = useAuth();
  const { signIn, isConfigured, isSigningIn } = useGoogleAuth();
  const { userLocation } = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);

  const screenOpacity = useSharedValue(0);
  const logoScale = useSharedValue(1);

  // Preload all marquee images, then fade in everything together
  useEffect(() => {
    Asset.loadAsync(ALL_IMAGES).then(() => {
      setAssetsReady(true);
      screenOpacity.value = withTiming(1, { duration: 500 });
    });
  }, []);

  useEffect(() => {
    // Subtle logo pulse animation
    logoScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  const screenAnimatedStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
  }));

  const handleGoogleLogin = useCallback(async () => {
    // Prevent multiple taps
    if (isProcessing || isLoading || isSigningIn) {
      console.log('[LoginScreen] Already processing, ignoring tap');
      return;
    }

    console.log('[LoginScreen] handleGoogleLogin called');
    setIsProcessing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Step 1: Use cached location from LocationContext (if available)
      let location: { latitude: number; longitude: number } | undefined;
      if (userLocation?.latitude && userLocation?.longitude) {
        location = {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        };
        console.log('[LoginScreen] Step 1: Using cached location:', location.latitude, location.longitude);
      } else {
        console.log('[LoginScreen] Step 1: No cached location available');
      }

      // Step 2: Sign in with Google
      console.log('[LoginScreen] Step 2: Calling Google signIn');
      const result = await signIn();

      console.log('[LoginScreen] Step 3: Google signIn result:', result ? 'success' : 'null/cancelled');

      if (result) {
        console.log('[LoginScreen] User info from Google:');
        console.log('[LoginScreen]   - ID:', result.user.id);
        console.log('[LoginScreen]   - Email:', result.user.email);
        console.log('[LoginScreen]   - Name:', result.user.name);

        // Add location to result if available
        const authDataWithLocation = location ? { ...result, location } : result;

        // Pass auth data (user + access token + location) to auth context
        console.log('[LoginScreen] Step 4: Calling googleLogin with auth data', location ? '(with location)' : '(without location)');
        const success = await googleLogin(authDataWithLocation);

        console.log('[LoginScreen] Step 5: googleLogin result:', success ? 'success' : 'failed');

        if (!success) {
          console.log('[LoginScreen] Login failed - showing alert');
          Alert.alert(
            'Login Failed',
            'Unable to sign in with Google. Please try again.',
            [{ text: 'OK' }]
          );
        } else {
          console.log('[LoginScreen] Login successful - navigation will be handled by RootNavigator');
        }
        // Navigation is handled automatically by RootNavigator
        // when isAuthenticated becomes true
      } else {
        console.log('[LoginScreen] Sign-in was cancelled or returned null');
      }
      // If cancelled (result is null), just return to login screen (no error needed)
    } catch (error) {
      console.error('[LoginScreen] Google login error:', error);
      Alert.alert(
        'Error',
        'An unexpected error occurred. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
    }
  }, [signIn, googleLogin, userLocation, isProcessing, isLoading, isSigningIn]);

  const handleDisagreeTerms = useCallback(() => {
    setShowTermsModal(false);
    BackHandler.exitApp();
  }, []);

  if (!assetsReady) {
    return <View style={styles.container} />;
  }

  return (
    <Animated.View style={[styles.container, screenAnimatedStyle]}>
      {/* Background */}
      <MarqueeBackground />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Logo & Brand Section */}
            <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.header}>
              <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
                <LinearGradient
                  colors={['rgba(229, 57, 53, 0.3)', 'rgba(229, 57, 53, 0.1)']}
                  style={styles.logoGlow}
                >
                  <View style={styles.logoInner}>
                    <Image
                      source={require('../../assets/images/logo.png')}
                      style={styles.logo}
                      resizeMode="contain"
                    />
                  </View>
                </LinearGradient>
              </Animated.View>

              <Text style={styles.brandName}>InBlood</Text>
              <Text style={styles.tagline}>Where Hearts Connect</Text>
              <Text style={styles.subTagline}>Find love that runs deep</Text>
            </Animated.View>

            {/* Glass Card for Login */}
            <Animated.View entering={FadeInUp.delay(500).springify()} style={styles.glassCard}>
              {/* Welcome Message */}
              <View style={styles.welcomeContainer}>
                <Text style={styles.welcomeTitle}>Welcome to InBlood</Text>
                <Text style={styles.welcomeSubtitle}>
                  Sign in with Google to find your perfect match
                </Text>
              </View>

              {/* Google Sign In Button */}
              <AnimatedButton
                title="Continue with Google"
                onPress={handleGoogleLogin}
                loading={isProcessing || isLoading || isSigningIn}
                disabled={!isConfigured || isProcessing || isSigningIn}
                fullWidth
                size="large"
                icon={<Ionicons name="logo-google" size={24} color={colors.text} />}
                style={styles.googleButton}
              />

              {/* Info Text */}
              <View style={styles.infoContainer}>
                <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
                <Text style={styles.infoText}>
                  Your data is secure and will never be shared without your permission
                </Text>
              </View>

              {/* Terms Agreement */}
              <View style={styles.termsCheckRow}>
                <Ionicons name="checkbox" size={22} color={colors.primary} />
                <Text style={styles.termsCheckText}>
                  I agree with{' '}
                  <Text
                    style={styles.termsHighlight}
                    onPress={() => setShowTermsModal(true)}
                  >
                    Terms & Conditions
                  </Text>
                </Text>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <TermsModal
        visible={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onDisagree={handleDisagreeTerms}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  grayscaleOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  vignetteOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoContainer: {
    marginBottom: spacing.md,
  },
  logoGlow: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoInner: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(229, 57, 53, 0.5)',
  },
  logo: {
    width: 70,
    height: 70,
  },
  brandName: {
    fontSize: 42,
    fontWeight: fontWeight.bold,
    color: colors.text,
    letterSpacing: -1,
    textShadowColor: 'rgba(229, 57, 53, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 20,
  },
  tagline: {
    fontSize: fontSize.xl,
    color: colors.text,
    fontWeight: fontWeight.medium,
    marginTop: spacing.xs,
    letterSpacing: 1,
  },
  subTagline: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  glassCard: {
    backgroundColor: 'rgba(20, 20, 20, 0.85)',
    borderRadius: borderRadius.xxl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  welcomeContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  welcomeTitle: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  googleButton: {
    marginBottom: spacing.lg,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    lineHeight: 18,
  },
  termsCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  termsCheckText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    lineHeight: 18,
  },
  termsHighlight: {
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
});
