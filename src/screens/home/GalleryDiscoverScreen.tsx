import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
  Pressable,
  TextInput,
  Modal,
  Image,
  FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withDecay,
  cancelAnimation,
  useDerivedValue,
  useAnimatedReaction,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { Profile } from '../../types';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';
import { useExplore } from '../../context';
import type { ExploreProfile } from '../../context/ExploreContext';
import type { ExploreFilters } from '../../services/discovery.service';
import { isUserOnline } from '../../utils/timeUtils';
import { searchUsers } from '../../services/search.service';
import type { SearchUser } from '../../services/search.service';
import { useDebounce } from '../../hooks/useDebounce';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Grid configuration
const NUM_COLUMNS = 3;
const MIN_ROWS = 5; // Minimum rows per tile (used during loading shimmer)
const CARD_GAP = 8;
const CARD_WIDTH = (SCREEN_WIDTH - spacing.md * 2 - CARD_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const CARD_HEIGHT = CARD_WIDTH * 1.4;

// Cell dimensions (card + gap)
const CELL_WIDTH = CARD_WIDTH + CARD_GAP;
const CELL_HEIGHT = CARD_HEIGHT + CARD_GAP;

// Horizontal cycle (fixed — always 3 columns)
const GRID_CYCLE_WIDTH = CELL_WIDTH * NUM_COLUMNS;

// Shimmer placeholder for loading cards
const ShimmerCard: React.FC = () => (
  <View style={[styles.card, styles.shimmerCard]}>
    <View style={styles.shimmerContent} />
  </View>
);

type RootStackParamList = {
  GalleryDiscover: undefined;
  ProfileDetail: { profile: Profile };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Convert ExploreProfile to GalleryProfile format.
// When activeFilter is set, use that filter's color for all profile borders.
const convertToGalleryProfile = (profile: ExploreProfile, activeFilterColor?: string) => ({
  id: profile.user_id,
  name: profile.name,
  age: profile.age,
  image: profile.primary_photo,
  city: '',
  verified: false,
  online: isUserOnline(profile.last_active_at),
  borderColor: activeFilterColor || profile.relationship_types[0]?.border_color || '#FFFFFF',
});

// Relationship type options with unique colors
export const RELATIONSHIP_TYPES = [
  { id: 'long-term', label: 'Long-term', icon: 'heart', color: '#FF69B4' },
  { id: 'casual', label: 'Casual', icon: 'cafe', color: '#FF6347' },
  { id: 'friendship', label: 'Friendship', icon: 'happy', color: '#FFD700' },
  { id: 'marriage', label: 'Marriage', icon: 'diamond', color: '#9370DB' },
  { id: 'open', label: 'Open to All', icon: 'sparkles', color: '#32CD32' },
] as const;

export type RelationshipType = typeof RELATIONSHIP_TYPES[number]['id'] | null;

// Helper to get color for a relationship type
export const getRelationshipColor = (typeId: RelationshipType): string => {
  if (!typeId) return '#FFFFFF';
  const type = RELATIONSHIP_TYPES.find(t => t.id === typeId);
  return type?.color || '#FFFFFF';
};

// Relationship Type Filter Modal
const FilterModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  selectedTypes: string[];
  onlineOnly: boolean;
  onApply: (types: string[], onlineOnly: boolean) => void;
}> = ({ visible, onClose, selectedTypes: currentTypes, onlineOnly: currentOnlineOnly, onApply }) => {
  const [selected, setSelected] = useState<string[]>(currentTypes);
  const [onlineFilter, setOnlineFilter] = useState(currentOnlineOnly);

  useEffect(() => {
    if (visible) {
      setSelected(currentTypes);
      setOnlineFilter(currentOnlineOnly);
    }
  }, [visible, currentTypes, currentOnlineOnly]);

  const toggleType = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(prev =>
      prev.includes(id) ? [] : [id]
    );
  };

  const handleApply = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onApply(selected, onlineFilter);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={filterStyles.overlay}>
        <View style={filterStyles.container}>
          <LinearGradient colors={['#1a1a1a', '#0d0d0d']} style={filterStyles.gradient}>
            {/* Header */}
            <View style={filterStyles.header}>
              <Text style={filterStyles.title}>Filters</Text>
              <Pressable style={filterStyles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            {/* Online Only Toggle */}
            <Pressable
              style={[
                filterStyles.onlineChip,
                onlineFilter && filterStyles.onlineChipActive,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setOnlineFilter(prev => !prev);
              }}
            >
              <View style={[
                filterStyles.onlineDot,
                onlineFilter && filterStyles.onlineDotActive,
              ]} />
              <Text style={[
                filterStyles.onlineChipText,
                onlineFilter && filterStyles.onlineChipTextActive,
              ]}>
                Online Now
              </Text>
            </Pressable>

            {/* Section label */}
            <Text style={filterStyles.sectionLabel}>Looking For</Text>
            <Text style={filterStyles.subtitle}>
              Select none to show all
            </Text>

            {/* Relationship type options */}
            <View style={filterStyles.typesGrid}>
              {RELATIONSHIP_TYPES.map((type) => {
                const isSelected = selected.includes(type.id);
                return (
                  <Pressable
                    key={type.id}
                    style={[
                      filterStyles.typeChip,
                      isSelected && { backgroundColor: type.color, borderColor: type.color },
                    ]}
                    onPress={() => toggleType(type.id)}
                  >
                    <Ionicons
                      name={type.icon as any}
                      size={18}
                      color={isSelected ? colors.text : type.color}
                    />
                    <Text
                      style={[
                        filterStyles.typeChipText,
                        { color: isSelected ? colors.text : type.color },
                      ]}
                      numberOfLines={1}
                    >
                      {type.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Apply button */}
            <Pressable style={filterStyles.applyButton} onPress={handleApply}>
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                style={filterStyles.applyGradient}
              >
                <Text style={filterStyles.applyText}>Apply</Text>
              </LinearGradient>
            </Pressable>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
};

// Profile Card Component - simple rectangular design
const ProfileCard: React.FC<{
  profile: ReturnType<typeof convertToGalleryProfile>;
  onPress: () => void;
}> = React.memo(({ profile, onPress }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={[
        styles.card,
        { borderWidth: 2, borderColor: profile.borderColor },
      ]}
    >
      {/* Placeholder shown while loading or on error */}
      {(!imageLoaded || imageError) && (
        <View style={styles.imagePlaceholder}>
          <Ionicons
            name={imageError ? 'person' : 'image-outline'}
            size={32}
            color="rgba(255,255,255,0.2)"
          />
        </View>
      )}

      {!imageError && (
        <Image
          source={{ uri: profile.image }}
          style={[styles.cardImage, !imageLoaded && styles.imageHidden]}
          resizeMode="cover"
          fadeDuration={0}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
        />
      )}

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)']}
        locations={[0, 0.5, 1]}
        style={styles.cardGradient}
      >
        <Text style={styles.cardName} numberOfLines={1}>{profile.name}</Text>
        <Text style={styles.cardAge}>{profile.age}</Text>
      </LinearGradient>
      {profile.online && <View style={styles.onlineIndicator} />}
      {profile.verified && (
        <View style={styles.verifiedBadge}>
          <Ionicons name="checkmark-circle" size={14} color="#1DA1F2" />
        </View>
      )}
    </Pressable>
  );
}, (prevProps, nextProps) =>
  prevProps.profile.id === nextProps.profile.id &&
  prevProps.profile.borderColor === nextProps.profile.borderColor
);

// Helper function for proper modulo that handles negatives
const mod = (n: number, m: number): number => {
  'worklet';
  return ((n % m) + m) % m;
};

// Infinite 360 Grid Component - renders a tiled grid that wraps seamlessly
//
// How it works:
// - A 3×3 grid of IDENTICAL tiles is rendered.
// - Each tile contains numRows × 3 cards showing ALL profiles.
// - The animated transform uses mod() to keep position within one cycle.
// - Because every tile is an exact copy, when one tile scrolls off-screen
//   and its neighbour takes its place the transition is perfectly seamless.
// - The user scrolls through all profiles, then they repeat (infinite loop).
const InfiniteGrid: React.FC<{
  onProfilePress: (profile: ReturnType<typeof convertToGalleryProfile>) => void;
  onlineOnly?: boolean;
  activeFilterColor?: string;
}> = ({ onProfilePress, onlineOnly = false, activeFilterColor }) => {
  const { getProfileAt, updateCacheCenter, evictDistantRegions, profiles, isInitialLoading, generation } = useExplore();

  // Client-side online filter: compute filtered profiles and a local lookup
  const filteredProfiles = useMemo(() => {
    if (!onlineOnly) return profiles;
    return profiles.filter(p => isUserOnline(p.last_active_at));
  }, [profiles, onlineOnly]);

  const getFilteredProfileAt = useCallback((col: number, row: number): ExploreProfile | null => {
    if (!onlineOnly) return getProfileAt(col, row);
    if (filteredProfiles.length === 0) return null;
    const normalizedCol = ((col % NUM_COLUMNS) + NUM_COLUMNS) % NUM_COLUMNS;
    const totalRows = Math.ceil(filteredProfiles.length / NUM_COLUMNS);
    const normalizedRow = ((row % totalRows) + totalRows) % totalRows;
    const offset = (normalizedRow * NUM_COLUMNS + normalizedCol) % filteredProfiles.length;
    return filteredProfiles[offset];
  }, [onlineOnly, filteredProfiles, getProfileAt]);

  // Each tile must show ALL profiles so that wrapping is seamless.
  // numRows = total profile rows (ceil(profiles / 3)), capped to keep
  // the total view count reasonable (numRows × 3 cols × 9 tiles).
  const activeProfiles = onlineOnly ? filteredProfiles : profiles;
  const numRows = useMemo(() => {
    if (activeProfiles.length === 0) return MIN_ROWS;
    const totalProfileRows = Math.ceil(activeProfiles.length / NUM_COLUMNS);
    return Math.min(50, Math.max(totalProfileRows, MIN_ROWS));
  }, [activeProfiles.length]);

  // Dynamic vertical cycle = one full tile of all profiles
  const cycleHeight = CELL_HEIGHT * numRows;
  const cycleHeightSV = useSharedValue(cycleHeight);

  useEffect(() => {
    cycleHeightSV.value = cycleHeight;
  }, [cycleHeight]);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const contextX = useSharedValue(0);
  const contextY = useSharedValue(0);

  // Re-center grid when generation changes (filter apply, retry, refresh)
  useEffect(() => {
    cancelAnimation(translateX);
    cancelAnimation(translateY);
    translateX.value = 0;
    translateY.value = 0;
    contextX.value = 0;
    contextY.value = 0;
  }, [generation]);

  // Debounced handler for viewport updates (cache management)
  const handleViewportMove = useCallback((row: number) => {
    updateCacheCenter(0, row);
    evictDistantRegions();
  }, [updateCacheCenter, evictDistantRegions]);

  const viewportRow = useDerivedValue(() => {
    return Math.floor(-translateY.value / CELL_HEIGHT);
  });

  useAnimatedReaction(
    () => viewportRow.value,
    (current, previous) => {
      if (previous !== null && Math.abs(current - previous) > 5) {
        runOnJS(handleViewportMove)(current);
      }
    }
  );

  const panGesture = Gesture.Pan()
    .onStart(() => {
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      contextX.value = translateX.value;
      contextY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = contextX.value + event.translationX;
      translateY.value = contextY.value + event.translationY;
    })
    .onEnd((event) => {
      translateX.value = withDecay({
        velocity: event.velocityX,
        deceleration: 0.997,
      });
      translateY.value = withDecay({
        velocity: event.velocityY,
        deceleration: 0.997,
      });
    });

  // Animated grid transform — wraps within one cycle so numbers stay small
  const animatedGridStyle = useAnimatedStyle(() => {
    const normX = mod(translateX.value, GRID_CYCLE_WIDTH);
    const normY = mod(translateY.value, cycleHeightSV.value);

    return {
      transform: [
        { translateX: normX - GRID_CYCLE_WIDTH },
        { translateY: normY - cycleHeightSV.value },
      ],
    };
  });

  const renderTiles = () => {
    const tiles: React.ReactElement[] = [];

    // Shimmer during initial load
    if (isInitialLoading) {
      const shimmerCH = CELL_HEIGHT * MIN_ROWS;
      for (let row = 0; row < MIN_ROWS; row++) {
        for (let col = 0; col < NUM_COLUMNS; col++) {
          tiles.push(
            <View
              key={`shimmer-${col}-${row}`}
              style={[
                styles.cardWrapper,
                {
                  left: GRID_CYCLE_WIDTH + col * CELL_WIDTH,
                  top: shimmerCH + row * CELL_HEIGHT,
                  width: CARD_WIDTH,
                  height: CARD_HEIGHT,
                },
              ]}
            >
              <ShimmerCard />
            </View>
          );
        }
      }
      return tiles;
    }

    if (activeProfiles.length === 0) return tiles;

    // Render 3×3 IDENTICAL tiles for seamless wrapping.
    // Every tile shows the exact same content (col, row) so when one
    // tile scrolls off-screen and its neighbour replaces it, the
    // transition is invisible.
    for (let tileRow = 0; tileRow < 3; tileRow++) {
      for (let tileCol = 0; tileCol < 3; tileCol++) {
        const tileOffsetX = tileCol * GRID_CYCLE_WIDTH;
        const tileOffsetY = tileRow * cycleHeight;

        for (let row = 0; row < numRows; row++) {
          for (let col = 0; col < NUM_COLUMNS; col++) {
            const x = tileOffsetX + col * CELL_WIDTH;
            const y = tileOffsetY + row * CELL_HEIGHT;

            // Same (col, row) for every tile → identical content → seamless
            const exploreProfile = getFilteredProfileAt(col, row);

            tiles.push(
              <View
                key={`${tileCol}-${tileRow}-${col}-${row}`}
                style={[
                  styles.cardWrapper,
                  { left: x, top: y, width: CARD_WIDTH, height: CARD_HEIGHT },
                ]}
              >
                {exploreProfile ? (
                  <ProfileCard
                    profile={convertToGalleryProfile(exploreProfile, activeFilterColor)}
                    onPress={() => onProfilePress(convertToGalleryProfile(exploreProfile, activeFilterColor))}
                  />
                ) : (
                  <ShimmerCard />
                )}
              </View>
            );
          }
        }
      }
    }

    return tiles;
  };

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.gridContainer, { height: cycleHeight * 3 }, animatedGridStyle]}>
        {renderTiles()}
      </Animated.View>
    </GestureDetector>
  );
};

export const GalleryDiscoverScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { applyFilters, isInitialLoading, error, profiles, filters } = useExplore();
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const insets = useSafeAreaInsets();

  // Track selected relationship types (empty = show all)
  const [selectedRelTypes, setSelectedRelTypes] = useState<string[]>([]);
  const [onlineOnly, setOnlineOnly] = useState(false);

  // Fetch initial data on mount with no filters (show everything)
  useEffect(() => {
    if (profiles.length > 0) return;

    console.log('[GalleryDiscoverScreen] Mounting, fetching all profiles');
    applyFilters({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debug log state changes
  useEffect(() => {
    console.log(`[GalleryDiscoverScreen] State: isInitialLoading=${isInitialLoading}, profiles.length=${profiles.length}, error=${error}`);
  }, [isInitialLoading, profiles.length, error]);

  // Search users when debounced query changes
  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedSearchQuery || debouncedSearchQuery.trim().length === 0) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }
      try {
        setIsSearching(true);
        const results = await searchUsers(debouncedSearchQuery.trim(), 20);
        setSearchResults(results);
      } catch (err) {
        console.error('[GalleryDiscoverScreen] Search error:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };
    performSearch();
  }, [debouncedSearchQuery]);

  // Handle filter apply
  const handleFilterApply = useCallback(async (types: string[], online: boolean) => {
    console.log('[GalleryDiscoverScreen] handleFilterApply:', JSON.stringify(types), 'onlineOnly:', online);
    setSelectedRelTypes(types);
    setOnlineOnly(online);

    const apiFilters: ExploreFilters = { relationship_type: types };
    await applyFilters(apiFilters);
  }, [applyFilters]);

  const handleSearchUserPress = useCallback((user: SearchUser) => {
    const fullProfile: Profile = {
      id: user.user_id,
      name: user.name,
      age: user.age,
      photos: [user.primary_photo],
      bio: '',
      location: { city: '', distance: user.distance ?? 0 },
      interests: [],
      verified: false,
      gender: 'Woman',
      interestedIn: ['Man'],
      preferences: { ageRange: { min: 21, max: 35 }, maxDistance: 25 },
    };
    navigation.navigate('ProfileDetail', { profile: fullProfile });
  }, [navigation]);

  const handleProfilePress = useCallback((profile: ReturnType<typeof convertToGalleryProfile>) => {
    const fullProfile: Profile = {
      id: profile.id,
      name: profile.name,
      age: profile.age,
      photos: [profile.image],
      bio: 'Looking for meaningful connections',
      location: { city: profile.city, distance: Math.floor(Math.random() * 10) + 1 },
      interests: ['Travel', 'Music', 'Food'],
      verified: profile.verified,
      gender: 'Woman',
      interestedIn: ['Man'],
      preferences: { ageRange: { min: 21, max: 35 }, maxDistance: 25 },
    };
    navigation.navigate('ProfileDetail', { profile: fullProfile });
  }, [navigation]);

  const hasActiveFilters = selectedRelTypes.length > 0 || onlineOnly;

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.header}>
          <Pressable
            style={[
              styles.filterButton,
              hasActiveFilters && styles.filterButtonActive,
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowFilters(true);
            }}
          >
            <Ionicons name="options-outline" size={22} color={hasActiveFilters ? colors.text : colors.text} />
            {hasActiveFilters && <View style={styles.filterDot} />}
          </Pressable>

          <View style={styles.titleContainer}>
            <Text style={styles.title}>Explore</Text>
          </View>

          <Pressable
            style={styles.searchButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowSearch(!showSearch);
            }}
          >
            <Ionicons name="search" size={22} color={colors.text} />
          </Pressable>
        </Animated.View>

        {/* Search Bar */}
        {showSearch && (
          <Animated.View entering={FadeIn} style={styles.searchContainer}>
            <View style={styles.searchInputWrapper}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name, city..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </Pressable>
              )}
            </View>
          </Animated.View>
        )}

      </SafeAreaView>

      {/* Infinite 360 Grid */}
      <View style={styles.gridWrapper}>
        {/* Error state */}
        {error && profiles.length === 0 && !isInitialLoading ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              style={styles.retryButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                applyFilters(filters);
              }}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                style={styles.retryGradient}
              >
                <Text style={styles.retryText}>Retry</Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : null}

        {/* Empty state - no profiles found */}
        {!isInitialLoading && !error && profiles.length === 0 ? (
          <View style={styles.errorContainer}>
            <Ionicons name="people-outline" size={48} color={colors.textMuted} />
            <Text style={styles.errorText}>No profiles found</Text>
            <Pressable
              style={styles.retryButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                applyFilters(filters);
              }}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                style={styles.retryGradient}
              >
                <Text style={styles.retryText}>Retry</Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : null}

        {/* Online filter empty state */}
        {onlineOnly && !isInitialLoading && profiles.length > 0 && profiles.filter(p => isUserOnline(p.last_active_at)).length === 0 ? (
          <View style={styles.errorContainer}>
            <View style={styles.onlineEmptyDot} />
            <Text style={styles.errorText}>No one is online right now</Text>
            <Text style={styles.onlineEmptySubtext}>Check back in a bit</Text>
          </View>
        ) : (
          <InfiniteGrid onProfilePress={handleProfilePress} onlineOnly={onlineOnly} activeFilterColor={selectedRelTypes[0] ? getRelationshipColor(selectedRelTypes[0] as RelationshipType) : undefined} />
        )}

        {/* Search Results Overlay */}
        {showSearch && searchQuery.length > 0 && (
          <View style={styles.searchResultsOverlay}>
            {isSearching ? (
              <View style={styles.searchLoadingContainer}>
                <Text style={styles.searchLoadingText}>Searching...</Text>
              </View>
            ) : searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.user_id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.searchResultsList}
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.searchResultItem}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      handleSearchUserPress(item);
                    }}
                  >
                    <Image
                      source={{ uri: item.primary_photo }}
                      style={styles.searchResultAvatar}
                    />
                    <View style={styles.searchResultInfo}>
                      <Text style={styles.searchResultName}>{item.name}, {item.age}</Text>
                      {item.distance !== null && (
                        <Text style={styles.searchResultDistance}>{Math.round(item.distance)} km away</Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </Pressable>
                )}
              />
            ) : (
              <View style={styles.searchEmptyContainer}>
                <Ionicons name="search-outline" size={48} color={colors.textMuted} />
                <Text style={styles.searchEmptyText}>No users found</Text>
                <Text style={styles.searchEmptySubtext}>Try a different name</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Filter Modal */}
      <FilterModal
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        selectedTypes={selectedRelTypes}
        onlineOnly={onlineOnly}
        onApply={handleFilterApply}
      />
    </GestureHandlerRootView>
  );
};

const filterStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    overflow: 'hidden',
  },
  gradient: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
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
  onlineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  onlineChipActive: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderColor: '#4CAF50',
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.textMuted,
  },
  onlineDotActive: {
    backgroundColor: '#4CAF50',
  },
  onlineChipText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
  },
  onlineChipTextActive: {
    color: '#4CAF50',
  },
  sectionLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  typesGrid: {
    flexDirection: 'column',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
  },
  typeChipText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold,
  },
  applyButton: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  applyGradient: {
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
  },
  applyText: {
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
  safeArea: {
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  titleContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: 'rgba(229, 57, 53, 0.2)',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  filterDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
  },
  gridWrapper: {
    flex: 1,
    overflow: 'hidden',
  },
  gridContainer: {
    position: 'absolute',
    width: GRID_CYCLE_WIDTH * 3,
    // height is set dynamically via inline style (cycleHeight * 3)
  },
  cardWrapper: {
    position: 'absolute',
  },
  card: {
    flex: 1,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  cardImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  imageHidden: {
    opacity: 0,
  },
  imagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  cardGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.sm,
    paddingTop: spacing.xl,
  },
  cardName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  cardAge: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  onlineIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: colors.background,
  },
  verifiedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
  },
  shimmerCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  shimmerContent: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  errorContainer: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
    paddingHorizontal: spacing.xl,
  },
  onlineEmptyDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.textMuted,
    marginBottom: spacing.xs,
  },
  onlineEmptySubtext: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  errorText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  retryButton: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  retryGradient: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  retryText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  searchResultsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    zIndex: 10,
  },
  searchLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchLoadingText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
  },
  searchResultsList: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  searchResultAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.background,
  },
  searchResultInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  searchResultName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  searchResultDistance: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  searchEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchEmptyText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  searchEmptySubtext: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
});

export default GalleryDiscoverScreen;
