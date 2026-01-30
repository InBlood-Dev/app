import React, { useRef, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
  FlatList,
  ViewToken,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolate,
  FadeIn,
  SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { AnimatedButton } from '../../components';
import { useAuth } from '../../context';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

// Import logo
const logoImage = require('../../assets/images/logo.png');

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface OnboardingSlide {
  id: string;
  title: string;
  type: 'location' | 'chat' | 'hearts';
}

const slides: OnboardingSlide[] = [
  {
    id: '1',
    title: "it's easy to find a\nsoul mate nearby &\naround you",
    type: 'location',
  },
  {
    id: '2',
    title: 'You can chat, with\nyour match and\nset-up dates',
    type: 'chat',
  },
  {
    id: '3',
    title: "Don't wait anymore,\nfind your soul mate\nright now!",
    type: 'hearts',
  },
];

// Profile images for the onboarding - Indian faces
const PROFILE_IMAGES = [
  'https://images.unsplash.com/photo-1618077360395-f3068be8e001?w=200&h=200&fit=crop', // Indian man
  'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=200&h=200&fit=crop', // Indian woman
  'https://images.unsplash.com/photo-1615109398623-88346a601842?w=200&h=200&fit=crop', // Indian man
  'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=200&h=200&fit=crop', // Indian woman
  'https://images.unsplash.com/photo-1583195764036-6dc248ac07d9?w=200&h=200&fit=crop', // Indian man
  'https://images.unsplash.com/photo-1611432579699-484f7990b127?w=200&h=200&fit=crop', // Indian woman
];

// First slide - Location/Nearby with circular profiles
const LocationSlide: React.FC = () => {
  const dashedCircleSize = 308;
  const dashedCircleRadius = dashedCircleSize / 2;
  const profiles = PROFILE_IMAGES.slice(0, 6);

  // Profile positions ON the dashed circle line with varying sizes
  // Angles match the reference image positioning
  const profilePositions = [
    { angle: -70, index: 0, size: 46 },  // top left area
    { angle: -20, index: 1, size: 52 },  // top right
    { angle: 35, index: 2, size: 44 },   // right side
    { angle: 120, index: 3, size: 50 },  // bottom right
    { angle: 160, index: 4, size: 48 },  // bottom center-left
    { angle: 215, index: 5, size: 46 },  // left side
  ];

  return (
    <View style={slideStyles.locationContainer}>
      {/* Outer dashed circle */}
      <Svg width={dashedCircleSize} height={dashedCircleSize} style={slideStyles.dashedCircle}>
        <Circle
          cx={dashedCircleRadius}
          cy={dashedCircleRadius}
          r={dashedCircleRadius - 2}
          stroke={colors.primary}
          strokeWidth={1.3}
          strokeDasharray="9 9"
          fill="transparent"
        />
      </Svg>

      {/* Inner solid circle (behind the logo) */}
      <View style={slideStyles.innerCircle} />

      {/* Center logo with red gradient */}
      <View style={slideStyles.centerLogo}>
        <LinearGradient
          colors={['#E53935', '#C62828']}
          style={slideStyles.logoGradient}
        >
          <Image source={logoImage} style={slideStyles.logoImage} resizeMode="contain" />
        </LinearGradient>
      </View>

      {/* Location pin at top of dashed circle */}
      <View style={slideStyles.locationPin}>
        <Ionicons name="location" size={22} color={colors.primary} />
      </View>

      {/* Profiles positioned ON the dashed circle line */}
      {profilePositions.map((pos, idx) => {
        const angleRad = pos.angle * (Math.PI / 180);
        // Position exactly on the dashed circle line
        const x = Math.cos(angleRad) * (dashedCircleRadius - 2);
        const y = Math.sin(angleRad) * (dashedCircleRadius - 2);
        const halfSize = pos.size / 2;

        return (
          <View
            key={idx}
            style={[
              slideStyles.profileBubbleBase,
              {
                width: pos.size,
                height: pos.size,
                borderRadius: halfSize,
                transform: [
                  { translateX: x },
                  { translateY: y },
                ],
              },
            ]}
          >
            <Image source={{ uri: profiles[pos.index] }} style={slideStyles.profileImage} />
          </View>
        );
      })}

      {/* Chat bubble icon on the circle - bottom area */}
      <View style={slideStyles.chatBubbleOnCircle}>
        <Ionicons name="chatbubble-ellipses" size={16} color={colors.primary} />
      </View>
    </View>
  );
};

// Second slide - Chat theme with interest tags
const ChatSlide: React.FC = () => {
  return (
    <View style={slideStyles.chatContainer}>
      {/* Fashion tag - top left with red fill */}
      <View style={[slideStyles.interestTagFilled, { top: 60, left: 50 }]}>
        <Text style={slideStyles.interestIcon}>👗</Text>
        <Text style={slideStyles.interestText}>Fashion</Text>
      </View>

      {/* Profile - top right */}
      <Image
        source={{ uri: PROFILE_IMAGES[1] }}
        style={[slideStyles.chatProfileRed, { top: 50, right: 30 }]}
      />

      {/* Chat bubble icon - center */}
      <View style={[slideStyles.chatBubbleIcon, { top: 160, left: '48%' }]}>
        <Ionicons name="chatbubble" size={24} color={colors.primary} />
      </View>

      {/* Profile - left side */}
      <Image
        source={{ uri: PROFILE_IMAGES[3] }}
        style={[slideStyles.chatProfileRed, { top: 200, left: 30 }]}
      />

      {/* Music tag - right side with outline style */}
      <View style={[slideStyles.interestTagOutline, { top: 220, right: 50 }]}>
        <Text style={slideStyles.interestIcon}>🎤</Text>
        <Text style={slideStyles.interestTextOutline}>Music</Text>
      </View>

      {/* Phone icon - right side */}
      <View style={[slideStyles.phoneIconContainer, { top: 290, right: 40 }]}>
        <Ionicons name="call" size={20} color={colors.primary} />
      </View>

      {/* Video camera icon - left side in red circle */}
      <View style={[slideStyles.videoIconContainer, { top: 320, left: 100 }]}>
        <Ionicons name="videocam" size={18} color={colors.text} />
      </View>

      {/* Photography tag - bottom left with red fill */}
      <View style={[slideStyles.interestTagFilled, { top: 400, left: 30 }]}>
        <Text style={slideStyles.interestIcon}>📸</Text>
        <Text style={slideStyles.interestText}>Photography</Text>
      </View>

      {/* Profile - bottom right */}
      <Image
        source={{ uri: PROFILE_IMAGES[5] }}
        style={[slideStyles.chatProfileRed, { top: 380, right: 40 }]}
      />
    </View>
  );
};

// Third slide - Hearts with two profiles
const HeartsSlide: React.FC = () => {
  const hearts = [
    { size: 30, top: 40, left: 60, rotation: -15 },
    { size: 20, top: 80, right: 80, rotation: 10 },
    { size: 40, top: 60, right: 40, rotation: -5 },
    { size: 25, top: 150, left: 30, rotation: 20 },
    { size: 35, top: 200, right: 60, rotation: -10 },
    { size: 20, top: 280, left: 50, rotation: 15 },
    { size: 30, top: 320, right: 30, rotation: -20 },
    { size: 15, top: 100, left: SCREEN_WIDTH * 0.45, rotation: 5 },
    { size: 25, top: 350, left: 80, rotation: -8 },
    { size: 18, top: 380, right: 90, rotation: 12 },
  ];

  return (
    <View style={slideStyles.heartsContainer}>
      {/* Floating hearts */}
      {hearts.map((heart, index) => (
        <Ionicons
          key={index}
          name="heart"
          size={heart.size}
          color={colors.primary}
          style={[
            slideStyles.floatingHeart,
            {
              top: heart.top,
              left: heart.left,
              right: heart.right,
              transform: [{ rotate: `${heart.rotation}deg` }],
            },
          ]}
        />
      ))}

      {/* Two heart-shaped profile containers */}
      <View style={slideStyles.heartProfilesContainer}>
        {/* Left heart profile - gold/tan color */}
        <View style={[slideStyles.heartProfile, slideStyles.heartProfileLeft]}>
          <View style={[slideStyles.heartShape, { backgroundColor: '#C9A66B' }]}>
            <Image
              source={{ uri: PROFILE_IMAGES[3] }}
              style={slideStyles.heartProfileImage}
            />
          </View>
          <Ionicons
            name="heart"
            size={24}
            color={colors.primary}
            style={slideStyles.heartOverlay}
          />
        </View>

        {/* Right heart profile - blue color */}
        <View style={[slideStyles.heartProfile, slideStyles.heartProfileRight]}>
          <View style={[slideStyles.heartShape, { backgroundColor: '#6B8FC9' }]}>
            <Image
              source={{ uri: PROFILE_IMAGES[1] }}
              style={slideStyles.heartProfileImage}
            />
          </View>
          <Ionicons
            name="heart"
            size={24}
            color={colors.primary}
            style={slideStyles.heartOverlay}
          />
        </View>
      </View>
    </View>
  );
};

const OnboardingSlideItem: React.FC<{
  item: OnboardingSlide;
  index: number;
  scrollX: SharedValue<number>;
}> = ({ item, index, scrollX }) => {
  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];

    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.5, 1, 0.5],
      Extrapolate.CLAMP
    );

    return { opacity };
  });

  const renderSlideContent = () => {
    switch (item.type) {
      case 'location':
        return <LocationSlide />;
      case 'chat':
        return <ChatSlide />;
      case 'hearts':
        return <HeartsSlide />;
      default:
        return null;
    }
  };

  return (
    <View style={styles.slide}>
      <Animated.View style={[styles.slideContent, animatedStyle]}>
        {renderSlideContent()}
      </Animated.View>

      <View style={styles.textContainer}>
        <Text style={styles.title}>{item.title}</Text>
      </View>
    </View>
  );
};

const Pagination: React.FC<{
  scrollX: SharedValue<number>;
  data: OnboardingSlide[];
}> = ({ scrollX, data }) => {
  return (
    <View style={styles.pagination}>
      {data.map((_, index) => {
        const dotStyle = useAnimatedStyle(() => {
          const inputRange = [
            (index - 1) * SCREEN_WIDTH,
            index * SCREEN_WIDTH,
            (index + 1) * SCREEN_WIDTH,
          ];

          const width = interpolate(
            scrollX.value,
            inputRange,
            [8, 24, 8],
            Extrapolate.CLAMP
          );

          const opacity = interpolate(
            scrollX.value,
            inputRange,
            [0.3, 1, 0.3],
            Extrapolate.CLAMP
          );

          return {
            width,
            opacity,
          };
        });

        return (
          <Animated.View
            key={index}
            style={[styles.dot, dotStyle]}
          />
        );
      })}
    </View>
  );
};

export const OnboardingScreen: React.FC = () => {
  const { completeOnboarding } = useAuth();
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useSharedValue(0);
  const [currentIndex, setCurrentIndex] = useState(0);

  const viewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
    []
  );

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleNext = useCallback(() => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      completeOnboarding();
      // No manual navigation needed - RootNavigator will automatically show Auth screen
      // when completeOnboarding() sets hasCompletedOnboarding = true
    }
  }, [currentIndex, completeOnboarding]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Slides */}
        <FlatList
          ref={flatListRef}
          data={slides}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onScroll={(e) => {
            scrollX.value = e.nativeEvent.contentOffset.x;
          }}
          scrollEventThrottle={16}
          onViewableItemsChanged={viewableItemsChanged}
          viewabilityConfig={viewConfig}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <OnboardingSlideItem item={item} index={index} scrollX={scrollX} />
          )}
        />

        {/* Pagination */}
        <Pagination scrollX={scrollX} data={slides} />

        {/* CTA Button */}
        <Animated.View entering={FadeIn.delay(300)} style={styles.buttonContainer}>
          <AnimatedButton
            title="Next"
            onPress={handleNext}
            fullWidth
            size="large"
          />
        </Animated.View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  slideContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 38,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginHorizontal: spacing.xs,
  },
  buttonContainer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
});

const slideStyles = StyleSheet.create({
  // Location slide styles
  locationContainer: {
    width: 320,
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationPin: {
    position: 'absolute',
    top: 0,
    zIndex: 10,
  },
  dashedCircle: {
    position: 'absolute',
  },
  innerCircle: {
    position: 'absolute',
    width: 222,
    height: 222,
    borderRadius: 111,
    backgroundColor: '#8B4D4D',
    opacity: 0.4,
  },
  centerLogo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    zIndex: 2,
  },
  logoGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: 70,
    height: 70,
  },
  profileBubble: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.primary,
    zIndex: 5,
  },
  profileBubbleBase: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.primary,
    zIndex: 5,
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  chatBubbleOnCircle: {
    position: 'absolute',
    bottom: 35,
    right: 30,
    zIndex: 10,
  },

  // Chat slide styles
  chatContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.55,
    position: 'relative',
  },
  interestTagFilled: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 25,
  },
  interestTagOutline: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 25,
  },
  interestIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  interestText: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  interestTextOutline: {
    color: colors.primary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  chatProfileRed: {
    position: 'absolute',
    width: 75,
    height: 75,
    borderRadius: 37.5,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  chatBubbleIcon: {
    position: 'absolute',
  },
  phoneIconContainer: {
    position: 'absolute',
  },
  videoIconContainer: {
    position: 'absolute',
    backgroundColor: colors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Hearts slide styles
  heartsContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.5,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingHeart: {
    position: 'absolute',
  },
  heartProfilesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartProfile: {
    alignItems: 'center',
  },
  heartProfileLeft: {
    marginRight: -20,
    zIndex: 1,
  },
  heartProfileRight: {
    marginLeft: -20,
  },
  heartShape: {
    width: 140,
    height: 160,
    borderRadius: 70,
    borderTopLeftRadius: 70,
    borderTopRightRadius: 70,
    overflow: 'hidden',
    transform: [{ rotate: '-15deg' }],
  },
  heartProfileImage: {
    width: '100%',
    height: '100%',
    transform: [{ rotate: '15deg' }, { scale: 1.2 }],
  },
  heartOverlay: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
});

export default OnboardingScreen;
