import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
  Pressable,
  Image,
  ScrollView,
  FlatList,
  TextInput,
  Modal,
  PanResponder,
  GestureResponderEvent,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CompositeNavigationProp } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";
import { Image as ExpoImage } from "expo-image";
import {
  Profile,
  StoryUser,
  RecommendedUser,
  NearbyActiveUser,
  MapUser,
} from "../../types";
import { NearbyMapPreview } from "../../components/NearbyMapPreview";
import { MapUserMarker } from "../../components/MapUserMarker";
import { MapUserCard } from "../../components/MapUserCard";
import { MAPS_CONFIG, DARK_MAP_STYLE } from "../../config/maps.config";
import { MyStoriesModal } from "../../components/stories/MyStoriesModal";

// Display story format for UI
interface DisplayStory {
  id: string;
  name: string;
  image: string;
  isMyStory: boolean;
  storyContent: string;
  age: number;
  bio: string;
  interests: string[];
  prompt: { question: string; answer: string };
  hasUnviewed?: boolean;
  storyUserData?: StoryUser;
}
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
} from "../../theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useChat } from "../../context/ChatContext";
import { useMatches, useStories, useLocation, useAuth, useUser } from "../../context";
import { searchUsers, SearchUser } from "../../services/search.service";
import { useDebounce } from "../../hooks/useDebounce";
import { isUserOnline } from "../../utils/timeUtils";
import { NotificationPermissionModal } from "../../components/modals/NotificationPermissionModal";
import { notificationService } from "../../services/notifications.service";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const DATE_CARD_WIDTH = (SCREEN_WIDTH - spacing.lg * 2 - spacing.md) / 2.3;

type MainTabsParamList = {
  Feed: undefined;
  Discover: undefined;
  Add: undefined;
  Matches: undefined;
  Profile: undefined;
};

type RootStackParamList = {
  MainTabs: undefined;
  ProfileDetail: { profile: Profile };
};

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabsParamList, "Feed">,
  NativeStackNavigationProp<RootStackParamList>
>;

// Distance Slider Component
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
      const newValue = Math.round(
        minValue + percentage * (maxValue - minValue),
      );
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
    }),
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

// Shimmer loading components
const StoryShimmer: React.FC<{ index: number }> = ({ index }) => (
  <Animated.View
    entering={FadeInRight.delay(index * 80).springify()}
    style={styles.storyItem}
  >
    <View style={styles.storyShimmerContainer}>
      <View style={styles.storyShimmer} />
    </View>
    <View style={styles.storyNameShimmer} />
  </Animated.View>
);

const DateCardShimmer: React.FC<{ index: number }> = ({ index }) => (
  <Animated.View
    entering={FadeInRight.delay(index * 100).springify()}
    style={[styles.dateCardWrapper]}
  >
    <View style={[styles.dateCard, styles.dateCardShimmer]} />
  </Animated.View>
);

// Story/Chat Item Component (without timer)
const StoryItem: React.FC<{
  item: (typeof NEW_CHATS)[0];
  index: number;
  onPress: () => void;
  onAddStory?: () => void;
}> = ({ item, index, onPress, onAddStory }) => {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (item.isMyStory && onAddStory) {
      onAddStory();
    } else {
      onPress();
    }
  };

  return (
    <Animated.View
      entering={FadeInRight.delay(index * 80).springify()}
      style={animatedStyle}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.storyItem}
      >
        <View
          style={[
            styles.storyImageContainer,
            item.isMyStory && styles.myStoryContainer,
          ]}
        >
          {item.isMyStory ? (
            <LinearGradient
              colors={["#FFB6C1", "#FFC0CB"]}
              style={styles.myStoryGradient}
            >
              {item.image ? (
                <Image source={{ uri: item.image }} style={styles.storyImage} />
              ) : (
                <View style={styles.storyImagePlaceholder}>
                  <Ionicons name="person" size={32} color={colors.textSecondary} />
                </View>
              )}
            </LinearGradient>
          ) : (
            <LinearGradient
              colors={[
                "rgba(255, 255, 255, 0.15)",
                "rgba(255, 255, 255, 0.05)",
              ]}
              style={styles.storyBorder}
            >
              <View style={styles.storyImageInner}>
                {item.image ? (
                  <Image source={{ uri: item.image }} style={styles.storyImage} />
                ) : (
                  <View style={styles.storyImagePlaceholder}>
                    <Ionicons name="person" size={32} color={colors.textSecondary} />
                  </View>
                )}
              </View>
            </LinearGradient>
          )}
          {item.isMyStory && (
            <View style={styles.addStoryBadge}>
              <Ionicons name="add" size={14} color={colors.text} />
            </View>
          )}
        </View>
        <Text style={styles.storyName} numberOfLines={1}>
          {item.name}
        </Text>
      </Pressable>
    </Animated.View>
  );
};

// Date Card Component
const DateCard: React.FC<{
  item: (typeof YOUR_DATES)[0];
  index: number;
  onPress: () => void;
}> = ({ item, index, onPress }) => {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInRight.delay(index * 100).springify()}
      style={[styles.dateCardWrapper, animatedStyle]}
    >
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.dateCard}
      >
        <Image source={{ uri: item.image }} style={styles.dateCardImage} />

        {/* Distance badge */}
        <View style={styles.distanceBadge}>
          <Text style={styles.distanceText}>{item.distance}</Text>
        </View>

        {/* Bottom info */}
        <View style={styles.dateCardInfo}>
          <View style={styles.dateCardNameRow}>
            <Text style={styles.dateCardName}>
              {item.name}, {item.age}
            </Text>
            {item.online && <View style={styles.onlineDot} />}
          </View>
          <Text style={styles.dateCardOrientation}>{item.orientation}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
};

// Memoized Search Result Item Component
const SearchResultItem = React.memo<{
  item: SearchUser;
  onPress: () => void;
}>(
  ({ item, onPress }) => {
    return (
      <Pressable
        style={styles.searchResultItem}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
      >
        <Image
          source={{
            uri: item.primary_photo || "https://via.placeholder.com/150",
          }}
          style={styles.searchResultImage}
        />
        <View style={styles.searchResultInfo}>
          <Text style={styles.searchResultName}>
            {item.name}, {item.age}
          </Text>
          <Text style={styles.searchResultDistance}>
            {item.distance ? `${item.distance} km away` : "Distance unknown"}
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={colors.textSecondary}
        />
      </Pressable>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if the user_id changes
    return prevProps.item.user_id === nextProps.item.user_id;
  },
);

export const FeedScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { sendMessage, initializeChat } = useChat();
  const {
    createMatchForProfile,
    findMatchByName,
    recommendedUsers,
    fetchRecommendedUsers,
    isLoading: isMatchesLoading,
  } = useMatches();
  const {
    stories,
    fetchStories,
    viewStory,
    isLoading: isStoriesLoading,
  } = useStories();
  const {
    nearbyActiveUsers,
    mapUsers,
    fetchNearbyActive,
    fetchMapUsers,
    userLocation,
    requestPermission,
    hasPermission,
    isLoading: isLocationLoading,
  } = useLocation();
  const { name: userName, accessToken } = useAuth();
  const { user, updatePreferences } = useUser();
  const insets = useSafeAreaInsets();

  const [selectedNearbyProfile, setSelectedNearbyProfile] = useState<
    string | null
  >(null);
  const [selectedMapUser, setSelectedMapUser] = useState<MapUser | null>(null);
  const markerPressedRef = useRef(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [ageRange, setAgeRange] = useState({ min: 18, max: 35 });
  const [distance, setDistance] = useState(25);
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [selectedStory, setSelectedStory] = useState<DisplayStory | null>(null);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState(0);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [storyProgress, setStoryProgress] = useState(0);
  const [showMapModal, setShowMapModal] = useState(false);
  const [complimentText, setComplimentText] = useState("");
  const [showMyStories, setShowMyStories] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);

  // Debounced search query (500ms delay)
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  // Sync filter state from user's saved preferences
  useEffect(() => {
    if (user?.preferences) {
      setAgeRange({
        min: user.preferences.ageRange?.min ?? 18,
        max: user.preferences.ageRange?.max ?? 35,
      });
      setDistance(user.preferences.maxDistance ?? 25);
    }
  }, [user?.preferences?.ageRange?.min, user?.preferences?.ageRange?.max, user?.preferences?.maxDistance]);

  // CRITICAL FIX: Track if initial fetch has completed to prevent duplicate API calls
  const hasFetchedRef = useRef(false);

  // CRITICAL FIX: Fetch initial data only once when access token becomes available
  // This prevents duplicate fetches when hasPermission or userLocation changes
  useEffect(() => {
    // Wait for access token to be available before making API calls
    if (!accessToken || hasFetchedRef.current) {
      if (!accessToken) {
        console.log("[FeedScreen] Waiting for access token...");
      } else {
        console.log(
          "[FeedScreen] Initial fetch already completed, skipping duplicate",
        );
      }
      return;
    }

    console.log("[FeedScreen] =");
    console.log("[FeedScreen] Initial data fetch triggered (ONCE)");
    console.log(
      "[FeedScreen] Token preview:",
      accessToken.substring(0, 30) + "...",
    );
    console.log("[FeedScreen] =");

    hasFetchedRef.current = true;

    // Fetch data that doesn't depend on location
    fetchStories();
    fetchRecommendedUsers();
    fetchNearbyActive();

    // Request location permission if not granted
    if (hasPermission === false) {
      requestPermission();
    }
  }, [accessToken]); // ONLY accessToken dependency

  // Show notification permission modal once (on home screen, after a short delay)
  useEffect(() => {
    if (!accessToken) return;

    const timer = setTimeout(async () => {
      try {
        const hasShown = await AsyncStorage.getItem("notificationModalShown");
        if (hasShown === "true") return;

        const { status } = await Notifications.getPermissionsAsync();
        if (status === "granted") {
          // Android < 13: permission auto-granted at install, but initialize() never ran.
          // Must call initialize() to get FCM token, register with backend, and create channels.
          await AsyncStorage.setItem("notificationModalShown", "true");
          await notificationService.initialize();
          return;
        }

        setShowNotificationModal(true);
      } catch (error) {
        console.error(
          "[FeedScreen] Error checking notification permission:",
          error,
        );
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [accessToken]);

  const handleEnableNotifications = useCallback(async () => {
    setShowNotificationModal(false);
    try {
      await notificationService.initialize();
    } catch (error) {
      console.error("[FeedScreen] Failed to enable notifications:", error);
    }
    await AsyncStorage.setItem("notificationModalShown", "true");
  }, []);

  const handleDismissNotificationModal = useCallback(async () => {
    setShowNotificationModal(false);
    await AsyncStorage.setItem("notificationModalShown", "true");
  }, []);

  // CRITICAL FIX: Separate effect for location-dependent data
  // This runs only when userLocation becomes available
  useEffect(() => {
    if (!accessToken || !hasPermission || !userLocation) {
      return;
    }

    console.log("[FeedScreen] Location available, fetching map users");
    fetchMapUsers(MAPS_CONFIG.MARKER_RADIUS_KM);
  }, [userLocation]); // ONLY userLocation dependency (changes once)

  // Transform API stories to display format (with My Story prepended)
  const myProfilePhoto = user?.photos[0];
  const displayStories = useMemo(() => {
    const myStory = {
      id: "my-story",
      name: "My Story",
      image: myProfilePhoto || "",
      isMyStory: true,
      storyContent: myProfilePhoto || "",
      age: user?.age || 25,
      bio: userName || "My Story",
      interests: [] as string[],
      prompt: { question: "", answer: "" },
    };

    // If we have API stories, transform them
    if (stories.length > 0) {
      const apiStories: DisplayStory[] = stories.map((storyUser) => ({
        id: storyUser.user_id,
        name: storyUser.user_name,
        image: storyUser.user_photo,
        isMyStory: false as const,
        storyContent: storyUser.stories[0]?.media_url || storyUser.user_photo,
        age: 25, // Not provided in API
        bio: "",
        interests: [] as string[],
        prompt: { question: "", answer: "" },
        hasUnviewed: storyUser.has_unviewed,
        storyUserData: storyUser, // Keep reference to original data
      }));
      return [myStory, ...apiStories] as DisplayStory[];
    }

    // Return only My Story when no API data
    return [myStory] as DisplayStory[];
  }, [stories, myProfilePhoto, userName, user?.age]);

  // Transform API recommended users to display format
  const displayDates = useMemo(() => {
    if (recommendedUsers.length > 0) {
      return recommendedUsers.map((user) => ({
        id: user.user_id,
        name: user.name,
        age: user.age,
        distance: `${user.distance} km away`,
        image:
          user.photos[0] ||
          user.primary_photo ||
          "https://via.placeholder.com/400x600",
        orientation: user.sexual_orientation?.toUpperCase() || "STRAIGHT",
        online: isUserOnline(user.last_active_at),
        apiUser: user, // Keep reference to original data
      }));
    }
    // Return empty array when no API data
    return [];
  }, [recommendedUsers]);

  // Transform nearby users for map
  const displayNearbyProfiles = useMemo(() => {
    if (nearbyActiveUsers.length > 0) {
      return nearbyActiveUsers.slice(0, 5).map((user, index) => ({
        id: user.user_id,
        name: user.name,
        image: user.primary_photo,
        // Generate random positions for map display (API doesn't provide coordinates in this endpoint)
        x: 0.2 + index * 0.15 + Math.random() * 0.1,
        y: 0.3 + index * 0.1 + Math.random() * 0.2,
      }));
    }
    // Return empty array when no API data
    return [];
  }, [nearbyActiveUsers]);

  // Filter chats and dates based on search query
  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return displayStories;
    const query = searchQuery.toLowerCase();
    return displayStories.filter((chat) =>
      chat.name.toLowerCase().includes(query),
    );
  }, [searchQuery, displayStories]);

  const filteredDates = useMemo(() => {
    if (!searchQuery.trim()) return displayDates;
    const query = searchQuery.toLowerCase();
    return displayDates.filter(
      (date) =>
        date.name.toLowerCase().includes(query) ||
        date.orientation.toLowerCase().includes(query),
    );
  }, [searchQuery, displayDates]);

  // Get stories list (excluding "My Story")
  const storiesList = useMemo(() => {
    return filteredChats.filter((chat) => !chat.isMyStory);
  }, [filteredChats]);

  // Navigate to next story
  const handleNextStory = useCallback(() => {
    if (
      selectedStory &&
      selectedStoryIndex <
        (selectedStory as any).storyUserData?.stories?.length - 1
    ) {
      // Navigate to next story within same user
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedStoryIndex((prev) => prev + 1);
      setStoryProgress(0);

      // Mark as viewed
      const storyData = (selectedStory as any).storyUserData;
      if (storyData?.stories?.[selectedStoryIndex + 1]) {
        viewStory(storyData.stories[selectedStoryIndex + 1].story_id);
      }
    } else if (currentStoryIndex < storiesList.length - 1) {
      // Navigate to next user's story
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const nextIndex = currentStoryIndex + 1;
      setCurrentStoryIndex(nextIndex);
      setSelectedStory(storiesList[nextIndex] as any);
      setSelectedStoryIndex(0);
      setStoryProgress(0);

      // Mark first story of next user as viewed
      const nextStoryData = (storiesList[nextIndex] as any).storyUserData;
      if (nextStoryData?.stories?.[0]) {
        viewStory(nextStoryData.stories[0].story_id);
      }
    } else {
      // Close viewer when at the last story
      setShowStoryViewer(false);
    }
  }, [
    currentStoryIndex,
    storiesList,
    selectedStory,
    selectedStoryIndex,
    viewStory,
  ]);

  // Navigate to previous story
  const handlePreviousStory = useCallback(() => {
    if (selectedStoryIndex > 0) {
      // Navigate to previous story within same user
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedStoryIndex((prev) => prev - 1);
      setStoryProgress(0);
    } else if (currentStoryIndex > 0) {
      // Navigate to previous user's story
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const prevIndex = currentStoryIndex - 1;
      setCurrentStoryIndex(prevIndex);
      setSelectedStory(storiesList[prevIndex] as any);
      // Go to last story of previous user
      const prevStoryData = (storiesList[prevIndex] as any).storyUserData;
      const lastStoryIndex = prevStoryData?.stories?.length
        ? prevStoryData.stories.length - 1
        : 0;
      setSelectedStoryIndex(lastStoryIndex);
      setStoryProgress(0);
    }
  }, [currentStoryIndex, storiesList, selectedStoryIndex]);

  // Open story at specific index
  const openStoryAtIndex = useCallback(
    (story: any) => {
      const index = storiesList.findIndex((s) => s.id === story.id);
      if (index !== -1) {
        setCurrentStoryIndex(index);
        setSelectedStory(story);
        setSelectedStoryIndex(0);
        setShowStoryViewer(true);
        setStoryProgress(0);

        // Mark first story as viewed
        const storyData = story.storyUserData;
        if (storyData?.stories?.[0]) {
          viewStory(storyData.stories[0].story_id);
        }
      }
    },
    [storiesList, viewStory],
  );

  const handleSearchToggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowSearch((prev) => !prev);
    if (showSearch) {
      setSearchQuery("");
    }
  }, [showSearch]);

  const handleProfilePress = useCallback(
    (profile: any) => {
      // Check if this is an API user with full data
      const apiUser = profile.apiUser as RecommendedUser | undefined;

      const fullProfile: Profile = apiUser
        ? {
            id: apiUser.user_id,
            name: apiUser.name,
            age: apiUser.age,
            photos: apiUser.photos.map((p) => p.url),
            bio: apiUser.bio,
            location: {
              city: apiUser.location_city,
              distance: apiUser.distance,
            },
            interests: apiUser.tags.map((t) => t.name),
            verified: apiUser.is_verified,
            gender: apiUser.gender.toLowerCase() as
              | "male"
              | "female"
              | "non-binary"
              | "other",
            interestedIn: ["everyone"],
            preferences: { ageRange: { min: 18, max: 40 }, maxDistance: 25 },
            matchPercentage: apiUser.match_score,
            orientation: apiUser.sexual_orientation,
            lastActive: new Date(apiUser.last_active_at),
          }
        : {
            // Fallback for mock data
            id: profile.id,
            name: profile.name,
            age: profile.age || 25,
            photos: [profile.image],
            bio: "Looking for meaningful connections and exploring new adventures",
            location: { city: "Mumbai", distance: 5 },
            interests: ["Travel", "Music", "Food", "Photography", "Fitness"],
            verified: true,
            gender: "female",
            interestedIn: ["male"],
            preferences: { ageRange: { min: 21, max: 35 }, maxDistance: 25 },
            pronouns: "She/Her",
            stats: {
              rejections: 2400,
              likes: 33,
            },
            prompts: [
              {
                question: "I geek out on",
                answer: "Contemporary art and gallery hopping on weekends",
              },
              {
                question: "My simple pleasures",
                answer: "Morning coffee while watching the sunrise",
              },
            ],
          };
      navigation.navigate("ProfileDetail", { profile: fullProfile });
    },
    [navigation],
  );

  const handleFilterPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowFilterModal(true);
  }, []);

  const handleApplyFilters = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsApplyingFilters(true);
    try {
      const success = await updatePreferences(ageRange.min, ageRange.max, distance);
      if (success) {
        await fetchRecommendedUsers(30, true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('[FeedScreen] Error applying filters:', error);
    } finally {
      setIsApplyingFilters(false);
      setShowFilterModal(false);
    }
  }, [ageRange.min, ageRange.max, distance, updatePreferences, fetchRecommendedUsers]);

  const handleViewMapPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowMapModal(true);
  }, []);

  const handleSendCompliment = useCallback(() => {
    if (!complimentText.trim() || !selectedStory) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Find existing match or create a new one for this story person
    let match = findMatchByName(selectedStory.name);

    if (!match) {
      // Create a new match for this profile from story data
      match = createMatchForProfile({
        id: `story-${selectedStory.id}`,
        name: selectedStory.name,
        age: selectedStory.age,
        photos: [selectedStory.image, selectedStory.storyContent].filter(
          Boolean,
        ) as string[],
        bio: selectedStory.bio || "",
        interests: selectedStory.interests || [],
        gender: "female",
        interestedIn: ["male"],
        location: { city: "Mumbai" },
        preferences: { ageRange: { min: 18, max: 40 }, maxDistance: 25 },
        verified: true,
      });
    }

    // Initialize chat if not already done
    initializeChat(match.id, "current-user", match.profile.id);

    // Send the compliment message with a special format
    sendMessage(match.id, {
      senderId: "current-user",
      text: `💝 Compliment: ${complimentText}`,
      type: "text",
    });

    // Clear the input and show feedback
    setComplimentText("");

    // Close story viewer after sending compliment
    setShowStoryViewer(false);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [
    complimentText,
    selectedStory,
    findMatchByName,
    createMatchForProfile,
    initializeChat,
    sendMessage,
  ]);

  // Map user handlers
  const handleMapUserPress = useCallback((user: MapUser) => {
    console.log("[FeedScreen] Map user pressed:", user.name, user.user_id);
    markerPressedRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedMapUser(user);
    console.log("[FeedScreen] Selected map user set");
    // Reset the flag after a short delay
    setTimeout(() => {
      markerPressedRef.current = false;
    }, 100);
  }, []);

  const handleMapPress = useCallback(() => {
    console.log(
      "[FeedScreen] Map pressed, markerPressedRef:",
      markerPressedRef.current,
    );
    if (!markerPressedRef.current) {
      setSelectedMapUser(null);
    }
  }, []);

  const handleViewMapUserProfile = useCallback(() => {
    if (!selectedMapUser) return;

    const profile: Profile = {
      id: selectedMapUser.user_id,
      name: selectedMapUser.name,
      age: selectedMapUser.age,
      photos: [
        selectedMapUser.primary_photo || "https://via.placeholder.com/400",
      ],
      bio: "",
      location: {
        city: "",
        distance: selectedMapUser.distance,
      },
      interests: [],
      verified: selectedMapUser.is_verified || false,
      gender: "female",
      interestedIn: ["everyone"],
      preferences: {
        ageRange: { min: 18, max: 40 },
        maxDistance: 25,
      },
    };

    navigation.navigate("ProfileDetail", { profile });
    setSelectedMapUser(null);
    setShowMapModal(false);
  }, [selectedMapUser, navigation]);

  const handleViewSearchUserProfile = useCallback(
    (user: SearchUser) => {
      const profile: Profile = {
        id: user.user_id,
        name: user.name,
        age: user.age,
        photos: [user.primary_photo || "https://via.placeholder.com/400"],
        bio: "",
        location: {
          city: "",
          distance: user.distance || 0,
        },
        interests: [],
        verified: false,
        gender: "female",
        interestedIn: ["everyone"],
        preferences: {
          ageRange: { min: 18, max: 40 },
          maxDistance: 25,
        },
      };

      navigation.navigate("ProfileDetail", { profile });
      setShowSearch(false);
      setSearchQuery("");
      setSearchResults([]);
    },
    [navigation],
  );

  // Memoize render callbacks for search results
  const renderSearchResultItem = useCallback(
    ({ item }: { item: SearchUser }) => (
      <SearchResultItem
        item={item}
        onPress={() => handleViewSearchUserProfile(item)}
      />
    ),
    [handleViewSearchUserProfile],
  );

  const keyExtractor = useCallback((item: SearchUser) => item.user_id, []);

  // Log map users data
  useEffect(() => {
    if (mapUsers.length > 0) {
      console.log(`[FeedScreen] Map users loaded: ${mapUsers.length} users`);
      console.log("[FeedScreen] Sample user:", mapUsers[0]);
    }
  }, [mapUsers]);

  // Prefetch images when map modal opens
  useEffect(() => {
    if (showMapModal && mapUsers.length > 0) {
      const imagesToPrefetch = mapUsers
        .slice(0, MAPS_CONFIG.MAX_VISIBLE_MARKERS)
        .map((user) => user.primary_photo || "https://via.placeholder.com/150")
        .filter(Boolean);

      if (imagesToPrefetch.length > 0) {
        console.log(
          `[FeedScreen] Prefetching ${imagesToPrefetch.length} images for map modal`,
        );
        ExpoImage.prefetch(imagesToPrefetch);
      }
    }
  }, [showMapModal, mapUsers]);

  // Spread out overlapping markers for full map
  const spreadMapMarkers = useMemo(() => {
    const displayUsers = mapUsers.slice(0, MAPS_CONFIG.MAX_VISIBLE_MARKERS);
    const result: Array<
      (typeof mapUsers)[0] & { displayLat: number; displayLng: number }
    > = [];

    displayUsers.forEach((user) => {
      // Check if this location is too close to any existing marker
      const overlapping = result.filter((existing) => {
        const latDiff = Math.abs(existing.latitude - user.latitude);
        const lngDiff = Math.abs(existing.longitude - user.longitude);
        // Consider markers overlapping if within ~10 meters
        return latDiff < 0.0001 && lngDiff < 0.0001;
      });

      if (overlapping.length > 0) {
        // Generate deterministic random angle based on user_id hash
        const hash = user.user_id
          .split("")
          .reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const angle =
          ((hash % 360) + overlapping.length * 72) * (Math.PI / 180);

        // Random offset distance between 200-400 meters
        const offsetDistance = 0.002 + (hash % 10) * 0.0002;
        const latOffset = Math.cos(angle) * offsetDistance;
        const lngOffset = Math.sin(angle) * offsetDistance;

        result.push({
          ...user,
          displayLat: user.latitude + latOffset,
          displayLng: user.longitude + lngOffset,
        });
      } else {
        result.push({
          ...user,
          displayLat: user.latitude,
          displayLng: user.longitude,
        });
      }
    });

    return result;
  }, [mapUsers]);

  // Search users when debounced query changes
  useEffect(() => {
    const performSearch = async () => {
      // Only search if query is at least 1 character and we have access token
      if (!debouncedSearchQuery || debouncedSearchQuery.trim().length === 0) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      if (!accessToken) {
        console.log("[FeedScreen] Cannot search: no access token");
        return;
      }

      try {
        setIsSearching(true);
        console.log("[FeedScreen] Searching for:", debouncedSearchQuery);

        const results = await searchUsers(debouncedSearchQuery.trim(), 20);

        console.log(
          "[FeedScreen] Search complete:",
          results.length,
          "users found",
        );
        setSearchResults(results);
      } catch (error) {
        console.error("[FeedScreen] Search error:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
  }, [debouncedSearchQuery, accessToken]);

  // Story timer effect
  useEffect(() => {
    if (!showStoryViewer || !selectedStory) return;

    const duration = 10000; // 10 seconds
    const interval = 50; // Update every 50ms
    const increment = (interval / duration) * 100;

    const timer = setInterval(() => {
      setStoryProgress((prev) => {
        const newProgress = prev + increment;
        if (newProgress >= 100) {
          clearInterval(timer);
          // Auto-advance to next story
          if (currentStoryIndex < storiesList.length - 1) {
            const nextIndex = currentStoryIndex + 1;
            setCurrentStoryIndex(nextIndex);
            setSelectedStory(storiesList[nextIndex]);
            setStoryProgress(0);
          } else {
            setShowStoryViewer(false);
          }
          return 100;
        }
        return newProgress;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [showStoryViewer, selectedStory, currentStoryIndex, storiesList]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.header}>
          <Pressable style={styles.filterButton} onPress={handleFilterPress}>
            <Ionicons name="options-outline" size={22} color={colors.text} />
          </Pressable>

          <View style={styles.titleContainer}>
            <Text style={styles.headerTitle}>Home</Text>
          </View>

          <Pressable style={styles.searchButton} onPress={handleSearchToggle}>
            <Ionicons
              name={showSearch ? "close" : "search"}
              size={22}
              color={colors.text}
            />
          </Pressable>
        </Animated.View>

        {/* Search Bar */}
        {showSearch && (
          <Animated.View
            entering={FadeInDown.duration(200)}
            style={styles.searchContainer}
          >
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or interests..."
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery("")}>
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={colors.textSecondary}
                  />
                </Pressable>
              )}
            </View>
          </Animated.View>
        )}

        {/* Search Results */}
        {showSearch && searchQuery.length > 0 ? (
          <View style={styles.searchResultsContainer}>
            {isSearching ? (
              <View style={styles.searchLoadingContainer}>
                <Text style={styles.searchLoadingText}>Searching...</Text>
              </View>
            ) : searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                keyExtractor={keyExtractor}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.searchResultsList}
                renderItem={renderSearchResultItem}
                ListEmptyComponent={
                  <View style={styles.searchEmptyContainer}>
                    <Ionicons
                      name="search-outline"
                      size={48}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.searchEmptyText}>No users found</Text>
                    <Text style={styles.searchEmptySubtext}>
                      Try searching by name or interests
                    </Text>
                  </View>
                }
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                windowSize={10}
                initialNumToRender={10}
                updateCellsBatchingPeriod={50}
                getItemLayout={(data, index) => ({
                  length: 76,
                  offset: 76 * index,
                  index,
                })}
              />
            ) : (
              <View style={styles.searchEmptyContainer}>
                <Ionicons
                  name="search-outline"
                  size={48}
                  color={colors.textSecondary}
                />
                <Text style={styles.searchEmptyText}>No users found</Text>
                <Text style={styles.searchEmptySubtext}>
                  Try searching by name or interests
                </Text>
              </View>
            )}
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Stories Section (without title) */}
            <Animated.View entering={FadeIn.delay(200)} style={styles.section}>
              {isStoriesLoading && displayStories.length <= 1 ? (
                <FlatList
                  horizontal
                  data={Array.from({ length: 6 })}
                  keyExtractor={(_, index) => `shimmer-story-${index}`}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.storiesContainer}
                  renderItem={({ index }) => <StoryShimmer index={index} />}
                />
              ) : (
                <FlatList
                  horizontal
                  data={filteredChats}
                  keyExtractor={(item) => item.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.storiesContainer}
                  ListEmptyComponent={
                    <Text style={styles.emptySearchText}>
                      No stories available
                    </Text>
                  }
                  renderItem={({ item, index }) => (
                    <StoryItem
                      item={item}
                      index={index}
                      onPress={() => {
                        if (!item.isMyStory) {
                          openStoryAtIndex(item);
                        }
                      }}
                      onAddStory={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        setShowMyStories(true);
                      }}
                    />
                  )}
                />
              )}
            </Animated.View>

            {/* Your Dates Section */}
            <Animated.View entering={FadeIn.delay(300)} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Your Dates</Text>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    navigation.navigate("Discover");
                  }}
                >
                  <Text style={styles.viewMoreText}>Explore More</Text>
                </Pressable>
              </View>

              {isMatchesLoading && displayDates.length === 0 ? (
                <FlatList
                  horizontal
                  data={Array.from({ length: 4 })}
                  keyExtractor={(_, index) => `shimmer-date-${index}`}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.datesContainer}
                  renderItem={({ index }) => <DateCardShimmer index={index} />}
                />
              ) : (
                <FlatList
                  horizontal
                  data={filteredDates}
                  keyExtractor={(item) => item.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.datesContainer}
                  ListEmptyComponent={
                    <Text style={styles.emptySearchText}>
                      No dates available
                    </Text>
                  }
                  renderItem={({ item, index }) => (
                    <DateCard
                      item={item}
                      index={index}
                      onPress={() => handleProfilePress(item)}
                    />
                  )}
                />
              )}
            </Animated.View>

            {/* Near You Section */}
            <Animated.View entering={FadeIn.delay(400)} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Near You</Text>
                <Pressable onPress={() => setShowMapModal(true)}>
                  <Text style={styles.viewMoreText}>View Map</Text>
                </Pressable>
              </View>

              {isLocationLoading && mapUsers.length === 0 ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Loading map data</Text>
                </View>
              ) : mapUsers.length > 0 ? (
                <NearbyMapPreview
                  users={mapUsers}
                  userLocation={userLocation}
                  onUserPress={handleMapUserPress}
                  onMapPress={() => setShowMapModal(true)}
                  height={220}
                />
              ) : (
                <View style={styles.emptyMapState}>
                  <Text style={styles.emptyText}>
                    No users nearby with location enabled
                  </Text>
                </View>
              )}
            </Animated.View>

            {/* Bottom spacing for tab bar + system nav */}
            <View style={{ height: 100 + insets.bottom }} />
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Story Viewer Modal */}
      <Modal
        visible={showStoryViewer}
        animationType="fade"
        onRequestClose={() => setShowStoryViewer(false)}
      >
        <View style={storyStyles.container}>
          {selectedStory && (
            <>
              {/* Full Screen Story Image */}
              <Image
                source={{
                  uri: selectedStory.storyContent || selectedStory.image,
                }}
                style={storyStyles.storyImage}
                resizeMode="cover"
              />

              {/* Tap zones for navigation */}
              <View style={storyStyles.tapZonesContainer}>
                <Pressable
                  style={storyStyles.tapZoneLeft}
                  onPress={handlePreviousStory}
                />
                <Pressable
                  style={storyStyles.tapZoneRight}
                  onPress={handleNextStory}
                />
              </View>

              {/* Top gradient overlay with timer and header */}
              <LinearGradient
                colors={["rgba(0,0,0,0.6)", "transparent"]}
                style={storyStyles.topGradient}
              >
                <SafeAreaView edges={["top"]} style={storyStyles.topOverlay}>
                  {/* Single progress bar */}
                  <View style={storyStyles.timerBar}>
                    <View
                      style={[
                        storyStyles.timerFill,
                        { width: `${storyProgress}%` },
                      ]}
                    />
                  </View>

                  {/* Story header */}
                  <View style={storyStyles.header}>
                    <View style={storyStyles.userInfo}>
                      <Image
                        source={{ uri: selectedStory.image }}
                        style={storyStyles.avatar}
                      />
                      <View>
                        <Text style={storyStyles.username}>
                          {selectedStory.name}
                        </Text>
                        {selectedStory.age && (
                          <Text style={storyStyles.age}>
                            {selectedStory.age}
                          </Text>
                        )}
                      </View>
                    </View>
                    <Pressable
                      style={storyStyles.closeButton}
                      onPress={() => setShowStoryViewer(false)}
                    >
                      <Ionicons name="close" size={28} color={colors.text} />
                    </Pressable>
                  </View>
                </SafeAreaView>
              </LinearGradient>

              {/* Bottom compliment input */}
              <SafeAreaView
                edges={["bottom"]}
                style={storyStyles.bottomContainer}
              >
                <View style={storyStyles.complimentInputContainer}>
                  <TextInput
                    style={storyStyles.complimentInput}
                    placeholder="Add compliment..."
                    placeholderTextColor={colors.textMuted}
                    value={complimentText}
                    onChangeText={setComplimentText}
                    maxLength={200}
                  />
                  <Pressable
                    style={[
                      storyStyles.sendButton,
                      !complimentText.trim() && storyStyles.sendButtonDisabled,
                    ]}
                    onPress={handleSendCompliment}
                    disabled={!complimentText.trim()}
                  >
                    <Ionicons
                      name="send"
                      size={20}
                      color={
                        complimentText.trim()
                          ? colors.primary
                          : colors.textMuted
                      }
                    />
                  </Pressable>
                </View>
              </SafeAreaView>
            </>
          )}
        </View>
      </Modal>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={filterStyles.modalOverlay}>
          <Pressable
            style={filterStyles.modalBackdrop}
            onPress={() => setShowFilterModal(false)}
          />
          <View style={filterStyles.modalContainer}>
            <LinearGradient
              colors={["#1a1a1a", "#0d0d0d"]}
              style={[filterStyles.modalGradient, { paddingBottom: spacing.xl + insets.bottom }]}
            >
              {/* Handle */}
              <View style={filterStyles.modalHandle} />

              {/* Header */}
              <View style={filterStyles.modalHeader}>
                <Text style={filterStyles.modalTitle}>Filters</Text>
                <Pressable
                  onPress={() => setShowFilterModal(false)}
                  style={filterStyles.closeButton}
                >
                  <Ionicons name="close" size={24} color={colors.text} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Age Preference */}
                <View style={filterStyles.filterSection}>
                  <Text style={filterStyles.filterLabel}>Age Preference</Text>
                  <Text style={filterStyles.filterValue}>
                    {ageRange.min} - {ageRange.max} years
                  </Text>

                  <View style={filterStyles.ageContainer}>
                    <View style={filterStyles.ageInput}>
                      <Text style={filterStyles.ageLabel}>Min</Text>
                      <View style={filterStyles.ageControls}>
                        <Pressable
                          style={filterStyles.ageButton}
                          onPress={() =>
                            setAgeRange((prev) => ({
                              ...prev,
                              min: Math.max(18, prev.min - 1),
                            }))
                          }
                        >
                          <Ionicons
                            name="remove"
                            size={20}
                            color={colors.text}
                          />
                        </Pressable>
                        <Text style={filterStyles.ageValue}>
                          {ageRange.min}
                        </Text>
                        <Pressable
                          style={filterStyles.ageButton}
                          onPress={() =>
                            setAgeRange((prev) => ({
                              ...prev,
                              min: Math.min(prev.max - 1, prev.min + 1),
                            }))
                          }
                        >
                          <Ionicons name="add" size={20} color={colors.text} />
                        </Pressable>
                      </View>
                    </View>

                    <View style={filterStyles.ageSeparator}>
                      <Text style={filterStyles.ageSeparatorText}>to</Text>
                    </View>

                    <View style={filterStyles.ageInput}>
                      <Text style={filterStyles.ageLabel}>Max</Text>
                      <View style={filterStyles.ageControls}>
                        <Pressable
                          style={filterStyles.ageButton}
                          onPress={() =>
                            setAgeRange((prev) => ({
                              ...prev,
                              max: Math.max(prev.min + 1, prev.max - 1),
                            }))
                          }
                        >
                          <Ionicons
                            name="remove"
                            size={20}
                            color={colors.text}
                          />
                        </Pressable>
                        <Text style={filterStyles.ageValue}>
                          {ageRange.max}
                        </Text>
                        <Pressable
                          style={filterStyles.ageButton}
                          onPress={() =>
                            setAgeRange((prev) => ({
                              ...prev,
                              max: Math.min(99, prev.max + 1),
                            }))
                          }
                        >
                          <Ionicons name="add" size={20} color={colors.text} />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Maximum Distance */}
                <View style={filterStyles.filterSection}>
                  <Text style={filterStyles.filterLabel}>Maximum Distance</Text>
                  <Text style={filterStyles.filterValue}>{distance} km</Text>
                  <DistanceSlider
                    value={distance}
                    onValueChange={setDistance}
                    minValue={1}
                    maxValue={100}
                  />
                </View>

                {/* Apply Button */}
                <Pressable
                  style={[filterStyles.applyButton, isApplyingFilters && { opacity: 0.6 }]}
                  onPress={handleApplyFilters}
                  disabled={isApplyingFilters}
                >
                  <LinearGradient
                    colors={[
                      "rgba(255, 255, 255, 0.15)",
                      "rgba(255, 255, 255, 0.05)",
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={filterStyles.applyButtonGradient}
                  >
                    <Text style={filterStyles.applyButtonText}>
                      {isApplyingFilters ? "Applying..." : "Apply Filters"}
                    </Text>
                  </LinearGradient>
                </Pressable>
              </ScrollView>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Full Screen Map Modal */}
      <Modal
        visible={showMapModal}
        animationType="slide"
        onRequestClose={() => {
          setShowMapModal(false);
          setSelectedMapUser(null);
        }}
      >
        <SafeAreaView edges={["top"]} style={mapStyles.container}>
          <LinearGradient
            colors={["#0a0a0a", "#1a1a1a"]}
            style={mapStyles.gradient}
          >
            {/* Header */}
            <View style={mapStyles.header}>
              <View style={mapStyles.headerLeft}>
                <Ionicons name="location" size={24} color={colors.primary} />
                <Text style={mapStyles.headerTitle}>Nearby</Text>
                <Text style={mapStyles.headerSubtitle}>
                  {mapUsers.length} users
                </Text>
              </View>
              <Pressable
                style={mapStyles.closeButton}
                onPress={() => {
                  setShowMapModal(false);
                  setSelectedMapUser(null);
                }}
              >
                <Ionicons name="close" size={28} color={colors.text} />
              </Pressable>
            </View>

            {/* Interactive Google Map */}
            <MapView
              provider={PROVIDER_GOOGLE}
              style={mapStyles.map}
              initialRegion={
                userLocation
                  ? { ...userLocation, latitudeDelta: 0.1, longitudeDelta: 0.1 }
                  : MAPS_CONFIG.DEFAULT_REGION
              }
              customMapStyle={DARK_MAP_STYLE}
              showsUserLocation
              showsMyLocationButton
              onPress={handleMapPress}
            >
              {spreadMapMarkers.map((user) => (
                <MapUserMarker
                  key={user.user_id}
                  user={{
                    ...user,
                    latitude: user.displayLat,
                    longitude: user.displayLng,
                  }}
                  onPress={handleMapUserPress}
                  isSelected={selectedMapUser?.user_id === user.user_id}
                />
              ))}
            </MapView>

            {/* Selected User Card */}
            {(() => {
              console.log(
                "[FeedScreen] Checking selectedMapUser for card render:",
                selectedMapUser?.name,
                !!selectedMapUser,
              );
              return (
                selectedMapUser && (
                  <MapUserCard
                    user={selectedMapUser}
                    onViewProfile={handleViewMapUserProfile}
                    onClose={() => setSelectedMapUser(null)}
                  />
                )
              );
            })()}
          </LinearGradient>
        </SafeAreaView>
      </Modal>

      {/* My Stories Modal */}
      <MyStoriesModal
        visible={showMyStories}
        onClose={() => setShowMyStories(false)}
      />

      {/* Notification Permission Modal */}
      <NotificationPermissionModal
        visible={showNotificationModal}
        onClose={handleDismissNotificationModal}
        onEnable={handleEnableNotifications}
      />
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  titleContainer: {
    alignItems: "center",
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#2A2A2A",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  headerButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    height: 48,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
    height: "100%",
  },
  searchResultsContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchResultsList: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  searchResultImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.background,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semiBold,
    color: colors.text,
    marginBottom: 4,
  },
  searchResultDistance: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  searchLoadingContainer: {
    padding: spacing.xl,
    alignItems: "center",
  },
  searchLoadingText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  searchEmptyContainer: {
    paddingTop: spacing.xxl * 2,
    alignItems: "center",
    gap: spacing.md,
  },
  searchEmptyText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semiBold,
    color: colors.text,
  },
  searchEmptySubtext: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  emptySearchText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    paddingVertical: spacing.lg,
  },
  emptyMapState: {
    height: 220,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.xxl,
    marginHorizontal: spacing.lg,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  loadingContainer: {
    height: 220,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.xxl,
    marginHorizontal: spacing.lg,
  },
  loadingText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  scrollContent: {
    paddingTop: spacing.sm,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  viewMoreText: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  // Stories styles
  storiesContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  storyItem: {
    alignItems: "center",
    width: 75,
  },
  storyImageContainer: {
    width: 72,
    height: 72,
    marginBottom: spacing.xs,
  },
  myStoryContainer: {
    position: "relative",
  },
  myStoryGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    padding: 3,
  },
  storyBorder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    padding: 3,
  },
  storyImageInner: {
    width: "100%",
    height: "100%",
    borderRadius: 33,
    backgroundColor: colors.background,
    padding: 2,
  },
  storyImage: {
    width: "100%",
    height: "100%",
    borderRadius: 32,
  },
  storyImagePlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 32,
    backgroundColor: colors.card,
    justifyContent: "center",
    alignItems: "center",
  },
  addStoryBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.background,
  },
  storyName: {
    fontSize: fontSize.xs,
    color: colors.text,
    fontWeight: fontWeight.medium,
    textAlign: "center",
  },
  // Dual section row
  dualSectionRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  halfSection: {
    flex: 1,
  },
  sectionHeaderCompact: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  sectionTitleSmall: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  viewMoreTextSmall: {
    fontSize: fontSize.xs,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  datesContainerCompact: {
    gap: spacing.sm,
  },
  // Date cards styles
  datesContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  dateCardWrapper: {
    width: DATE_CARD_WIDTH,
  },
  dateCard: {
    width: "100%",
    height: DATE_CARD_WIDTH * 1.4,
    borderRadius: borderRadius.xl,
    overflow: "hidden",
    backgroundColor: colors.card,
  },
  dateCardImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  distanceBadge: {
    position: "absolute",
    bottom: 60,
    left: spacing.sm,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
  },
  distanceText: {
    fontSize: fontSize.xs,
    color: colors.text,
    fontWeight: fontWeight.medium,
  },
  dateCardInfo: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.sm,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  dateCardNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  dateCardName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4CAF50",
  },
  dateCardOrientation: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
    letterSpacing: 1,
    marginTop: 2,
  },
  // Map styles
  mapContainer: {
    marginHorizontal: spacing.lg,
    height: 220,
    borderRadius: borderRadius.xl,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
  },
  mapContainerCompact: {
    height: DATE_CARD_WIDTH * 1.2,
    borderRadius: borderRadius.xl,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
  },
  mapImage: {
    width: "100%",
    height: "100%",
    opacity: 0.3,
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  mapGrid: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLineH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  gridLineV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  streetLabel: {
    position: "absolute",
    fontSize: 10,
    color: "rgba(255,255,255,0.3)",
    fontWeight: fontWeight.medium,
  },
  mapProfile: {
    position: "absolute",
    alignItems: "center",
  },
  mapProfileSmall: {
    position: "absolute",
    alignItems: "center",
  },
  mapProfileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: colors.primary,
    overflow: "hidden",
  },
  mapProfileImageSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.primary,
    overflow: "hidden",
  },
  mapProfileImageActive: {
    borderColor: colors.primary,
    borderWidth: 3,
  },
  mapProfileImg: {
    width: "100%",
    height: "100%",
    borderRadius: 22,
  },
  centerPin: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -12,
    marginTop: -12,
  },
  mapProfileDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: -4,
  },
  connectBubble: {
    position: "absolute",
    bottom: 60,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
    minWidth: 180,
  },
  connectText: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: fontWeight.medium,
  },
  // Shimmer styles
  storyShimmerContainer: {
    width: 72,
    height: 72,
    marginBottom: spacing.xs,
    borderRadius: 36,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    overflow: "hidden",
  },
  storyShimmer: {
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  storyNameShimmer: {
    width: 60,
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignSelf: "center",
  },
  dateCardShimmer: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
});

// Filter modal styles
const filterStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  modalGradient: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: SCREEN_HEIGHT * 0.7,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    justifyContent: "center",
    alignItems: "center",
  },
  filterSection: {
    marginBottom: spacing.xl,
  },
  filterLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  filterValue: {
    fontSize: fontSize.sm,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  ageContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ageInput: {
    flex: 1,
    alignItems: "center",
  },
  ageLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  ageControls: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
  },
  ageButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  ageValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginHorizontal: spacing.sm,
    minWidth: 32,
    textAlign: "center",
  },
  ageSeparator: {
    paddingHorizontal: spacing.sm,
  },
  ageSeparatorText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  sliderContainer: {
    height: 40,
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  sliderTrack: {
    height: 6,
    backgroundColor: colors.card,
    borderRadius: 3,
    overflow: "hidden",
  },
  sliderFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  sliderThumb: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    marginLeft: -12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  applyButton: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
  },
  applyButtonGradient: {
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  applyButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
});

// Story viewer styles
const storyStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  storyImage: {
    ...StyleSheet.absoluteFillObject,
  },
  tapZonesContainer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    zIndex: 5,
  },
  tapZoneLeft: {
    flex: 1,
    height: "100%",
  },
  tapZoneRight: {
    flex: 1,
    height: "100%",
  },
  topGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    zIndex: 10,
  },
  topOverlay: {
    paddingTop: spacing.xl,
  },
  bottomContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    zIndex: 10,
  },
  progressBarsContainer: {
    flexDirection: "row",
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    gap: 4,
  },
  progressBarWrapper: {
    flex: 1,
  },
  progressBarBackground: {
    height: 3,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 1.5,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: colors.text,
    borderRadius: 1.5,
  },
  timerBar: {
    height: 3,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: 1.5,
    overflow: "hidden",
  },
  timerFill: {
    height: "100%",
    backgroundColor: colors.text,
    borderRadius: 1.5,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.text,
  },
  username: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  age: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  bioCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(255, 105, 180, 0.3)",
  },
  bioHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  bioTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  bioText: {
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: 22,
  },
  interestsCard: {
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  interestsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  interestTag: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
  },
  interestText: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: fontWeight.semibold,
  },
  promptCard: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  promptHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  promptQuestion: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  promptAnswer: {
    fontSize: fontSize.lg,
    color: colors.text,
    lineHeight: 24,
    fontWeight: fontWeight.medium,
  },
  complimentSection: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  complimentTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  complimentInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  complimentInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  actionButtons: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  primaryActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xl,
  },
  actionButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  secondaryActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xl,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  secondaryActionButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
});

const mapStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  map: {
    flex: 1,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    justifyContent: "center",
    alignItems: "center",
  },
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  mapImage: {
    width: "100%",
    height: "100%",
    opacity: 0.6,
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  mapProfilePin: {
    position: "absolute",
    alignItems: "center",
  },
  profilePinImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: colors.primary,
    overflow: "hidden",
    backgroundColor: colors.background,
  },
  profilePinImg: {
    width: "100%",
    height: "100%",
  },
  profilePinDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    marginTop: -6,
    borderWidth: 2,
    borderColor: colors.background,
  },
});

export default FeedScreen;
