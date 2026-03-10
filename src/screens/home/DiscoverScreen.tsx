import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
  Pressable,
  Image,
  Alert,
  Modal,
  ScrollView,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  ZoomIn,
  SlideInDown,
  SlideInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { SwipeCard, ActionButton, CARD_WIDTH, CARD_HEIGHT } from '../../components';
import { useMatches, useUser } from '../../context';
import { SwipeDirection, Profile } from '../../types';
import { mapInterestedInToGender } from '../../utils/filterMapping';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';
import { trackProfileView } from '../../services/interactions.service';
import { startPayment, getPlans } from '../../services/payment.service';
import type { SubscriptionPlan } from '../../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Filter options
const GENDER_OPTIONS = [
  { id: 'women', label: 'Women', icon: 'female' as const },
  { id: 'men', label: 'Men', icon: 'male' as const },
  { id: 'everyone', label: 'Everyone', icon: 'people' as const },
];

const INTEREST_OPTIONS = [
  'Travel', 'Music', 'Fitness', 'Food', 'Movies', 'Art', 'Gaming', 'Reading',
  'Photography', 'Sports', 'Cooking', 'Dancing', 'Yoga', 'Tech', 'Fashion', 'Nature',
];

type RootStackParamList = {
  Discover: undefined;
  MatchScreen: { match: any };
  ProfileDetail: { profile: Profile };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Premium Popup Component
const PremiumPopup: React.FC<{
  visible: boolean;
  onClose: () => void;
  onPurchase: () => void;
  isProcessing?: boolean;
  plan: SubscriptionPlan | null;
}> = ({ visible, onClose, onPurchase, isProcessing = false, plan }) => {
  const scale = useSharedValue(1);
  const heartScale = useSharedValue(1);

  React.useEffect(() => {
    if (visible) {
      heartScale.value = withRepeat(
        withSequence(
          withSpring(1.2, { damping: 5 }),
          withSpring(1, { damping: 5 })
        ),
        -1,
        false
      );
    }
  }, [visible]);

  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={popupStyles.overlay}>
        <Animated.View
          entering={ZoomIn.springify()}
          style={popupStyles.container}
        >
          <LinearGradient
            colors={['#1a1a1a', '#0d0d0d']}
            style={popupStyles.gradient}
          >
            {/* Close button */}
            <Pressable style={popupStyles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>

            {/* Premium badge */}
            <View style={popupStyles.premiumBadge}>
              <LinearGradient
                colors={['#FFD700', '#FFA500']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={popupStyles.badgeGradient}
              >
                <Ionicons name="diamond" size={20} color="#000" />
                <Text style={popupStyles.badgeText}>PREMIUM</Text>
              </LinearGradient>
            </View>

            {/* Animated heart icon */}
            <Animated.View style={[popupStyles.heartContainer, heartAnimatedStyle]}>
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                style={popupStyles.heartGradient}
              >
                <Ionicons name="heart" size={50} color={colors.text} />
                <View style={popupStyles.infinityBadge}>
                  <Ionicons name="infinite" size={18} color={colors.text} />
                </View>
              </LinearGradient>
            </Animated.View>

            {/* Title */}
            <Text style={popupStyles.title}>Unlock Unlimited Likes</Text>
            <Text style={popupStyles.subtitle}>
              You've used all your free likes for today
            </Text>

            {/* Features */}
            <View style={popupStyles.features}>
              {plan ? plan.features.filter(f => f.included).slice(0, 5).map((feature, index) => (
                <View key={index} style={popupStyles.featureRow}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  <Text style={popupStyles.featureText}>{feature.text}</Text>
                </View>
              )) : (
                <ActivityIndicator color={colors.primary} size="small" />
              )}
            </View>

            {/* Price section */}
            <View style={popupStyles.priceContainer}>
              {plan?.original_price && (
                <Text style={popupStyles.originalPrice}>
                  ₹{plan.original_price.toLocaleString('en-IN')}{plan.period_label}
                </Text>
              )}
              <View style={popupStyles.priceRow}>
                <Text style={popupStyles.price}>₹{plan?.price ?? '...'}</Text>
                <Text style={popupStyles.pricePeriod}>{plan?.period_label ?? ''}</Text>
              </View>
              {plan?.discount_label && (
                <View style={popupStyles.savingsBadge}>
                  <Text style={popupStyles.savingsText}>{plan.discount_label}</Text>
                </View>
              )}
            </View>

            {/* Purchase button */}
            <Pressable
              style={[popupStyles.purchaseButton, isProcessing && { opacity: 0.6 }]}
              disabled={isProcessing}
              onPress={onPurchase}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={popupStyles.purchaseGradient}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="flash" size={20} color={colors.text} />
                    <Text style={popupStyles.purchaseText}>Unlock Premium</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>

            {/* Watch ad option */}
            <Pressable style={popupStyles.watchAdButton} onPress={onClose}>
              <Ionicons name="play-circle-outline" size={18} color={colors.textSecondary} />
              <Text style={popupStyles.watchAdText}>Watch ad for 3 more likes</Text>
            </Pressable>

            {/* Terms */}
            <Text style={popupStyles.terms}>
              Cancel anytime. Recurring billing.
            </Text>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
};

// Custom Slider Component
const DistanceSlider: React.FC<{
  value: number;
  onValueChange: (value: number) => void;
  minValue?: number;
  maxValue?: number;
}> = ({ value, onValueChange, minValue = 1, maxValue = 100 }) => {
  const sliderWidth = useRef(0);
  const sliderRef = useRef<View>(null);

  const calculateValue = (pageX: number) => {
    if (sliderWidth.current === 0) return value;
    sliderRef.current?.measure((x, y, width, height, pageXOffset) => {
      const touchX = pageX - pageXOffset;
      const percentage = Math.max(0, Math.min(1, touchX / width));
      const newValue = Math.round(minValue + percentage * (maxValue - minValue));
      onValueChange(newValue);
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        calculateValue(evt.nativeEvent.pageX);
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        calculateValue(evt.nativeEvent.pageX);
      },
    })
  ).current;

  const percentage = ((value - minValue) / (maxValue - minValue)) * 100;

  return (
    <View
      ref={sliderRef}
      style={filterStyles.sliderContainer}
      onLayout={(e) => {
        sliderWidth.current = e.nativeEvent.layout.width;
      }}
      {...panResponder.panHandlers}
    >
      <View style={filterStyles.sliderTrack}>
        <View style={[filterStyles.sliderFill, { width: `${percentage}%` }]} />
      </View>
      <View style={[filterStyles.sliderThumb, { left: `${percentage}%` }]} />
    </View>
  );
};

// Filter Modal Component
const FilterModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onApply: () => void;
  loading: boolean;
  error: string | null;
  ageRange: { min: number; max: number };
  setAgeRange: (range: { min: number; max: number }) => void;
  distance: number;
  setDistance: (d: number) => void;
  selectedGender: string;
  setSelectedGender: (g: string) => void;
  selectedInterests: string[];
  setSelectedInterests: (i: string[]) => void;
}> = ({
  visible,
  onClose,
  onApply,
  loading,
  error,
  ageRange,
  setAgeRange,
  distance,
  setDistance,
  selectedGender,
  setSelectedGender,
  selectedInterests,
  setSelectedInterests,
}) => {
  const filterInsets = useSafeAreaInsets();
  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter(i => i !== interest));
    } else {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
    >
      <View style={filterStyles.overlay}>
        <View style={filterStyles.container}>
          <LinearGradient
            colors={['#1a1a1a', '#0d0d0d']}
            style={[filterStyles.gradient, { paddingBottom: spacing.xl + filterInsets.bottom }]}
          >
            {/* Header */}
            <View style={filterStyles.header}>
              <Text style={filterStyles.title}>Discovery Filters</Text>
              <Pressable style={filterStyles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView
              style={filterStyles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Gender Preference */}
              <View style={filterStyles.section}>
                <Text style={filterStyles.sectionTitle}>Who would you like to see?</Text>
                <View style={filterStyles.genderContainer}>
                  {GENDER_OPTIONS.map((option) => (
                    <Pressable
                      key={option.id}
                      style={[
                        filterStyles.genderButton,
                        selectedGender === option.id && filterStyles.genderButtonActive,
                      ]}
                      onPress={() => setSelectedGender(option.id)}
                    >
                      <Ionicons
                        name={option.icon}
                        size={20}
                        color={selectedGender === option.id ? colors.text : colors.textSecondary}
                      />
                      <Text
                        style={[
                          filterStyles.genderText,
                          selectedGender === option.id && filterStyles.genderTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Age Preference */}
              <View style={filterStyles.section}>
                <Text style={filterStyles.sectionTitle}>Age Preference</Text>
                <View style={filterStyles.rangeContainer}>
                  <View style={filterStyles.rangeInput}>
                    <Text style={filterStyles.rangeLabel}>Min</Text>
                    <View style={filterStyles.rangeControls}>
                      <Pressable
                        style={filterStyles.rangeButton}
                        onPress={() => setAgeRange({ ...ageRange, min: Math.max(18, ageRange.min - 1) })}
                      >
                        <Ionicons name="remove" size={18} color={colors.text} />
                      </Pressable>
                      <Text style={filterStyles.rangeValue}>{ageRange.min}</Text>
                      <Pressable
                        style={filterStyles.rangeButton}
                        onPress={() => setAgeRange({ ...ageRange, min: Math.min(ageRange.max - 1, ageRange.min + 1) })}
                      >
                        <Ionicons name="add" size={18} color={colors.text} />
                      </Pressable>
                    </View>
                  </View>
                  <Text style={filterStyles.rangeSeparator}>to</Text>
                  <View style={filterStyles.rangeInput}>
                    <Text style={filterStyles.rangeLabel}>Max</Text>
                    <View style={filterStyles.rangeControls}>
                      <Pressable
                        style={filterStyles.rangeButton}
                        onPress={() => setAgeRange({ ...ageRange, max: Math.max(ageRange.min + 1, ageRange.max - 1) })}
                      >
                        <Ionicons name="remove" size={18} color={colors.text} />
                      </Pressable>
                      <Text style={filterStyles.rangeValue}>{ageRange.max}</Text>
                      <Pressable
                        style={filterStyles.rangeButton}
                        onPress={() => setAgeRange({ ...ageRange, max: Math.min(99, ageRange.max + 1) })}
                      >
                        <Ionicons name="add" size={18} color={colors.text} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>

              {/* Distance */}
              <View style={filterStyles.section}>
                <View style={filterStyles.distanceHeader}>
                  <Text style={filterStyles.sectionTitle}>Maximum Distance</Text>
                  <Text style={filterStyles.distanceValue}>{distance} km</Text>
                </View>
                <DistanceSlider
                  value={distance}
                  onValueChange={setDistance}
                  minValue={1}
                  maxValue={100}
                />
                <View style={filterStyles.distanceLabels}>
                  <Text style={filterStyles.distanceLabel}>1 km</Text>
                  <Text style={filterStyles.distanceLabel}>100 km</Text>
                </View>
              </View>

              {/* Shared Interests */}
              <View style={filterStyles.section}>
                <Text style={filterStyles.sectionTitle}>Shared Interests</Text>
                <Text style={filterStyles.sectionSubtitle}>Match with people who share your passions</Text>
                <View style={filterStyles.interestsContainer}>
                  {INTEREST_OPTIONS.map((interest) => (
                    <Pressable
                      key={interest}
                      style={[
                        filterStyles.interestChip,
                        selectedInterests.includes(interest) && filterStyles.interestChipActive,
                      ]}
                      onPress={() => toggleInterest(interest)}
                    >
                      <Text
                        style={[
                          filterStyles.interestText,
                          selectedInterests.includes(interest) && filterStyles.interestTextActive,
                        ]}
                      >
                        {interest}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={{ height: spacing.xl }} />
            </ScrollView>

            {/* Error message */}
            {error && (
              <View style={filterStyles.errorContainer}>
                <Ionicons name="alert-circle" size={20} color={colors.error} />
                <Text style={filterStyles.errorText}>{error}</Text>
              </View>
            )}

            {/* Apply Button */}
            <Pressable
              style={[filterStyles.applyButton, loading && filterStyles.applyButtonDisabled]}
              onPress={onApply}
              disabled={loading}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={filterStyles.applyGradient}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color={colors.text} />
                    <Text style={filterStyles.applyText}>Apply Filters</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
};

// Shimmer Card Component for loading
const ShimmerProfileCard: React.FC = () => (
  <View style={[styles.shimmerCard, { width: CARD_WIDTH, height: CARD_HEIGHT }]}>
    <View style={styles.shimmerContent} />
  </View>
);

export const DiscoverScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { getAvailableProfiles, swipeProfile, undoLastSwipe, fetchRecommendedUsers, isLoading, isPremium, refreshPremiumStatus, swipesRemaining, dailySwipeLimit, error: matchError, clearError } = useMatches();
  const { user, updateDiscoveryFilters, error: contextError } = useUser();

  const [swipedCount, setSwipedCount] = useState(0);
  const [showPremiumPopup, setShowPremiumPopup] = useState(false);
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);
  const [monthlyPlan, setMonthlyPlan] = useState<SubscriptionPlan | null>(null);

  // Filter states
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [ageRange, setAgeRange] = useState({ min: 18, max: 35 });
  const [distance, setDistance] = useState(25);
  const [selectedGender, setSelectedGender] = useState('everyone');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [filterLoading, setFilterLoading] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);

  // Fetch recommended users from API on mount
  useEffect(() => {
    console.log('[DiscoverScreen] Fetching recommended users on mount');
    fetchRecommendedUsers(30); // Fetch 30 profiles initially
  }, [fetchRecommendedUsers]);

  // Fetch monthly plan for premium popup
  useEffect(() => {
    if (showPremiumPopup && !monthlyPlan) {
      getPlans()
        .then((plans) => {
          const monthly = plans.find((p) => p.plan_key === 'monthly') || null;
          setMonthlyPlan(monthly);
        })
        .catch((err) => console.error('[DiscoverScreen] Failed to fetch plans:', err));
    }
  }, [showPremiumPopup, monthlyPlan]);

  // Sync filter state with user preferences when modal opens
  useEffect(() => {
    if (showFilterModal && user) {
      // Load current preferences from user context
      const currentAgeMin = user.preferences?.ageRange?.min || 18;
      const currentAgeMax = user.preferences?.ageRange?.max || 35;
      const currentDistance = user.preferences?.maxDistance || 25;
      const currentGender = mapInterestedInToGender(user.interestedIn || []);

      setAgeRange({ min: currentAgeMin, max: currentAgeMax });
      setDistance(currentDistance);
      setSelectedGender(currentGender);
      setFilterError(null);
    }
  }, [showFilterModal, user]);

  // Apply filters handler
  const handleApplyFilters = useCallback(async () => {
    setFilterLoading(true);
    setFilterError(null);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Update backend preferences
    const success = await updateDiscoveryFilters(
      ageRange.min,
      ageRange.max,
      distance,
      selectedGender
    );

    setFilterLoading(false);

    if (success) {
      // Close modal
      setShowFilterModal(false);

      // Refresh discovery feed with new filters
      // Backend will use updated preferences automatically
      fetchRecommendedUsers(30);

      // Show success feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      // Show error
      setFilterError(contextError || 'Failed to apply filters');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [ageRange, distance, selectedGender, updateDiscoveryFilters, contextError, fetchRecommendedUsers]);

  const profiles = useMemo(() => getAvailableProfiles(), [getAvailableProfiles, swipedCount]);
  const remainingFreeSwipes = swipesRemaining ?? 0;

  // Show premium popup when server reports swipe limit reached
  useEffect(() => {
    if (matchError === 'SWIPE_LIMIT_REACHED') {
      setShowPremiumPopup(true);
      clearError();
    }
  }, [matchError, clearError]);

  const handleSwipe = useCallback(async (direction: SwipeDirection) => {
    if (profiles.length === 0) return;

    // Check if user has reached the free limit (server-enforced, local check for instant UX)
    if (!isPremium && swipesRemaining !== null && swipesRemaining <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setShowPremiumPopup(true);
      return;
    }

    const currentProfile = profiles[0];

    Haptics.impactAsync(
      direction === 'up'
        ? Haptics.ImpactFeedbackStyle.Heavy
        : Haptics.ImpactFeedbackStyle.Medium
    );

    setSwipedCount(prev => prev + 1);

    // Swipe is now async — server enforces limit and returns updated remaining count
    const match = await swipeProfile(currentProfile.id, direction);

    if (match) {
      setTimeout(() => {
        navigation.navigate('MatchScreen', { match });
      }, 400);
    }

    // Show popup when swipes just ran out (swipesRemaining updated by context from response)
    // This is handled via the useEffect watching matchError above

    // Fetch more profiles when running low
    if (profiles.length < 5) {
      console.log('[DiscoverScreen] Running low on profiles, fetching more');
      fetchRecommendedUsers(20);
    }
  }, [profiles, swipeProfile, navigation, swipesRemaining, isPremium, fetchRecommendedUsers]);

  const handleUndo = useCallback(() => {
    undoLastSwipe();
    setSwipedCount(prev => Math.max(0, prev - 1));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [undoLastSwipe]);

  const handleProfilePress = useCallback(async (profile: Profile) => {
    // Track view (fire-and-forget)
    trackProfileView(profile.id, 'discovery').catch(err => {
      console.log('[DiscoverScreen] Profile view tracking failed (silent):', err);
      // Don't block navigation or show error
    });

    navigation.navigate('ProfileDetail', { profile });
  }, [navigation]);

  const handleButtonSwipe = useCallback((direction: SwipeDirection) => {
    handleSwipe(direction);
  }, [handleSwipe]);

  const handleFilterPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowFilterModal(true);
  }, []);

  const handleNotificationPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Notifications', 'You have no new notifications');
  }, []);

  const handlePurchase = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsPaymentProcessing(true);
    startPayment(
      'monthly',
      () => {
        setIsPaymentProcessing(false);
        setShowPremiumPopup(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Welcome to Premium!', 'Your subscription is now active. Enjoy unlimited likes!');
        refreshPremiumStatus();
      },
      (message) => {
        setIsPaymentProcessing(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Payment Failed', message);
      }
    );
  }, [refreshPremiumStatus]);

  if (profiles.length === 0) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../../assets/images/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={styles.logo}>InBlood</Text>
            </View>
            <Pressable style={styles.filterButton} onPress={handleFilterPress}>
              <Ionicons name="options-outline" size={22} color={colors.text} />
            </Pressable>
          </View>

          <Animated.View
            entering={FadeIn}
            style={styles.emptyContainer}
          >
            <View style={styles.emptyIconOuter}>
              <LinearGradient
                colors={['rgba(229, 57, 53, 0.2)', 'rgba(229, 57, 53, 0.05)']}
                style={styles.emptyIconGradient}
              >
                <View style={styles.emptyIcon}>
                  <Ionicons name="heart-dislike-outline" size={48} color={colors.primary} />
                </View>
              </LinearGradient>
            </View>
            <Text style={styles.emptyTitle}>No more profiles</Text>
            <Text style={styles.emptyText}>
              You've seen everyone in your area.{'\n'}
              Check back later for new matches!
            </Text>
            <Pressable
              style={styles.refreshButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                fetchRecommendedUsers(30);
              }}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                style={styles.refreshGradient}
              >
                <Ionicons name="refresh" size={20} color={colors.text} />
                <Text style={styles.refreshText}>Refresh</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </SafeAreaView>

        {/* Filter Modal - must be outside SafeAreaView to render as overlay */}
        <FilterModal
          visible={showFilterModal}
          onClose={() => setShowFilterModal(false)}
          onApply={handleApplyFilters}
          loading={filterLoading}
          error={filterError}
          ageRange={ageRange}
          setAgeRange={setAgeRange}
          distance={distance}
          setDistance={setDistance}
          selectedGender={selectedGender}
          setSelectedGender={setSelectedGender}
          selectedInterests={selectedInterests}
          setSelectedInterests={setSelectedInterests}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Modern Header */}
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.header}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/images/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.logo}>InBlood</Text>
            {isPremium && (
              <View style={styles.premiumTag}>
                <Ionicons name="diamond" size={12} color="#FFD700" />
              </View>
            )}
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.headerButton} onPress={handleNotificationPress}>
              <Ionicons name="notifications-outline" size={22} color={colors.text} />
              <View style={styles.notificationDot} />
            </Pressable>
            <Pressable style={styles.filterButton} onPress={handleFilterPress}>
              <Ionicons name="options-outline" size={22} color={colors.text} />
            </Pressable>
          </View>
        </Animated.View>

        {/* Profile count indicator with remaining swipes */}
        <Animated.View entering={FadeIn.delay(200)} style={styles.profileCountContainer}>
          <Text style={styles.profileCountText}>
            <Text style={styles.profileCountNumber}>{profiles.length}</Text> profiles nearby
          </Text>
          {!isPremium && (
            <View style={styles.swipeCounter}>
              <Ionicons name="heart" size={14} color={remainingFreeSwipes <= 3 ? colors.primary : colors.textMuted} />
              <Text style={[
                styles.swipeCounterText,
                remainingFreeSwipes <= 3 && styles.swipeCounterWarning
              ]}>
                {remainingFreeSwipes} likes left
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Card Stack */}
        <Animated.View
          entering={FadeIn.delay(150).springify()}
          style={styles.cardContainer}
        >
          {/* Ambient glow behind cards */}
          <View style={styles.ambientGlow} />

          {isLoading && profiles.length === 0 ? (
            // Show shimmer when initially loading
            Array.from({ length: 3 }).map((_, index) => (
              <View
                key={`shimmer-${index}`}
                style={[
                  styles.shimmerCardWrapper,
                  {
                    zIndex: index,
                    transform: [
                      { scale: 1 - index * 0.02 },
                      { translateY: -index * 10 },
                    ],
                  },
                ]}
              >
                <ShimmerProfileCard />
              </View>
            ))
          ) : (
            profiles.slice(0, 3).reverse().map((profile, index) => (
              <SwipeCard
                key={profile.id}
                profile={profile}
                index={2 - index}
                onSwipe={handleSwipe}
                onPress={() => handleProfilePress(profile)}
              />
            ))
          )}
        </Animated.View>

        {/* Modern Action Buttons */}
        <Animated.View entering={SlideInDown.delay(300).springify()} style={styles.actionsContainer}>
          <ActionButton
            type="undo"
            size="small"
            onPress={handleUndo}
            disabled={swipedCount === 0}
          />
          <ActionButton
            type="pass"
            size="large"
            onPress={() => handleButtonSwipe('left')}
          />
          <ActionButton
            type="superLike"
            size="medium"
            onPress={() => handleButtonSwipe('up')}
          />
          <ActionButton
            type="like"
            size="large"
            onPress={() => handleButtonSwipe('right')}
          />
          <Pressable style={styles.boostButton} onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert('Boost', 'Boost your profile to be seen by more people!\n\nPrice: ₹49 for 30 minutes');
          }}>
            <LinearGradient
              colors={['#9C27B0', '#7B1FA2']}
              style={styles.boostGradient}
            >
              <Ionicons name="flash" size={20} color={colors.text} />
            </LinearGradient>
          </Pressable>
        </Animated.View>

        {/* Modern swipe hints */}
        <Animated.View entering={FadeInUp.delay(500)} style={styles.hintsContainer}>
          <View style={styles.hintPill}>
            <View style={[styles.hintIcon, { backgroundColor: 'rgba(158, 158, 158, 0.2)' }]}>
              <Ionicons name="close" size={12} color={colors.textMuted} />
            </View>
            <Text style={styles.hintText}>Pass</Text>
          </View>
          <View style={styles.hintPill}>
            <View style={[styles.hintIcon, { backgroundColor: 'rgba(255, 215, 0, 0.2)' }]}>
              <Ionicons name="star" size={12} color={colors.superLike} />
            </View>
            <Text style={styles.hintText}>Super Like</Text>
          </View>
          <View style={styles.hintPill}>
            <View style={[styles.hintIcon, { backgroundColor: 'rgba(229, 57, 53, 0.2)' }]}>
              <Ionicons name="heart" size={12} color={colors.primary} />
            </View>
            <Text style={styles.hintText}>Like</Text>
          </View>
        </Animated.View>
      </SafeAreaView>

      {/* Premium Popup */}
      <PremiumPopup
        visible={showPremiumPopup}
        onClose={() => setShowPremiumPopup(false)}
        onPurchase={handlePurchase}
        isProcessing={isPaymentProcessing}
        plan={monthlyPlan}
      />

      {/* Filter Modal */}
      <FilterModal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        onApply={handleApplyFilters}
        loading={filterLoading}
        error={filterError}
        ageRange={ageRange}
        setAgeRange={setAgeRange}
        distance={distance}
        setDistance={setDistance}
        selectedGender={selectedGender}
        setSelectedGender={setSelectedGender}
        selectedInterests={selectedInterests}
        setSelectedInterests={setSelectedInterests}
      />
    </View>
  );
};

const popupStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  container: {
    width: '100%',
    maxWidth: 360,
    borderRadius: borderRadius.xxl,
    overflow: 'hidden',
  },
  gradient: {
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: borderRadius.xxl,
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
  premiumBadge: {
    marginBottom: spacing.md,
  },
  badgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    gap: 6,
  },
  badgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: '#000',
    letterSpacing: 1,
  },
  heartContainer: {
    marginBottom: spacing.lg,
  },
  heartGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infinityBadge: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.superLike,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#1a1a1a',
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  features: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  featureText: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  priceContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  originalPrice: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  price: {
    fontSize: 42,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  pricePeriod: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  savingsBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
  },
  savingsText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: '#4CAF50',
  },
  purchaseButton: {
    width: '100%',
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  purchaseGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md + 2,
    gap: spacing.sm,
  },
  purchaseText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  watchAdButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  watchAdText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  terms: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logoImage: {
    width: 32,
    height: 32,
  },
  logo: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    letterSpacing: -0.5,
  },
  premiumTag: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    padding: 4,
    borderRadius: borderRadius.sm,
    marginLeft: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.card,
  },
  filterButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  profileCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    gap: spacing.md,
  },
  profileCountText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  profileCountNumber: {
    color: colors.primary,
    fontWeight: fontWeight.bold,
  },
  swipeCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  swipeCounterText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
  },
  swipeCounterWarning: {
    color: colors.primary,
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -spacing.sm,
  },
  ambientGlow: {
    position: 'absolute',
    width: CARD_WIDTH + 40,
    height: CARD_HEIGHT + 40,
    borderRadius: CARD_WIDTH / 2,
    backgroundColor: colors.primary,
    opacity: 0.06,
    top: '50%',
    marginTop: -(CARD_HEIGHT + 40) / 2,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 80,
  },
  boostButton: {
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#9C27B0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  boostGradient: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },
  hintsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  hintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    gap: 6,
  },
  hintIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hintText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIconOuter: {
    marginBottom: spacing.lg,
  },
  emptyIconGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  refreshButton: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  refreshGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  refreshText: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  // Shimmer styles
  shimmerCardWrapper: {
    position: 'absolute',
  },
  shimmerCard: {
    borderRadius: borderRadius.xxl,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  shimmerContent: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
});

const filterStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    overflow: 'hidden',
  },
  gradient: {
    paddingBottom: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    maxHeight: SCREEN_HEIGHT * 0.6,
    paddingHorizontal: spacing.lg,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  sectionSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  genderContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  genderButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: spacing.xs,
  },
  genderButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  genderText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  genderTextActive: {
    color: colors.text,
  },
  rangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  rangeInput: {
    alignItems: 'center',
  },
  rangeLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  rangeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  rangeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  rangeValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    minWidth: 50,
    textAlign: 'center',
  },
  rangeSeparator: {
    fontSize: fontSize.md,
    color: colors.textMuted,
  },
  distanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  distanceValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  distanceLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  distanceLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  sliderContainer: {
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  sliderTrack: {
    height: 6,
    backgroundColor: colors.card,
    borderRadius: 3,
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  sliderThumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.text,
    marginLeft: -12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  interestChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  interestChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  interestText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  interestTextActive: {
    color: colors.text,
    fontWeight: fontWeight.medium,
  },
  applyButton: {
    margin: spacing.lg,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  applyGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md + 2,
    gap: spacing.sm,
  },
  applyText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error + '15',
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.error,
    flex: 1,
  },
  applyButtonDisabled: {
    opacity: 0.5,
  },
});
