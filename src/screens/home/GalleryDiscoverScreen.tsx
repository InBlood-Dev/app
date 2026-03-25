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
} from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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

// Vertical Grid Component - renders a normal vertically-scrolling 3-column grid
const VerticalGrid: React.FC<{
  onProfilePress: (profile: ReturnType<typeof convertToGalleryProfile>) => void;
  onlineOnly?: boolean;
  activeFilterColor?: string;
}> = ({ onProfilePress, onlineOnly = false, activeFilterColor }) => {
  const { profiles, isInitialLoading, generation } = useExplore();

  // Client-side online filter
  const filteredProfiles = useMemo(() => {
    if (!onlineOnly) return profiles;
    return profiles.filter(p => isUserOnline(p.last_active_at));
  }, [profiles, onlineOnly]);

  const activeProfiles = onlineOnly ? filteredProfiles : profiles;

  // Group profiles into rows of NUM_COLUMNS for FlatList
  const rows = useMemo(() => {
    const result: ExploreProfile[][] = [];
    for (let i = 0; i < activeProfiles.length; i += NUM_COLUMNS) {
      result.push(activeProfiles.slice(i, i + NUM_COLUMNS));
    }
    return result;
  }, [activeProfiles]);

  // Shimmer rows during loading
  const shimmerRows = useMemo(() => {
    const result: null[][] = [];
    for (let i = 0; i < MIN_ROWS; i++) {
      result.push(Array(NUM_COLUMNS).fill(null));
    }
    return result;
  }, []);

  const renderRow = useCallback(({ item: row, index: rowIndex }: { item: ExploreProfile[]; index: number }) => (
    <View style={styles.gridRow}>
      {row.map((profile, colIndex) => {
        const galleryProfile = convertToGalleryProfile(profile, activeFilterColor);
        const isLast = colIndex === NUM_COLUMNS - 1;
        return (
          <View key={`${rowIndex}-${colIndex}`} style={[styles.gridCell, isLast && { marginRight: 0 }]}>
            <ProfileCard
              profile={galleryProfile}
              onPress={() => onProfilePress(galleryProfile)}
            />
          </View>
        );
      })}
      {/* Fill remaining cells with empty spacers if row is incomplete */}
      {row.length < NUM_COLUMNS && Array.from({ length: NUM_COLUMNS - row.length }).map((_, i) => {
        const isLast = (row.length + i) === NUM_COLUMNS - 1;
        return <View key={`spacer-${rowIndex}-${i}`} style={[styles.gridCell, isLast && { marginRight: 0 }]} />;
      })}
    </View>
  ), [activeFilterColor, onProfilePress]);

  const renderShimmerRow = useCallback(({ item: row, index: rowIndex }: { item: null[]; index: number }) => (
    <View style={styles.gridRow}>
      {row.map((_, colIndex) => (
        <View key={`shimmer-${rowIndex}-${colIndex}`} style={styles.gridCell}>
          <ShimmerCard />
        </View>
      ))}
    </View>
  ), []);

  if (isInitialLoading) {
    return (
      <FlatList
        data={shimmerRows}
        keyExtractor={(_, index) => `shimmer-row-${index}`}
        renderItem={renderShimmerRow}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
      />
    );
  }

  return (
    <FlatList
      key={generation}
      data={rows}
      keyExtractor={(_, index) => `row-${index}`}
      renderItem={renderRow}
      contentContainerStyle={styles.gridContent}
      showsVerticalScrollIndicator={false}
      initialNumToRender={8}
      maxToRenderPerBatch={6}
      windowSize={7}
    />
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

      {/* Profile Grid */}
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
          <VerticalGrid onProfilePress={handleProfilePress} onlineOnly={onlineOnly} activeFilterColor={selectedRelTypes[0] ? getRelationshipColor(selectedRelTypes[0] as RelationshipType) : undefined} />
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
  gridContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: CARD_GAP,
  },
  gridCell: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginRight: CARD_GAP,
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
