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
import { useAuth } from '../../context';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Couple images for the background slideshow - Indian couples
const COUPLE_IMAGES = [
  'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=800&h=1200&fit=crop', // Indian couple
  'https://images.unsplash.com/photo-1591604466107-ec97de577aff?w=800&h=1200&fit=crop', // Indian wedding
  'https://images.unsplash.com/photo-1604017011826-d3b4c23f8914?w=800&h=1200&fit=crop', // Indian couple
  'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&h=1200&fit=crop', // Couple silhouette
  'https://images.unsplash.com/photo-1529634806980-85c3dd6d34ac?w=800&h=1200&fit=crop', // Couple
];

type AuthStackParamList = {
  Login: undefined;
};

type NavigationProp = NativeStackNavigationProp<AuthStackParamList>;

// Animated Background Component
const AnimatedBackground: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const opacity1 = useSharedValue(1);
  const opacity2 = useSharedValue(0);
  const scale1 = useSharedValue(1);
  const scale2 = useSharedValue(1.1);
  const [showFirst, setShowFirst] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      if (showFirst) {
        opacity1.value = withTiming(0, { duration: 1000 });
        opacity2.value = withTiming(1, { duration: 1000 });
        scale1.value = withTiming(1.1, { duration: 5000 });
        scale2.value = 1;
        scale2.value = withTiming(1.1, { duration: 5000 });
      } else {
        opacity1.value = withTiming(1, { duration: 1000 });
        opacity2.value = withTiming(0, { duration: 1000 });
        scale2.value = withTiming(1.1, { duration: 5000 });
        scale1.value = 1;
        scale1.value = withTiming(1.1, { duration: 5000 });
      }

      setShowFirst(!showFirst);
      setCurrentIndex((prev) => (prev + 1) % COUPLE_IMAGES.length);
    }, 4000);

    // Start initial zoom
    scale1.value = withTiming(1.1, { duration: 5000 });

    return () => clearInterval(interval);
  }, [showFirst]);

  const animatedStyle1 = useAnimatedStyle(() => ({
    opacity: opacity1.value,
    transform: [{ scale: scale1.value }],
  }));

  const animatedStyle2 = useAnimatedStyle(() => ({
    opacity: opacity2.value,
    transform: [{ scale: scale2.value }],
  }));

  const nextIndex = (currentIndex + 1) % COUPLE_IMAGES.length;

  return (
    <View style={styles.backgroundContainer}>
      <Animated.Image
        source={{ uri: COUPLE_IMAGES[currentIndex] }}
        style={[styles.backgroundImage, animatedStyle1]}
        resizeMode="cover"
        blurRadius={0}
      />
      <Animated.Image
        source={{ uri: COUPLE_IMAGES[nextIndex] }}
        style={[styles.backgroundImage, animatedStyle2]}
        resizeMode="cover"
        blurRadius={0}
      />

      {/* Black & White + Vignette overlay */}
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
  const { request, promptAsync } = useGoogleAuth();

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await promptAsync();

      if (result?.type === 'success') {
        const { authentication } = result;
        if (!authentication) {
          throw new Error('No authentication data received');
        }
        const success = await googleLogin(authentication.accessToken);

        if (!success) {
          Alert.alert(
            'Login Failed',
            'Unable to sign in with Google. Please try again.',
            [{ text: 'OK' }]
          );
        }
        // Navigation is handled automatically by RootNavigator
        // when isAuthenticated becomes true
      } else if (result?.type === 'error') {
        Alert.alert(
          'Error',
          'An error occurred during sign in. Please try again.',
          [{ text: 'OK' }]
        );
      }
      // If cancelled, just return to login screen (no error needed)
    } catch (error) {
      console.error('[LoginScreen] Google login error:', error);
      Alert.alert(
        'Error',
        'An unexpected error occurred. Please try again.',
        [{ text: 'OK' }]
      );
    }
  }, [promptAsync, googleLogin]);

  return (
    <View style={styles.container}>
      {/* Animated Background */}
      <AnimatedBackground />

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
                loading={isLoading || !request}
                disabled={!request}
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
            </Animated.View>

            {/* Terms */}
            <Animated.View entering={FadeIn.delay(800)} style={styles.termsContainer}>
              <Text style={styles.termsText}>
                By continuing, you agree to our{' '}
                <Text style={styles.termsLink}>Terms of Service</Text>
                {' '}and{' '}
                <Text style={styles.termsLink}>Privacy Policy</Text>
              </Text>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
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
    ...StyleSheet.absoluteFillObject,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
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
  termsContainer: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  termsText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
});
