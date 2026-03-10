import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  Dimensions,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Profile } from '../types';
import { colors, borderRadius, fontSize, fontWeight, spacing, shadows } from '../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
export const CARD_WIDTH = SCREEN_WIDTH - spacing.md * 2;
export const CARD_HEIGHT = SCREEN_HEIGHT * 0.62;

interface ProfileCardProps {
  profile: Profile;
  onPress?: () => void;
  showFullInfo?: boolean;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  profile,
  onPress,
  showFullInfo = true,
}) => {
  const [currentPhotoIndex, setCurrentPhotoIndex] = React.useState(0);
  const photoScale = useSharedValue(1);

  const handlePhotoTap = (side: 'left' | 'right') => {
    if (side === 'right' && currentPhotoIndex < profile.photos.length - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      photoScale.value = withSpring(0.98, { damping: 15 }, () => {
        photoScale.value = withSpring(1, { damping: 15 });
      });
      setCurrentPhotoIndex(prev => prev + 1);
    } else if (side === 'left' && currentPhotoIndex > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      photoScale.value = withSpring(0.98, { damping: 15 }, () => {
        photoScale.value = withSpring(1, { damping: 15 });
      });
      setCurrentPhotoIndex(prev => prev - 1);
    }
  };

  const imageAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: photoScale.value }],
  }));

  return (
    <Pressable onPress={onPress} style={[styles.card, shadows.lg]}>
      {/* Main Image with animation */}
      <Animated.View style={[styles.imageContainer, imageAnimatedStyle]}>
        <Image
          source={{ uri: profile.photos[currentPhotoIndex] }}
          style={styles.image}
          resizeMode="cover"
        />
      </Animated.View>

      {/* Photo indicators - Modern pill style */}
      {profile.photos.length > 1 && (
        <View style={styles.photoIndicators}>
          {profile.photos.map((_, index) => (
            <View
              key={index}
              style={[
                styles.photoIndicator,
                index === currentPhotoIndex && styles.photoIndicatorActive,
              ]}
            />
          ))}
        </View>
      )}

      {/* Tap zones for photo navigation */}
      <View style={styles.tapZones}>
        <Pressable
          style={styles.tapZone}
          onPress={() => handlePhotoTap('left')}
        />
        <Pressable
          style={styles.tapZone}
          onPress={() => handlePhotoTap('right')}
        />
      </View>

      {/* Gradient overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.95)']}
        locations={[0.35, 0.6, 1]}
        style={styles.gradient}
      >
        <View style={styles.infoContainer}>
          {/* Verified badge */}
          {profile.verified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#fff" />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}

          {/* Name and age */}
          <View style={styles.nameRow}>
            <Text style={styles.name}>{profile.name}</Text>
            <Text style={styles.age}>, {profile.age}</Text>
          </View>

          {/* Location with distance */}
          <View style={styles.locationRow}>
            <Ionicons name="location-sharp" size={14} color={colors.primary} />
            <Text style={styles.locationText}>
              {profile.location.city}
              {profile.location.distance && ` • ${profile.location.distance} km away`}
            </Text>
          </View>

          {/* Bio */}
          {showFullInfo && profile.bio && (
            <Text style={styles.bio} numberOfLines={2}>
              {profile.bio}
            </Text>
          )}

          {/* Tags and Relationship Types */}
          {showFullInfo && (
            <View style={styles.interests}>
              {/* Show relationship types first (with colored borders) */}
              {profile.relationshipTypes && profile.relationshipTypes.slice(0, 2).map((relType, index) => (
                <View
                  key={`rel-${index}`}
                  style={[
                    styles.interestPill,
                    {
                      borderWidth: 1.5,
                      borderColor: relType.border_color,
                      backgroundColor: `${relType.border_color}20`,
                    }
                  ]}
                >
                  <Text style={[styles.interestText, { color: relType.border_color }]}>
                    {relType.type}
                  </Text>
                </View>
              ))}

              {/* Show tags */}
              {profile.tags && profile.tags.slice(0, 3).map((tag, index) => (
                <View key={`tag-${index}`} style={styles.interestPill}>
                  <Text style={styles.interestText}>{tag}</Text>
                </View>
              ))}

              {/* Show "+N more" if there are additional tags */}
              {profile.tags && profile.tags.length > 3 && (
                <View style={styles.moreInterests}>
                  <Text style={styles.moreInterestsText}>+{profile.tags.length - 3}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </LinearGradient>

      {/* Match percentage badge */}
      {profile.matchPercentage && (
        <View style={styles.matchBadge}>
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            style={styles.matchGradient}
          >
            <Text style={styles.matchText}>{profile.matchPercentage}%</Text>
            <Text style={styles.matchLabel}>Match</Text>
          </LinearGradient>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: borderRadius.xxl,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  photoIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    gap: 4,
    zIndex: 10,
  },
  photoIndicator: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 2,
    maxWidth: 60,
  },
  photoIndicatorActive: {
    backgroundColor: '#fff',
  },
  tapZones: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: '40%',
    flexDirection: 'row',
    zIndex: 5,
  },
  tapZone: {
    flex: 1,
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
    justifyContent: 'flex-end',
    borderBottomLeftRadius: borderRadius.xxl,
    borderBottomRightRadius: borderRadius.xxl,
  },
  infoContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(29, 161, 242, 0.9)',
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    gap: 4,
    marginBottom: spacing.sm,
  },
  verifiedText: {
    color: '#fff',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  name: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  age: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.sm,
  },
  locationText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  bio: {
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  interests: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  interestPill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
  },
  interestText: {
    color: colors.text,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  moreInterests: {
    backgroundColor: 'rgba(229, 57, 53, 0.3)',
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
  },
  moreInterestsText: {
    color: colors.primary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  matchBadge: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  matchGradient: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  matchText: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  matchLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontWeight: fontWeight.medium,
  },
});
