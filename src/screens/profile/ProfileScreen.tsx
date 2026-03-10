import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  Dimensions,
  Alert,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInLeft,
  FadeInRight,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { useUser, useMatches, useAuth } from '../../context';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';
import { startPayment, getPlans, getSubscriptionStatus, cancelSubscription } from '../../services/payment.service';
import { SafetyModal } from '../../components/modals/SafetyModal';
import type { PlanType, SubscriptionPlan, SubscriptionStatusResponse } from '../../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Photo grid constants
const PHOTO_GRID_COLUMNS = 3;
const PHOTO_GAP = 4;
const PHOTO_SIZE = (SCREEN_WIDTH - spacing.lg * 2 - PHOTO_GAP * (PHOTO_GRID_COLUMNS - 1)) / PHOTO_GRID_COLUMNS;

// Photo sheet constants
const COLLAPSED_HEIGHT = 55;
const EXPANDED_HEIGHT = SCREEN_HEIGHT * 0.70;

type RootStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  Settings: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;


// Simple Red Border Component (non-animated)
const RedBorder: React.FC<{
  children: React.ReactNode;
  size: number;
  borderWidth: number;
}> = ({ children, size, borderWidth }) => {
  const innerSize = size - borderWidth * 2;

  return (
    <View style={{
      width: size,
      height: size,
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <View style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#FF0000',
      }} />
      <View style={{
        width: innerSize,
        height: innerSize,
        borderRadius: innerSize / 2,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
      }}>
        {children}
      </View>
    </View>
  );
};

// Plan Details Modal
const PlanDetailsModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  plans: SubscriptionPlan[];
  selectedPlan: string | null;
  onSelectPlan: (plan: string) => void;
  onPaymentSuccess: () => void;
}> = ({ visible, onClose, plans, selectedPlan, onSelectPlan, onPaymentSuccess }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={modalStyles.overlay}>
        <Animated.View entering={ZoomIn.springify()} style={modalStyles.container}>
          <LinearGradient colors={['#1a1a1a', '#0d0d0d']} style={modalStyles.gradient}>
            <Pressable style={modalStyles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>

            <Text style={modalStyles.title}>Choose Your Plan</Text>
            <Text style={modalStyles.subtitle}>Unlock the full InBlood experience</Text>

            <ScrollView showsVerticalScrollIndicator={false} style={modalStyles.plansScroll}>
              {plans.map((plan) => {
                const planColor = plan.badge_color || colors.primary;
                const isSelected = selectedPlan === plan.plan_key;
                return (
                  <Pressable
                    key={plan.plan_key}
                    style={[
                      modalStyles.planCard,
                      isSelected && modalStyles.planCardSelected,
                      { borderColor: isSelected ? planColor : 'rgba(255,255,255,0.12)' },
                    ]}
                    onPress={() => onSelectPlan(plan.plan_key)}
                  >
                    {plan.badge && (
                      <View style={[modalStyles.planBadge, { backgroundColor: planColor }]}>
                        <Text style={modalStyles.planBadgeText}>{plan.badge}</Text>
                      </View>
                    )}

                    <View style={modalStyles.planHeader}>
                      <View style={modalStyles.planNameRow}>
                        <Text style={[modalStyles.planName, { color: planColor }]}>{plan.name}</Text>
                        <Ionicons
                          name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                          size={22}
                          color={isSelected ? planColor : 'rgba(255,255,255,0.2)'}
                        />
                      </View>
                      <View style={modalStyles.priceRow}>
                        <Text style={modalStyles.currency}>₹</Text>
                        <Text style={modalStyles.planPrice}>{plan.price.toLocaleString('en-IN')}</Text>
                        <Text style={modalStyles.planPeriod}>{plan.period_label}</Text>
                        {plan.original_price && (
                          <Text style={modalStyles.originalPrice}>
                            ₹{plan.original_price.toLocaleString('en-IN')}
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={modalStyles.featuresList}>
                      {plan.features.map((feature, index) => (
                        <View key={index} style={modalStyles.featureItem}>
                          <Ionicons
                            name={feature.included ? 'checkmark-circle' : 'close-circle'}
                            size={16}
                            color={feature.included ? '#4CAF50' : 'rgba(255,255,255,0.2)'}
                          />
                          <Text
                            style={[
                              modalStyles.featureText,
                              !feature.included && modalStyles.featureTextDisabled,
                            ]}
                          >
                            {feature.text}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              style={[modalStyles.subscribeButton, isProcessing && { opacity: 0.6 }]}
              disabled={isProcessing || !selectedPlan}
              onPress={() => {
                if (!selectedPlan) return;
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setIsProcessing(true);
                startPayment(
                  selectedPlan as PlanType,
                  () => {
                    setIsProcessing(false);
                    onClose();
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    Alert.alert('Welcome to Premium!', 'Your subscription is now active.');
                    onPaymentSuccess();
                  },
                  (message) => {
                    setIsProcessing(false);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    Alert.alert('Payment Failed', message);
                  }
                );
              }}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                style={modalStyles.subscribeGradient}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={modalStyles.subscribeText}>Subscribe Now</Text>
                )}
              </LinearGradient>
            </Pressable>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
};

// Draggable Photo Sheet Component
const PhotoSheet: React.FC<{
  photos: string[];
  onPhotoPress: (index: number) => void;
}> = ({ photos, onPhotoPress }) => {
  const translateY = useSharedValue(0);
  const contextY = useSharedValue(0);
  const isExpanded = useSharedValue(false);
  const scrollOffset = useSharedValue(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const triggerHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const resetScroll = useCallback(() => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      contextY.value = translateY.value;
    })
    .onUpdate((event) => {
      if (isExpanded.value && scrollOffset.value > 0 && event.translationY > 0) {
        return;
      }
      const newY = contextY.value + event.translationY;
      translateY.value = Math.max(
        -(EXPANDED_HEIGHT - COLLAPSED_HEIGHT),
        Math.min(0, newY)
      );
    })
    .onEnd((event) => {
      if (isExpanded.value && scrollOffset.value > 5) {
        return;
      }
      const velocity = event.velocityY;
      const currentY = translateY.value;
      const midPoint = -(EXPANDED_HEIGHT - COLLAPSED_HEIGHT) / 2;

      if (velocity < -500) {
        runOnJS(triggerHaptic)();
        isExpanded.value = true;
        translateY.value = withTiming(-(EXPANDED_HEIGHT - COLLAPSED_HEIGHT), { duration: 300 });
      } else if (velocity > 500) {
        runOnJS(triggerHaptic)();
        isExpanded.value = false;
        translateY.value = withTiming(0, { duration: 300 });
        runOnJS(resetScroll)();
      } else {
        if (currentY < midPoint) {
          isExpanded.value = true;
          translateY.value = withTiming(-(EXPANDED_HEIGHT - COLLAPSED_HEIGHT), { duration: 300 });
        } else {
          isExpanded.value = false;
          translateY.value = withTiming(0, { duration: 300 });
          runOnJS(resetScroll)();
        }
      }
    });

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffset.value = event.nativeEvent.contentOffset.y;
  };

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleIndicatorStyle = useAnimatedStyle(() => ({
    width: interpolate(
      translateY.value,
      [-(EXPANDED_HEIGHT - COLLAPSED_HEIGHT), 0],
      [60, 40],
      Extrapolation.CLAMP
    ),
  }));

  const overlayOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [-(EXPANDED_HEIGHT - COLLAPSED_HEIGHT), 0],
      [0.5, 0],
      Extrapolation.CLAMP
    ),
    pointerEvents: translateY.value < -50 ? 'auto' as const : 'none' as const,
  }));

  const hintOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [-(EXPANDED_HEIGHT - COLLAPSED_HEIGHT) * 0.2, 0],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));

  const gridOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [-(EXPANDED_HEIGHT - COLLAPSED_HEIGHT) * 0.3, -(EXPANDED_HEIGHT - COLLAPSED_HEIGHT) * 0.6],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));

  return (
    <>
      <Animated.View style={[sheetStyles.overlay, overlayOpacity]} />
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[sheetStyles.container, sheetAnimatedStyle]}>
          <View style={sheetStyles.handleContainer}>
            <Animated.View style={[sheetStyles.handle, handleIndicatorStyle]} />
          </View>
          <View style={sheetStyles.header}>
            <Text style={sheetStyles.title}>My Photos</Text>
            <Text style={sheetStyles.photoCount}>{photos.length} photos</Text>
          </View>
          <Animated.View style={[sheetStyles.collapsedHint, hintOpacity]}>
            <Ionicons name="chevron-up" size={16} color={colors.textMuted} />
            <Text style={sheetStyles.collapsedHintText}>Swipe up to view</Text>
          </Animated.View>
          <Animated.View style={[sheetStyles.expandedContainer, gridOpacity]}>
            <ScrollView
              ref={scrollViewRef}
              style={sheetStyles.scrollView}
              contentContainerStyle={sheetStyles.gridContainer}
              showsVerticalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              bounces={false}
            >
              <View style={sheetStyles.grid}>
                {photos.map((photo, index) => (
                  <Pressable
                    key={index}
                    style={sheetStyles.gridPhoto}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onPhotoPress(index);
                    }}
                  >
                    <Image source={{ uri: photo }} style={sheetStyles.gridImage} />
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </>
  );
};

// Full Screen Photo Viewer
const PhotoViewer: React.FC<{
  visible: boolean;
  photos: string[];
  initialIndex: number;
  onClose: () => void;
}> = ({ visible, photos, initialIndex, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  React.useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={viewerStyles.container}>
        <Pressable style={viewerStyles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={28} color={colors.text} />
        </Pressable>
        <Image
          source={{ uri: photos[currentIndex] }}
          style={viewerStyles.image}
          resizeMode="contain"
        />
        <View style={viewerStyles.indicators}>
          {photos.map((_, index) => (
            <Pressable
              key={index}
              style={[
                viewerStyles.indicator,
                index === currentIndex && viewerStyles.indicatorActive,
              ]}
              onPress={() => setCurrentIndex(index)}
            />
          ))}
        </View>
        {currentIndex > 0 && (
          <Pressable
            style={[viewerStyles.navButton, viewerStyles.navLeft]}
            onPress={() => setCurrentIndex(currentIndex - 1)}
          >
            <Ionicons name="chevron-back" size={32} color={colors.text} />
          </Pressable>
        )}
        {currentIndex < photos.length - 1 && (
          <Pressable
            style={[viewerStyles.navButton, viewerStyles.navRight]}
            onPress={() => setCurrentIndex(currentIndex + 1)}
          >
            <Ionicons name="chevron-forward" size={32} color={colors.text} />
          </Pressable>
        )}
        <Text style={viewerStyles.counter}>
          {currentIndex + 1} / {photos.length}
        </Text>
      </View>
    </Modal>
  );
};

// Bento Box Component
const BentoBox: React.FC<{
  children: React.ReactNode;
  style?: any;
  delay?: number;
  entering?: any;
}> = ({ children, style, delay = 0, entering }) => (
  <Animated.View
    entering={entering || FadeInUp.delay(delay).springify()}
    style={[styles.bentoBox, style]}
  >
    {children}
  </Animated.View>
);

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user, isLoading, refreshProfile, isRefreshing, error, clearError } = useUser();
  const { matches, refreshPremiumStatus } = useMatches();
  const { logout } = useAuth();
  const { signOut: googleSignOut } = useGoogleAuth();
  const insets = useSafeAreaInsets();
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('monthly');
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionStatusResponse | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  // Auto-recover: if profile fetch failed, retry once automatically
  const hasAutoRetried = useRef(false);
  useEffect(() => {
    if (error && !user && !isLoading && !isRefreshing && !hasAutoRetried.current) {
      hasAutoRetried.current = true;
      console.log('[ProfileScreen] Auto-retrying profile fetch after error');
      clearError();
      refreshProfile();
    }
  }, [error, user, isLoading, isRefreshing, clearError, refreshProfile]);

  // Fetch subscription status
  const fetchSubscriptionInfo = useCallback(async () => {
    try {
      const status = await getSubscriptionStatus();
      setSubscriptionInfo(status);
    } catch (err) {
      console.error('[ProfileScreen] Failed to fetch subscription status:', err);
    }
  }, []);

  useEffect(() => {
    fetchSubscriptionInfo();
  }, [fetchSubscriptionInfo]);

  const handleCancelSubscription = useCallback(() => {
    Alert.alert(
      'Cancel Subscription',
      'Your premium features will remain active until the expiry date. Are you sure?',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: async () => {
            setIsCancelling(true);
            try {
              await cancelSubscription();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Subscription Cancelled', 'Your premium access will continue until the expiry date.');
              fetchSubscriptionInfo();
              refreshPremiumStatus();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to cancel subscription');
            } finally {
              setIsCancelling(false);
            }
          },
        },
      ]
    );
  }, [fetchSubscriptionInfo, refreshPremiumStatus]);

  // Fetch plans when modal opens
  useEffect(() => {
    if (showPlanModal && plans.length === 0) {
      getPlans()
        .then(setPlans)
        .catch((err) => console.error('[ProfileScreen] Failed to fetch plans:', err));
    }
  }, [showPlanModal, plans.length]);

  const handleEditProfile = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('EditProfile');
  }, [navigation]);

  const handleSettings = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('Settings');
  }, [navigation]);

  const handlePhotoPress = useCallback((index: number) => {
    setSelectedPhotoIndex(index);
    setShowPhotoViewer(true);
  }, []);

  const handleLogout = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            console.log('[ProfileScreen] Logout initiated');
            console.log('[ProfileScreen] Step 1: Calling Google signOut');
            await googleSignOut();
            console.log('[ProfileScreen] Step 2: Google signOut completed');
            console.log('[ProfileScreen] Step 3: Calling auth context logout');
            logout();
            console.log('[ProfileScreen] Step 4: Auth context logout completed');
          },
        },
      ]
    );
  }, [logout, googleSignOut]);

  // Only show profile if we have real user data
  if (!user && !isLoading && !error) {
    return null; // No data yet, waiting for auto-fetch
  }

  // Use real stats from user object
  const stats = user ? {
    seductions: user.stats?.seductions?.toLocaleString() || '0',
    likes: user.stats?.likes || 0,
    matches: matches.length || 0,
    superLikes: 0, // Not available from backend yet
  } : { seductions: '0', likes: 0, matches: 0, superLikes: 0 };

  // Use real prompts from user object
  const prompts = user?.prompts || [];

  // Use real opening moves from user object
  const openingMoves = user?.openingMoves || [];

  // Use real languages from user object
  const languages = user?.languages || [];

  return (
    <GestureHandlerRootView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: COLLAPSED_HEIGHT + 120 + insets.bottom }]}
        bounces={true}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refreshProfile}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Loading state - Initial load only */}
        {isLoading && !user && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading your profile...</Text>
          </View>
        )}

        {/* Error handling */}
        {error && !isLoading && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={48} color={colors.primary} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              style={styles.retryButton}
              onPress={() => {
                clearError();
                refreshProfile();
              }}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {/* Header with actions */}
        <SafeAreaView style={styles.headerActions} edges={['top']}>
          <Pressable style={styles.headerActionButton} onPress={handleSettings}>
            <Ionicons name="settings-outline" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>My Profile</Text>
          <Pressable style={styles.headerActionButton} onPress={handleEditProfile}>
            <Ionicons name="pencil-outline" size={22} color={colors.text} />
          </Pressable>
        </SafeAreaView>

        {/* Profile Card with Rectangle and Lights */}
        <Animated.View entering={FadeIn.duration(600)} style={styles.profileCardSection}>
          {/* Stats Section with Single Rectangle */}
          <View style={styles.statsContainer}>
            {/* Left Ellipse Glow */}
            <View style={styles.leftEllipse} />

            {/* Right Ellipse Glow */}
            <View style={styles.rightEllipse} />

            {/* Background Rectangle */}
            <View style={styles.statsRectangle} />

            {/* Stats Content Layer */}
            <View style={styles.statsContent}>
              {/* Left Stats */}
              <View style={styles.statsSide}>
                <Text style={styles.statNumber}>{stats.seductions}</Text>
                <Text style={styles.statLabel}>SEDUCTIONS</Text>
              </View>

              {/* Spacer for profile image */}
              <View style={styles.statsImageSpacer} />

              {/* Right Stats */}
              <View style={styles.statsSide}>
                <Text style={styles.statNumber}>{stats.likes}</Text>
                <Text style={styles.statLabel}>LIKES</Text>
              </View>
            </View>

            {/* Center Profile Image (overlapping) */}
            {user?.photos?.[0] && (
              <Pressable
                style={styles.profileImageContainer}
                onPress={() => handlePhotoPress(0)}
              >
                <RedBorder size={116} borderWidth={3}>
                  <Image
                    source={{ uri: user.photos[0] }}
                    style={styles.statsProfileImage}
                  />
                </RedBorder>
              </Pressable>
            )}
          </View>

          {/* Name and details below */}
          <View style={styles.profileInfoSection}>
            <View style={styles.nameRow}>
              <Text style={styles.profileName}>{user?.name}</Text>
              <Text style={styles.profileAge}>, {user?.age}</Text>
              {user?.verified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={24} color="#1DA1F2" />
                </View>
              )}
            </View>
            {user?.gender && (
              <Text style={styles.profileGender}>
                {user.gender}{user.pronouns ? ` · ${user.pronouns}` : ''}
              </Text>
            )}
            <View style={styles.locationRow}>
              <Ionicons name="pin" size={16} color={colors.primary} />
              <Text style={styles.profileLocation}>{user?.location?.city || 'Unknown'}</Text>
            </View>

            {/* Matches count */}
            <View style={styles.matchesRow}>
              <Ionicons name="people" size={16} color="#000000" />
              <Text style={styles.matchesText}>{stats.matches} Matches</Text>
            </View>
          </View>
        </Animated.View>

        {/* Bento Grid Section */}
        <View style={styles.bentoGrid}>
          {/* Bio - Large card */}
          {user?.bio && (
            <BentoBox style={styles.bentoBioCard} delay={450}>
              <View style={styles.bentoHeader}>
                <View style={[styles.bentoIconContainer, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                  <Ionicons name="person" size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.bentoTitle}>About Me</Text>
              </View>
              <Text style={styles.bentoBioText}>{user.bio}</Text>
            </BentoBox>
          )}

          {/* Two column layout */}
          <View style={styles.bentoRow}>
            {/* Pronouns card */}
            <BentoBox style={styles.bentoSmallCard} delay={500} entering={FadeInLeft.delay(500).springify()}>
              <View style={[styles.bentoIconContainer, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                <Ionicons name="male-female" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.bentoSmallLabel}>Pronouns</Text>
              <Text style={styles.bentoSmallValue}>{user?.pronouns || 'Not set'}</Text>
            </BentoBox>

            {/* Verified card */}
            <BentoBox style={styles.bentoSmallCard} delay={550} entering={FadeInRight.delay(550).springify()}>
              <View style={[styles.bentoIconContainer, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.bentoSmallLabel}>Status</Text>
              <Text style={styles.bentoSmallValue}>{user?.verified ? 'Verified' : 'Not verified'}</Text>
            </BentoBox>
          </View>

          {/* Sexual Orientation - Display only */}
          <BentoBox style={styles.bentoOrientationCard} delay={575}>
            <View style={styles.bentoHeader}>
              <View style={[styles.bentoIconContainer, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                <Ionicons name="heart-circle" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.bentoTitle}>Sexual Orientation</Text>
            </View>
            <View style={styles.orientationDisplay}>
              {user?.orientation ? (
                <View style={styles.orientationChipSelected}>
                  <Ionicons name="heart" size={16} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.orientationChipTextSelected}>{user.orientation}</Text>
                </View>
              ) : (
                <Pressable
                  style={styles.orientationAddButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    navigation.navigate('EditProfile');
                  }}
                >
                  <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.orientationAddText}>Add your orientation</Text>
                </Pressable>
              )}
            </View>
          </BentoBox>

          {/* Tags - if available */}
          {user?.tags && user.tags.length > 0 && (
            <BentoBox style={styles.bentoTagsCard} delay={650}>
              <View style={styles.bentoHeader}>
                <View style={[styles.bentoIconContainer, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                  <Ionicons name="pricetags" size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.bentoTitle}>Tags</Text>
              </View>
              <View style={styles.tagsWrap}>
                {user.tags.map((tag, index) => (
                  <Animated.View
                    key={index}
                    entering={FadeInUp.delay(700 + index * 50).springify()}
                    style={styles.tagChip}
                  >
                    <Text style={styles.tagChipText}>{tag}</Text>
                  </Animated.View>
                ))}
              </View>
            </BentoBox>
          )}

          {/* Prompts - Stacked cards - Only show if available */}
          {prompts.length > 0 && (
            <BentoBox style={styles.bentoPromptsCard} delay={700}>
              <View style={styles.bentoHeader}>
                <View style={[styles.bentoIconContainer, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                  <Ionicons name="chatbubble-ellipses" size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.bentoTitle}>My Prompts</Text>
              </View>
              {prompts.map((prompt, index) => (
                <View key={index} style={styles.promptItem}>
                  <Text style={styles.promptQuestion}>{prompt.question}</Text>
                  <Text style={styles.promptAnswer}>{prompt.answer}</Text>
                </View>
              ))}
            </BentoBox>
          )}

          {/* Opening Moves - Only show if available */}
          {openingMoves.length > 0 && (
            <BentoBox style={styles.bentoPromptsCard} delay={725}>
              <View style={styles.bentoHeader}>
                <View style={[styles.bentoIconContainer, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                  <Ionicons name="chatbubble-outline" size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.bentoTitle}>Opening Moves</Text>
              </View>
              {openingMoves.map((move, index) => (
                <View key={index} style={styles.promptItem}>
                  <Text style={styles.promptQuestion}>{move.question}</Text>
                  <Text style={styles.promptAnswer}>{move.answer}</Text>
                </View>
              ))}
            </BentoBox>
          )}

          {/* Languages - Horizontal - Only show if available */}
          {languages.length > 0 && (
            <BentoBox style={styles.bentoLanguagesCard} delay={750}>
              <View style={styles.bentoHeader}>
                <View style={[styles.bentoIconContainer, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                  <Ionicons name="globe" size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.bentoTitle}>Languages</Text>
              </View>
              <View style={styles.languagesRow}>
                {languages.map((lang, index) => (
                  <View key={index} style={styles.languageChip}>
                    <Text style={styles.languageChipText}>{lang}</Text>
                  </View>
                ))}
              </View>
            </BentoBox>
          )}
        </View>

        {/* Logout Button */}
        <Animated.View entering={FadeInUp.delay(800).springify()} style={styles.logoutSection}>
          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <View style={styles.logoutIconContainer}>
              <Ionicons name="log-out-outline" size={22} color="#FF4444" />
            </View>
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
        </Animated.View>

        {/* Premium Section */}
        <Animated.View entering={FadeInUp.delay(850).springify()} style={styles.premiumSection}>
          {subscriptionInfo?.is_premium && subscriptionInfo.subscription ? (
            // Active subscription info
            <LinearGradient
              colors={['rgba(229, 57, 53, 0.3)', 'rgba(183, 28, 28, 0.2)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.premiumCard}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Ionicons name="diamond" size={20} color="#FFD700" />
                  <Text style={[styles.premiumTitle, { marginLeft: 8, color: '#FFD700' }]}>
                    {subscriptionInfo.subscription.plan_type === 'annual' ? 'Premium+' : 'Premium'}
                  </Text>
                  <View style={{
                    backgroundColor: subscriptionInfo.subscription.status === 'active' ? 'rgba(76,175,80,0.2)' : 'rgba(255,152,0,0.2)',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 10,
                    marginLeft: 8,
                  }}>
                    <Text style={{
                      color: subscriptionInfo.subscription.status === 'active' ? '#4CAF50' : '#FF9800',
                      fontSize: 11,
                      fontWeight: '600',
                      textTransform: 'uppercase',
                    }}>
                      {subscriptionInfo.subscription.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.premiumSubtitle}>
                  {subscriptionInfo.subscription.status === 'cancelled' ? 'Access until: ' : 'Expires: '}
                  {new Date(subscriptionInfo.subscription.expires_at).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'long', year: 'numeric'
                  })}
                </Text>
                {subscriptionInfo.subscription.status === 'active' && (
                  <Pressable
                    onPress={handleCancelSubscription}
                    disabled={isCancelling}
                    style={{ marginTop: 10 }}
                  >
                    <Text style={{ color: colors.textMuted, fontSize: 13, textDecorationLine: 'underline' }}>
                      {isCancelling ? 'Cancelling...' : 'Cancel Subscription'}
                    </Text>
                  </Pressable>
                )}
              </View>
            </LinearGradient>
          ) : (
            // Upgrade CTA
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowPlanModal(true);
              }}
            >
              <LinearGradient
                colors={['rgba(229, 57, 53, 0.3)', 'rgba(183, 28, 28, 0.2)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.premiumCard}
              >
                <View style={styles.premiumIconBg}>
                  <Ionicons name="diamond" size={28} color={colors.primary} />
                </View>
                <View style={styles.premiumContent}>
                  <Text style={styles.premiumTitle}>Upgrade to Premium</Text>
                  <Text style={styles.premiumSubtitle}>Unlock unlimited likes, see who liked you & more</Text>
                </View>
                <View style={styles.premiumArrow}>
                  <Ionicons name="arrow-forward" size={20} color={colors.primary} />
                </View>
              </LinearGradient>
            </Pressable>
          )}
        </Animated.View>

        {/* Quick Actions */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            {/* <Pressable style={styles.quickActionCard} onPress={() => Alert.alert('Invite Friends')}>
              <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                <Ionicons name="gift" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.quickActionText} numberOfLines={1}>Invite</Text>
            </Pressable> */}
            <Pressable style={styles.quickActionCard} onPress={() => setShowSafetyModal(true)}>
              <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                <Ionicons name="shield-checkmark" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.quickActionText} numberOfLines={1}>Safety</Text>
            </Pressable>
            <Pressable style={styles.quickActionCard} onPress={() => Alert.alert('Help & Support')}>
              <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                <Ionicons name="help-circle" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.quickActionText} numberOfLines={1}>Help</Text>
            </Pressable>
            <Pressable style={styles.quickActionCard} onPress={handleSettings}>
              <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                <Ionicons name="settings" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.quickActionText} numberOfLines={1}>Settings</Text>
            </Pressable>
          </View>
        </View>

        {/* Footer */}
        <Animated.View entering={FadeIn.delay(900)} style={styles.footer}>
          <Text style={styles.footerText}>InBlood v{Constants.expoConfig?.version || '1.0.0'}</Text>
          <Text style={styles.footerSubtext}>Made with love in India</Text>
        </Animated.View>
      </ScrollView>

      {/* Photo Viewer Modal */}
      <PhotoViewer
        visible={showPhotoViewer}
        photos={user?.photos || []}
        initialIndex={selectedPhotoIndex}
        onClose={() => setShowPhotoViewer(false)}
      />

      {/* Plan Modal */}
      <PlanDetailsModal
        visible={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        plans={plans}
        selectedPlan={selectedPlan}
        onSelectPlan={setSelectedPlan}
        onPaymentSuccess={() => { refreshPremiumStatus(); fetchSubscriptionInfo(); }}
      />

      {/* Photo Sheet */}
      <PhotoSheet
        photos={user?.photos || []}
        onPhotoPress={handlePhotoPress}
      />
      <SafetyModal visible={showSafetyModal} onClose={() => setShowSafetyModal(false)} />
    </GestureHandlerRootView>
  );
};

const viewerStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
  },
  indicators: {
    position: 'absolute',
    bottom: 100,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  indicatorActive: {
    backgroundColor: colors.text,
    width: 24,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navLeft: { left: 16 },
  navRight: { right: 16 },
  counter: {
    position: 'absolute',
    bottom: 60,
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
});

const TAB_BAR_OFFSET = 94;

const sheetStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'black',
  },
  container: {
    position: 'absolute',
    bottom: TAB_BAR_OFFSET - EXPANDED_HEIGHT + COLLAPSED_HEIGHT,
    left: 0,
    right: 0,
    height: EXPANDED_HEIGHT,
    backgroundColor: colors.card,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  photoCount: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  collapsedHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -spacing.md,
    paddingBottom: spacing.xs,
  },
  collapsedHintText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginLeft: spacing.xs,
  },
  expandedContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    bottom: 0,
  },
  scrollView: { flex: 1 },
  gridContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: PHOTO_GAP,
  },
  gridPhoto: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  container: {
    maxHeight: '90%',
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    overflow: 'hidden',
  },
  gradient: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  plansScroll: { maxHeight: 400 },
  planCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingTop: spacing.lg + 4,
    marginBottom: spacing.md,
    borderWidth: 2,
    overflow: 'visible' as const,
  },
  planCardSelected: {
    backgroundColor: 'rgba(229, 57, 53, 0.08)',
  },
  planBadge: {
    position: 'absolute' as const,
    top: -12,
    right: spacing.lg,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
    zIndex: 1,
  },
  planBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#000',
    letterSpacing: 0.5,
  },
  planHeader: { marginBottom: spacing.md },
  planNameRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  planName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  priceRow: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    marginTop: spacing.xs,
    gap: 2,
  },
  currency: {
    fontSize: fontSize.lg,
    color: colors.text,
    fontWeight: fontWeight.medium,
  },
  planPrice: {
    fontSize: 32,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  planPeriod: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginLeft: 2,
  },
  originalPrice: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textDecorationLine: 'line-through' as const,
    marginLeft: 8,
  },
  featuresList: { gap: 6 },
  featureItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  featureText: {
    fontSize: fontSize.sm,
    color: colors.text,
    flex: 1,
  },
  featureTextDisabled: {
    color: colors.textMuted,
  },
  subscribeButton: {
    marginTop: spacing.lg,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  subscribeGradient: {
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
  },
  subscribeText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  // Header Actions
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  // Profile Card Section with Rectangle and Lights
  profileCardSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  statsContainer: {
    position: 'relative',
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  leftEllipseContainer: {
    position: 'absolute',
    width: 100,
    height: 70,
    left: 10,
    zIndex: -1,
    overflow: 'hidden',
    borderRadius: 50,
    shadowColor: '#FBBC05',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 30,
  },
  leftEllipseInner: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFD54F',
    opacity: 0.9,
  },
  rightEllipseContainer: {
    position: 'absolute',
    width: 100,
    height: 70,
    right: 10,
    zIndex: -1,
    overflow: 'hidden',
    borderRadius: 50,
    shadowColor: '#E53935',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 30,
  },
  rightEllipseInner: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FF5252',
    opacity: 0.9,
  },
  ellipseBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  leftEllipse: {
    position: 'absolute',
    width: 90,
    height: 70,
    left: 30,
    borderRadius: 45,
    backgroundColor: '#FF9800',
    opacity: 0.6,
    // iOS glow via shadow (no effect on Android)
    shadowColor: '#FF9800',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 60,
    // No elevation — on Android it raises the solid shape above everything
    // and doesn't produce colored glows (only gray shadows)
  },
  rightEllipse: {
    position: 'absolute',
    width: 90,
    height: 70,
    right: 30,
    borderRadius: 45,
    backgroundColor: '#D32F2F',
    opacity: 0.6,
    shadowColor: '#D32F2F',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 60,
  },
  statsRectangle: {
    width: SCREEN_WIDTH - spacing.lg * 2,
    height: 90,
    borderRadius: 45,
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: '#0D0D0D',
    zIndex: 0,
    elevation: 1,
  },
  statsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: spacing.xl,
    zIndex: 1,
    elevation: 2,
  },
  statsSide: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
    marginTop: 4,
    letterSpacing: 1,
  },
  statsImageSpacer: {
    width: 100,
  },
  profileImageContainer: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    zIndex: 10,
    elevation: 3,
  },
  statsProfileImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  profileImageGradientBorder: {
    width: 116,
    height: 116,
    borderRadius: 58,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF0000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
  },
  profileImageInner: {
    width: 110,
    height: 110,
    borderRadius: 55,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  photoNavDots: {
    position: 'absolute',
    bottom: -20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  photoNavDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  photoNavDotActive: {
    backgroundColor: colors.primary,
    width: 18,
  },
  // Profile Info Section
  profileInfoSection: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileName: {
    fontSize: 28,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  profileAge: {
    fontSize: 26,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  verifiedBadge: {
    marginLeft: spacing.sm,
  },
  profileGender: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: 4,
  },
  profileLocation: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  matchesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  matchesText: {
    fontSize: fontSize.sm,
    color: '#000000',
    fontWeight: fontWeight.medium,
  },
  // Keep old styles for compatibility
  glassStatCard: {
    flex: 1,
    backgroundColor: 'rgba(21, 21, 21, 0.9)',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  glassStatIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  glassStatValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  glassStatLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  // Bento Grid
  bentoGrid: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  bentoBox: {
    backgroundColor: '#0D0D0D',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  bentoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  bentoIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(229, 57, 53, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bentoTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  bentoBioCard: {},
  bentoBioText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  bentoRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  bentoSmallCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  bentoSmallLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  bentoSmallValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: 4,
  },
  bentoTagsCard: {},
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tagChip: {
    backgroundColor: colors.primary + '20',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  tagChipText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  bentoOrientationCard: {
    marginBottom: spacing.md,
  },
  orientationDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orientationChipSelected: {
    backgroundColor: 'rgba(255, 152, 0, 0.3)',
    borderColor: '#FF9800',
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
  },
  orientationChipTextSelected: {
    color: '#fff',
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  orientationAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 152, 0, 0.3)',
    borderStyle: 'dashed',
  },
  orientationAddText: {
    color: '#FF9800',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginLeft: spacing.xs,
  },
  bentoPromptsCard: {},
  promptItem: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  promptQuestion: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  promptAnswer: {
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: 22,
  },
  bentoLanguagesCard: {},
  languagesRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  languageChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  languageChipText: {
    fontSize: fontSize.sm,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: fontWeight.medium,
  },
  // Premium Section
  premiumSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  premiumCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(229, 57, 53, 0.3)',
  },
  premiumIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(229, 57, 53, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  premiumTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  premiumSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 4,
  },
  premiumArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(229, 57, 53, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Quick Actions
  quickActionsSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  quickActionText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  // Floating Edit Button
  floatingEditButton: {
    position: 'absolute',
    bottom: COLLAPSED_HEIGHT + 100,
    right: spacing.lg,
    zIndex: 100,
  },
  floatingEditPressable: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  floatingEditGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Footer
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginTop: spacing.lg,
  },
  footerText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
  },
  footerSubtext: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 4,
  },
  // Logout Section
  logoutSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D0D0D',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.3)',
    gap: spacing.sm,
  },
  logoutIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: '#FF4444',
  },
  // Loading Container
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  loadingText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  // Error Container
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
    paddingHorizontal: spacing.xl,
  },
  errorText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.full,
  },
  retryButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
});

