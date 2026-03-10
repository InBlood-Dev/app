import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Image,
  Dimensions,
  Pressable,
  Modal,
  PanResponder,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ActionButton, InterestChip } from '../../components';
import { useMatches, useUser } from '../../context';
import { trackProfileView, createOrGetConversation } from '../../services/interactions.service';
import { Profile, SwipeDirection } from '../../types';
import { colors, fontSize, fontWeight, spacing, borderRadius, shadows } from '../../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Photo sheet constants
const PHOTO_GRID_COLUMNS = 3;
const PHOTO_GAP = 4;
const PHOTO_SIZE = (SCREEN_WIDTH - spacing.lg * 2 - PHOTO_GAP * (PHOTO_GRID_COLUMNS - 1)) / PHOTO_GRID_COLUMNS;
const COLLAPSED_HEIGHT = 55;
const EXPANDED_HEIGHT = SCREEN_HEIGHT * 0.70;

type RootStackParamList = {
  ProfileDetail: { profile: Profile; isMatched?: boolean };
  MatchScreen: { match: any };
};

type ProfileDetailRouteProp = RouteProp<RootStackParamList, 'ProfileDetail'>;

// Draggable Photo Sheet Component
const PhotoSheet: React.FC<{
  photos: string[];
  onPhotoPress: (index: number) => void;
}> = ({ photos, onPhotoPress }) => {
  const sheetInsets = useSafeAreaInsets();
  const translateY = useSharedValue(0);
  const contextY = useSharedValue(0);
  const isExpanded = useSharedValue(false);
  const scrollOffset = useSharedValue(0);
  const scrollViewRef = useRef<ScrollView>(null);

  // Wrapper functions for runOnJS
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
      // If expanded and scrolled down, don't allow dragging down until scroll reaches top
      if (isExpanded.value && scrollOffset.value > 0 && event.translationY > 0) {
        return;
      }

      const newY = contextY.value + event.translationY;
      // Clamp between collapsed and expanded
      translateY.value = Math.max(
        -(EXPANDED_HEIGHT - COLLAPSED_HEIGHT),
        Math.min(0, newY)
      );
    })
    .onEnd((event) => {
      // If expanded and scrolled down, don't collapse
      if (isExpanded.value && scrollOffset.value > 5) {
        return;
      }

      const velocity = event.velocityY;
      const currentY = translateY.value;
      const midPoint = -(EXPANDED_HEIGHT - COLLAPSED_HEIGHT) / 2;

      // Determine snap position based on velocity and position
      if (velocity < -500) {
        // Fast swipe up - expand
        runOnJS(triggerHaptic)();
        isExpanded.value = true;
        translateY.value = withTiming(-(EXPANDED_HEIGHT - COLLAPSED_HEIGHT), {
          duration: 300,
        });
      } else if (velocity > 500) {
        // Fast swipe down - collapse
        runOnJS(triggerHaptic)();
        isExpanded.value = false;
        translateY.value = withTiming(0, {
          duration: 300,
        });
        runOnJS(resetScroll)();
      } else {
        // Slow drag - snap to nearest
        if (currentY < midPoint) {
          isExpanded.value = true;
          translateY.value = withTiming(-(EXPANDED_HEIGHT - COLLAPSED_HEIGHT), {
            duration: 300,
          });
        } else {
          isExpanded.value = false;
          translateY.value = withTiming(0, {
            duration: 300,
          });
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

  // Fade out hint when expanding, fade in grid
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
      {/* Overlay when expanded */}
      <Animated.View style={[sheetStyles.overlay, overlayOpacity]} />

      {/* Sheet */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[sheetStyles.container, { bottom: -(EXPANDED_HEIGHT - COLLAPSED_HEIGHT) + sheetInsets.bottom }, sheetAnimatedStyle]}>
          {/* Handle */}
          <View style={sheetStyles.handleContainer}>
            <Animated.View style={[sheetStyles.handle, handleIndicatorStyle]} />
          </View>

          {/* Header */}
          <View style={sheetStyles.header}>
            <Text style={sheetStyles.title}>Photos</Text>
            <Text style={sheetStyles.photoCount}>{photos.length} photos</Text>
          </View>

          {/* Collapsed hint - swipe up indicator */}
          <Animated.View style={[sheetStyles.collapsedHint, hintOpacity]}>
            <Ionicons name="chevron-up" size={16} color={colors.textMuted} />
            <Text style={sheetStyles.collapsedHintText}>Swipe up to view</Text>
          </Animated.View>

          {/* Photo Grid - Expanded */}
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

// Photo Viewer Component
const PhotoViewer: React.FC<{
  visible: boolean;
  photos: string[];
  initialIndex: number;
  onClose: () => void;
}> = ({ visible, photos, initialIndex, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const translateX = useSharedValue(0);
  const contextX = useSharedValue(0);

  React.useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to significant horizontal movement
        return Math.abs(gestureState.dx) > 10;
      },
      onPanResponderGrant: () => {
        contextX.value = translateX.value;
      },
      onPanResponderMove: (_, gestureState) => {
        translateX.value = contextX.value + gestureState.dx;
      },
      onPanResponderRelease: (_, gestureState) => {
        const swipeThreshold = SCREEN_WIDTH * 0.25;

        if (gestureState.dx < -swipeThreshold && currentIndex < photos.length - 1) {
          // Swipe left - next photo
          setCurrentIndex(currentIndex + 1);
          translateX.value = withSpring(0);
        } else if (gestureState.dx > swipeThreshold && currentIndex > 0) {
          // Swipe right - previous photo
          setCurrentIndex(currentIndex - 1);
          translateX.value = withSpring(0);
        } else {
          // Return to center
          translateX.value = withSpring(0);
        }
      },
    })
  ).current;

  const imageAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={viewerStyles.container}>
        <Pressable style={viewerStyles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={28} color={colors.text} />
        </Pressable>

        <Animated.View
          style={[viewerStyles.imageContainer, imageAnimatedStyle]}
          {...panResponder.panHandlers}
        >
          <Image
            source={{ uri: photos[currentIndex] }}
            style={viewerStyles.image}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Photo indicators */}
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

        {/* Navigation arrows */}
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

export const ProfileDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<ProfileDetailRouteProp>();
  const insets = useSafeAreaInsets();
  const { swipeProfile } = useMatches();
  const { fetchOtherUser } = useUser();

  const { profile: initialProfile, isMatched = false } = route.params;
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);

  // Lazy load full profile if only partial data was passed
  React.useEffect(() => {
    const loadFullProfile = async () => {
      // If profile doesn't have prompts, it might be partial - fetch full data
      if (profile?.id && !profile.prompts) {
        setIsLoading(true);
        const fullProfile = await fetchOtherUser(profile.id);
        if (fullProfile) {
          // Preserve stats from initial profile if full profile doesn't have them
          // (GET /users/:userId may not return stats)
          setProfile({
            ...fullProfile,
            stats: fullProfile.stats?.seductions || fullProfile.stats?.likes
              ? fullProfile.stats
              : initialProfile.stats,
          });
        }
        setIsLoading(false);
      }
    };

    loadFullProfile();
  }, [profile?.id, profile.prompts, fetchOtherUser, initialProfile.stats]);

  // Track profile view (fire-and-forget, 24h debounce on backend)
  React.useEffect(() => {
    if (initialProfile?.id) {
      trackProfileView(initialProfile.id, 'profile').catch(() => {});
    }
  }, [initialProfile?.id]);

  const handleSwipe = useCallback(async (direction: SwipeDirection) => {
    navigation.goBack();

    // Swipe is now async
    const match = await swipeProfile(profile.id, direction);

    if (match) {
      setTimeout(() => {
        navigation.navigate('MatchScreen', { match });
      }, 300);
    }
  }, [profile, swipeProfile, navigation]);

  const [isChatLoading, setIsChatLoading] = useState(false);

  const handleChat = useCallback(async () => {
    if (isChatLoading) return;
    setIsChatLoading(true);
    try {
      const response = await createOrGetConversation(profile.id);
      if (response.success && response.data) {
        navigation.navigate('ChatScreen', {
          matchId: null,
          conversationId: response.data.conversation_id,
          profile,
        });
      } else {
        Alert.alert('Error', response.message || 'Could not start conversation.');
      }
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Could not start conversation. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setIsChatLoading(false);
    }
  }, [profile, navigation, isChatLoading]);

  return (
    <View style={styles.container}>
      {/* Close button */}
      <Pressable
        style={[styles.closeButton, { top: insets.top - 30 }]}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="chevron-down" size={28} color={colors.text} />
      </Pressable>

      {/* Content */}
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: COLLAPSED_HEIGHT + (isMatched ? 60 : 140) + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Loading indicator for lazy loading */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}

        {/* Profile Info Card */}
        <Animated.View entering={FadeInUp.delay(100)} style={styles.infoCard}>
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
                <Text style={styles.statNumber}>
                  {profile.stats?.seductions?.toLocaleString() || '0'}
                </Text>
                <Text style={styles.statLabel}>SEDUCTIONS</Text>
              </View>

              {/* Spacer for profile image */}
              <View style={styles.statsImageSpacer} />

              {/* Right Stats */}
              <View style={styles.statsSide}>
                <Text style={styles.statNumber}>{profile.stats?.likes || 0}</Text>
                <Text style={styles.statLabel}>LIKES</Text>
              </View>
            </View>

            {/* Center Profile Image (overlapping) */}
            <View style={styles.profileImageContainer}>
              <Image source={{ uri: profile.photos[0] }} style={styles.statsProfileImage} />
              <View style={styles.profileImageBorder} />
            </View>
          </View>

          {/* Name and Age */}
          <View style={styles.nameSection}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{profile.name}</Text>
              <Text style={styles.age}>, {profile.age}</Text>
              {profile.verified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                </View>
              )}
            </View>

            {/* Pronouns */}
            {profile.pronouns && (
              <Text style={styles.pronouns}>{profile.pronouns}</Text>
            )}

            {/* Location */}
            <View style={styles.locationRow}>
              <Ionicons name="location" size={16} color={colors.textSecondary} />
              <Text style={styles.location}>
                {profile.location.city}
                {profile.location.distance != null && profile.location.distance > 0 && ` • ${profile.location.distance} km away`}
              </Text>
            </View>

            {/* Match percentage */}
            {profile.matchPercentage && (
              <View style={styles.matchBadge}>
                <Text style={styles.matchText}>{profile.matchPercentage}% Match</Text>
              </View>
            )}
          </View>

          {/* Bio */}
          {profile.bio && (
            <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
              <Text style={styles.sectionTitle}>About Me</Text>
              <Text style={styles.bio}>{profile.bio}</Text>
            </Animated.View>
          )}

          {/* Tags */}
          {profile.tags && profile.tags.length > 0 && (
            <Animated.View entering={FadeInDown.delay(225)} style={styles.section}>
              <Text style={styles.sectionTitle}>TAGS</Text>
              <View style={styles.tagsContainer}>
                {profile.tags.map((tag, index) => (
                  <View key={index} style={styles.tagChip}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          )}

          {/* Prompts */}
          {profile.prompts && profile.prompts.length > 0 && (
            <Animated.View entering={FadeInDown.delay(250)} style={styles.section}>
              <Text style={styles.sectionTitle}>THE NARRATIVE</Text>
              {profile.prompts.map((prompt, index) => (
                <View key={index} style={styles.promptCard}>
                  <Text style={styles.promptQuestion}>{prompt.question}</Text>
                  <Text style={styles.promptAnswer}>{prompt.answer}</Text>
                </View>
              ))}
            </Animated.View>
          )}

          {/* Connected Accounts - Backend doesn't provide this yet */}
          {/* Hidden until backend support is added */}

          {/* Interests */}
          {profile.interests.length > 0 && (
            <Animated.View entering={FadeInDown.delay(300)} style={styles.section}>
              <Text style={styles.sectionTitle}>Interests</Text>
              <View style={styles.interestsContainer}>
                {profile.interests.map((interest, index) => (
                  <InterestChip key={index} label={interest} disabled />
                ))}
              </View>
            </Animated.View>
          )}
        </Animated.View>

        {/* Bottom spacing */}
        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Action Buttons - shown when not opened from chat */}
      {!isMatched && (
        <View style={[styles.actionBar, { bottom: COLLAPSED_HEIGHT + 12 + insets.bottom }]}>
          <ActionButton type="pass" onPress={() => handleSwipe('left')} size="medium" />
          <ActionButton type="superLike" onPress={() => handleSwipe('up')} size="medium" />
          <ActionButton type="like" onPress={() => handleSwipe('right')} size="large" />
          <ActionButton type="chat" onPress={handleChat} size="medium" disabled={isChatLoading} />
        </View>
      )}

      {/* Photo Viewer Modal */}
      <PhotoViewer
        visible={showPhotoViewer}
        photos={profile.photos}
        initialIndex={currentPhotoIndex}
        onClose={() => setShowPhotoViewer(false)}
      />

      {/* Photo Sheet - Swipeable */}
      <PhotoSheet
        photos={profile.photos}
        onPhotoPress={(index) => {
          setCurrentPhotoIndex(index);
          setShowPhotoViewer(true);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  closeButton: {
    position: 'absolute',
    right: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
    zIndex: 5,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: spacing.md,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 100,
  },
  infoCard: {
    backgroundColor: colors.background,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  statsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.md,
    position: 'relative',
    height: 160,
    overflow: 'visible',
  },
  leftEllipse: {
    position: 'absolute',
    width: 92,
    height: 66,
    left: 40,
    borderRadius: 46,
    backgroundColor: '#FBBC05',
    opacity: 0.6,
    zIndex: -1,
    // iOS glow via shadow (no effect on Android)
    shadowColor: '#FBBC05',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 30,
    // No elevation — on Android it raises the solid shape above everything
  },
  rightEllipse: {
    position: 'absolute',
    width: 92,
    height: 66,
    right: 40,
    borderRadius: 46,
    backgroundColor: '#D32F2F',
    opacity: 0.6,
    zIndex: -1,
    shadowColor: '#D32F2F',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 30,
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
    width: SCREEN_WIDTH - spacing.lg * 2,
    height: 90,
    paddingHorizontal: spacing.md,
    position: 'absolute',
    zIndex: 1,
    elevation: 2,
  },
  statsSide: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
  },
  statsImageSpacer: {
    flex: 1,
  },
  statNumber: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  profileImageContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    overflow: 'hidden',
    zIndex: 2,
    elevation: 3,
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  profileImageBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 75,
    borderWidth: 0,
  },
  statsProfileImage: {
    width: '100%',
    height: '100%',
  },
  nameSection: {
    marginBottom: spacing.lg,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  pronouns: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  name: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  age: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  verifiedBadge: {
    marginLeft: spacing.sm,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  location: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  matchBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
  },
  matchText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  bio: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  promptCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  promptQuestion: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    fontWeight: fontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  promptAnswer: {
    fontSize: fontSize.lg,
    color: colors.text,
    lineHeight: 24,
    fontWeight: fontWeight.medium,
  },
  connectedAccountsContainer: {
    gap: spacing.md,
  },
  connectedAccount: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accountIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: 2,
  },
  accountStatus: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tagChip: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  tagText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  photoThumb: {
    width: (SCREEN_WIDTH - spacing.lg * 2 - spacing.sm * 2) / 3,
    aspectRatio: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  photoThumbImage: {
    width: '100%',
    height: '100%',
  },
  photoThumbActive: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
  },
});

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
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
    justifyContent: 'center',
    alignItems: 'center',
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
  navLeft: {
    left: 20,
  },
  navRight: {
    right: 20,
  },
  counter: {
    position: 'absolute',
    bottom: 60,
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: fontWeight.semibold,
  },
});

const sheetStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'black',
  },
  container: {
    position: 'absolute',
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
  scrollView: {
    flex: 1,
  },
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
