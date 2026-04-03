import React, { useState, useEffect, useCallback } from 'react';
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

// Background image
const bgImage = require('../../../assets/lesbo.png');

type AuthStackParamList = {
  Login: undefined;
};

type NavigationProp = NativeStackNavigationProp<AuthStackParamList>;

// Static Background Component
const StaticBackground: React.FC = () => {
  return (
    <View style={styles.backgroundContainer}>
      <Image
        source={bgImage}
        style={styles.backgroundImage}
        resizeMode="cover"
      />

      {/* Dark overlay */}
      <View style={styles.grayscaleOverlay} />
      <LinearGradient
        colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)']}
        locations={[0, 0.3, 0.6, 1]}
        style={styles.vignetteOverlay}
      />

      {/* Radial vignette effect */}
      <View style={styles.radialVignette} />
    </View>
  );
};

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { googleLogin, isLoading } = useAuth();
  const { signIn, isConfigured, isSigningIn } = useGoogleAuth();
  const { userLocation } = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const logoScale = useSharedValue(1);

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

  return (
    <View style={styles.container}>
      {/* Background */}
      <StaticBackground />

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
    </View>
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
  backgroundImage: {
    position: 'absolute',
    top: -80,
    left: -40,
    width: SCREEN_WIDTH + 40,
    height: SCREEN_HEIGHT + 80,
  },
  grayscaleOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    // Note: True grayscale would need a custom filter, this is a dark overlay approximation
  },
  vignetteOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  radialVignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    borderWidth: 100,
    borderColor: 'rgba(0,0,0,0.3)',
    borderRadius: SCREEN_WIDTH,
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
