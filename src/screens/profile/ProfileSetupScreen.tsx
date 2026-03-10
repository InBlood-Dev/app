import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  Dimensions,
  Alert,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL } from "../../config/api.config";
import Animated, {
  FadeIn,
  FadeInRight,
  FadeInLeft,
  FadeOutLeft,
  FadeOutRight,
  Layout,
  SlideInRight,
  SlideOutLeft,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import Slider from "@react-native-community/slider";
import {
  AnimatedButton,
  AnimatedInput,
  ProgressBar,
  InterestChip,
} from "../../components";
import { useUser, useAuth, useLocation } from "../../context";
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
} from "../../theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type RootStackParamList = {
  ProfileSetup: undefined;
  MainTabs: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const STEPS = [
  "basics",
  "gender",
  "orientation",
  "relationshipTypes",
  "photos",
  "bio",
  "tags",
  "location",
  "preferences",
] as const;

type Step = (typeof STEPS)[number];

const GENDER_OPTIONS = [
  { value: "Man", label: "Man", icon: "man" },
  { value: "Woman", label: "Woman", icon: "woman" },
  { value: "Non-Binary", label: "Non-binary", icon: "transgender" },
  { value: "Other", label: "Other", icon: "ellipsis-horizontal" },
];

const ORIENTATION_OPTIONS = [
  { value: "Straight", label: "Straight" },
  { value: "Gay", label: "Gay" },
  { value: "Lesbian", label: "Lesbian" },
  { value: "Bisexual", label: "Bisexual" },
  { value: "Pansexual", label: "Pansexual" },
  { value: "Asexual", label: "Asexual" },
  { value: "Queer", label: "Queer" },
  { value: "Questioning", label: "Questioning" },
  { value: "Other", label: "Other" },
];

const RELATIONSHIP_TYPE_OPTIONS = [
  {
    value: "Friendship",
    label: "Friendship",
    color: "#FFD700",
    icon: "people",
  },
  { value: "Casual", label: "Casual", color: "#FF6347", icon: "flash" },
  { value: "Dating", label: "Dating", color: "#FF69B4", icon: "heart" },
  {
    value: "Serious",
    label: "Serious",
    color: "#9370DB",
    icon: "heart-circle",
  },
  { value: "Open", label: "Open", color: "#32CD32", icon: "infinite" },
  { value: "Flexible", label: "Flexible", color: "#A9A9A9", icon: "options" },
];


export const ProfileSetupScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const {
    updateUser,
    uploadPhoto,
    fetchAvailableTags,
    availableTags,
    addTag,
    fetchProfile,
    user,
  } = useUser();
  const { completeProfileSetup, email, googleUserId, accessToken } = useAuth();
  const { userLocation, requestPermission } = useLocation();
  const [isSaving, setIsSaving] = useState(false);

  const [currentStep, setCurrentStep] = useState<Step>("basics");
  const [direction, setDirection] = useState<"forward" | "backward">("forward");

  // Form state
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<string>("");
  const [orientation, setOrientation] = useState<string>("");
  const [relationshipTypes, setRelationshipTypes] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]); // Array of tag IDs
  const [city, setCity] = useState("");
  const [locationRequesting, setLocationRequesting] = useState(false);
  const [ageRange, setAgeRange] = useState({ min: 21, max: 35 });
  const [maxDistance, setMaxDistance] = useState(25);

  const currentStepIndex = useMemo(
    () => STEPS.indexOf(currentStep),
    [currentStep],
  );
  const progress = useMemo(
    () => (currentStepIndex + 1) / STEPS.length,
    [currentStepIndex],
  );

  // Fetch available tags on mount
  useEffect(() => {
    console.log("[ProfileSetupScreen] Fetching available tags");
    fetchAvailableTags();
  }, [fetchAvailableTags]);

  // Sync city from GPS location when LocationContext resolves it
  useEffect(() => {
    if (userLocation?.city && !city) {
      console.log("[ProfileSetupScreen] City auto-detected:", userLocation.city);
      setCity(userLocation.city);
    }
  }, [userLocation?.city, city]);

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case "basics":
        return name.length >= 2 && parseInt(age) >= 18 && parseInt(age) <= 100;
      case "gender":
        return gender !== "";
      case "orientation":
        return orientation !== "";
      case "relationshipTypes":
        return relationshipTypes.length === 1;
      case "photos":
        return photos.length >= 1;
      case "bio":
        return bio.length >= 10;
      case "tags":
        return selectedTags.length >= 3;
      case "location":
        return true; // User can proceed with or without location permission
      case "preferences":
        return true;
      default:
        return false;
    }
  }, [
    currentStep,
    name,
    age,
    gender,
    orientation,
    relationshipTypes,
    photos,
    bio,
    selectedTags,
    city,
  ]);

  const handleNext = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDirection("forward");

    console.log("[ProfileSetupScreen] handleNext called");
    console.log("[ProfileSetupScreen] Current step:", currentStep);
    console.log("[ProfileSetupScreen] Current step index:", currentStepIndex);
    console.log("[ProfileSetupScreen] Total steps:", STEPS.length);

    if (currentStepIndex < STEPS.length - 1) {
      let nextStep = STEPS[currentStepIndex + 1];

      // Auto-skip location step if user already has location from GPS
      if (nextStep === "location" && userLocation?.city) {
        console.log(
          "[ProfileSetupScreen] Auto-skipping location step - city already set:",
          userLocation.city,
        );
        setCity(userLocation.city); // Use the geocoded city
        nextStep = STEPS[currentStepIndex + 2]; // Skip to next step after location
      }

      console.log("[ProfileSetupScreen] Moving to next step:", nextStep);
      setCurrentStep(nextStep);
    } else {
      // Complete profile setup - save to backend
      console.log(
        "[ProfileSetupScreen] Final step - saving profile to backend",
      );

      // Backend expects flat field names, not nested objects
      const profileData = {
        name,
        age: parseInt(age),
        gender,
        bio,
        sexual_orientation: orientation,
        interests: [], // No interests step in form, tags are collected separately
        location_city: city,
        age_min: ageRange.min,
        age_max: ageRange.max,
        proximity_range: maxDistance,
      };

      console.log("[ProfileSetupScreen] Profile data to save:");
      console.log("[ProfileSetupScreen]   - name:", profileData.name);
      console.log("[ProfileSetupScreen]   - age:", profileData.age);
      console.log("[ProfileSetupScreen]   - gender:", profileData.gender);
      console.log("[ProfileSetupScreen]   - bio:", profileData.bio);
      console.log(
        "[ProfileSetupScreen]   - sexual_orientation:",
        profileData.sexual_orientation,
      );
      console.log("[ProfileSetupScreen]   - interests:", profileData.interests);
      console.log(
        "[ProfileSetupScreen]   - location_city:",
        profileData.location_city,
      );
      console.log("[ProfileSetupScreen]   - age_min:", profileData.age_min);
      console.log("[ProfileSetupScreen]   - age_max:", profileData.age_max);
      console.log(
        "[ProfileSetupScreen]   - proximity_range:",
        profileData.proximity_range,
      );
      console.log("[ProfileSetupScreen]   - photos to upload:", photos.length);
      console.log(
        "[ProfileSetupScreen] Access Token:",
        accessToken ? `present (length: ${accessToken.length})` : "MISSING",
      );

      if (!accessToken) {
        console.error(
          "[ProfileSetupScreen] No access token available - cannot save profile",
        );
        Alert.alert(
          "Error",
          "Authentication error. Please log out and log in again.",
          [{ text: "OK" }],
        );
        return;
      }

      setIsSaving(true);

      try {
        // Step 1: Upload photos first
        console.log("=".repeat(6));
        console.log("[ProfileSetupScreen] Step 1: Uploading photos");
        console.log("=".repeat(6));

        for (let i = 0; i < photos.length; i++) {
          const photoUri = photos[i];
          const isPrimary = i === 0; // First photo is primary
          console.log(
            `[ProfileSetupScreen] Uploading photo ${i + 1}/${photos.length}: ${photoUri} (primary: ${isPrimary})`,
          );

          const uploadSuccess = await uploadPhoto(photoUri, isPrimary);

          if (uploadSuccess) {
            console.log(
              `[ProfileSetupScreen] Photo ${i + 1} uploaded successfully`,
            );
          } else {
            console.error(`[ProfileSetupScreen] Photo ${i + 1} upload failed`);
            Alert.alert(
              "Photo Upload Failed",
              `Failed to upload photo ${i + 1}. Please try again.`,
              [{ text: "OK" }],
            );
            setIsSaving(false);
            return;
          }
        }

        console.log("[ProfileSetupScreen] All photos uploaded successfully");
        console.log("-".repeat(6));

        // Step 2: Save profile data
        console.log("=".repeat(6));
        console.log("[ProfileSetupScreen] Step 2: Saving profile data");
        console.log("=".repeat(6));

        const endpoint = "/users/profile";
        const fullUrl = `${API_BASE_URL}${endpoint}`;

        console.log("[ProfileSetupScreen] URL:", fullUrl);
        console.log("[ProfileSetupScreen] Method: PUT");
        console.log("[ProfileSetupScreen] Authorization: Bearer token present");
        console.log(
          "[ProfileSetupScreen] Request body:",
          JSON.stringify(profileData, null, 2),
        );
        console.log("-".repeat(6));

        const response = await fetch(fullUrl, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(profileData),
        });

        console.log(
          "[ProfileSetupScreen] Response status:",
          response.status,
          response.statusText,
        );

        const responseData = await response.json().catch(() => ({}));
        console.log(
          "[ProfileSetupScreen] Response body:",
          JSON.stringify(responseData, null, 2),
        );
        console.log("=".repeat(6));

        if (!response.ok) {
          console.error(
            "[ProfileSetupScreen] Failed to save profile to backend",
          );
          Alert.alert("Error", "Failed to save profile. Please try again.", [
            { text: "OK" },
          ]);
          setIsSaving(false);
          return;
        }

        console.log(
          "[ProfileSetupScreen] Profile saved to backend successfully",
        );

        // Step 3: Add selected tags
        console.log("=".repeat(6));
        console.log("[ProfileSetupScreen] Step 3: Adding selected tags");
        console.log("=".repeat(6));
        console.log(
          "[ProfileSetupScreen] Selected tags count:",
          selectedTags.length,
        );

        if (selectedTags.length > 0) {
          for (const tagId of selectedTags) {
            console.log(`[ProfileSetupScreen] Adding tag:`, tagId);
            const tagSuccess = await addTag(tagId);
            if (!tagSuccess) {
              console.warn(
                `[ProfileSetupScreen] Failed to add tag ${tagId}, continuing...`,
              );
            }
          }
          console.log("[ProfileSetupScreen] Tags added successfully");
        } else {
          console.log("[ProfileSetupScreen] No tags to add");
        }
        console.log("-".repeat(6));

        // Step 4: Set relationship types
        console.log("=".repeat(6));
        console.log("[ProfileSetupScreen] Step 4: Setting relationship types");
        console.log("=".repeat(6));
        console.log(
          "[ProfileSetupScreen] Relationship types:",
          relationshipTypes,
        );

        if (relationshipTypes.length > 0) {
          const relationshipTypesEndpoint = "/users/relationship-types";
          const relationshipTypesUrl = `${API_BASE_URL}${relationshipTypesEndpoint}`;

          console.log("[ProfileSetupScreen] URL:", relationshipTypesUrl);
          console.log("[ProfileSetupScreen] Method: POST");
          console.log(
            "[ProfileSetupScreen] Request body:",
            JSON.stringify({ types: relationshipTypes }, null, 2),
          );

          const relationshipTypesResponse = await fetch(relationshipTypesUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ types: relationshipTypes }),
          });

          console.log(
            "[ProfileSetupScreen] Response status:",
            relationshipTypesResponse.status,
            relationshipTypesResponse.statusText,
          );

          const relationshipTypesData = await relationshipTypesResponse
            .json()
            .catch(() => ({}));
          console.log(
            "[ProfileSetupScreen] Response body:",
            JSON.stringify(relationshipTypesData, null, 2),
          );

          if (relationshipTypesResponse.ok) {
            console.log(
              "[ProfileSetupScreen] Relationship types set successfully",
            );
          } else {
            console.warn(
              "[ProfileSetupScreen] Failed to set relationship types, continuing...",
            );
          }
        } else {
          console.log("[ProfileSetupScreen] No relationship types to set");
        }
        console.log("-".repeat(6));

        // Force fetch the updated profile from backend before marking setup as complete
        // This ensures the profile is fully loaded and cached when user navigates to main app
        console.log(
          "[ProfileSetupScreen] Force fetching updated profile from backend",
        );
        await fetchProfile(true); // Force refresh to get the complete profile

        console.log("[ProfileSetupScreen] Calling completeProfileSetup");
        console.log("[ProfileSetupScreen] User data available:", !!user);
        console.log("[ProfileSetupScreen] User name:", user?.name);
        console.log(
          "[ProfileSetupScreen] User profilePicture:",
          user?.profilePicture ? "yes" : "no",
        );

        // Pass the updated user data to AuthContext
        completeProfileSetup({
          name: user?.name,
          profilePicture: user?.profilePicture,
        });
        console.log("[ProfileSetupScreen] Profile setup complete");
      } catch (error) {
        console.error("[ProfileSetupScreen] Error saving profile:", error);
        Alert.alert(
          "Error",
          "Network error. Please check your connection and try again.",
          [{ text: "OK" }],
        );
        setIsSaving(false);
        return;
      }

      setIsSaving(false);
      // Navigation is handled automatically by RootNavigator
      // when hasCompletedProfileSetup becomes true
    }
  }, [
    currentStepIndex,
    currentStep,
    name,
    age,
    gender,
    orientation,
    relationshipTypes,
    photos,
    bio,
    selectedTags,
    city,
    ageRange,
    maxDistance,
    updateUser,
    completeProfileSetup,
    email,
    googleUserId,
    accessToken,
    uploadPhoto,
    addTag,
    fetchProfile,
    userLocation,
  ]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDirection("backward");

    if (currentStepIndex > 0) {
      setCurrentStep(STEPS[currentStepIndex - 1]);
    }
  }, [currentStepIndex]);

  const handlePickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      allowsMultipleSelection: false,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPhotos((prev) => [...prev, result.assets[0].uri]);
    }
  }, []);

  const handleRemovePhoto = useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const toggleTag = useCallback((tagId: string) => {
    setSelectedTags(
      (prev) =>
        prev.includes(tagId)
          ? prev.filter((id) => id !== tagId)
          : [...prev, tagId], // No limit on tag selection
    );
  }, []);

  const toggleRelationshipType = useCallback((type: string) => {
    setRelationshipTypes((prev) => {
      if (prev.includes(type)) {
        // Remove if already selected
        return [];
      } else {
        // Single selection - replace with new selection
        return [type];
      }
    });
  }, []);

  const handleLocationPermission = useCallback(async () => {
    setLocationRequesting(true);
    try {
      const granted = await requestPermission();
      if (!granted) {
        console.log("[ProfileSetupScreen] Location permission denied");
      }
    } catch (error) {
      console.error("[ProfileSetupScreen] Error requesting location:", error);
    } finally {
      setLocationRequesting(false);
    }
  }, [requestPermission]);

  const renderStepContent = () => {
    const enteringAnim =
      direction === "forward"
        ? FadeInRight.duration(300)
        : FadeInLeft.duration(300);
    const exitingAnim =
      direction === "forward"
        ? FadeOutLeft.duration(300)
        : FadeOutRight.duration(300);

    switch (currentStep) {
      case "basics":
        return (
          <Animated.View
            key="basics"
            entering={enteringAnim}
            exiting={exitingAnim}
            style={styles.stepContent}
          >
            <Text style={styles.stepTitle}>Let's start with the basics</Text>
            <Text style={styles.stepSubtitle}>
              Tell us a bit about yourself
            </Text>

            <AnimatedInput
              label="Your Name"
              placeholder="What's your name?"
              value={name}
              onChangeText={setName}
              icon={
                <Ionicons
                  name="person-outline"
                  size={20}
                  color={colors.textMuted}
                />
              }
            />

            <AnimatedInput
              label="Your Age"
              placeholder="How old are you?"
              keyboardType="number-pad"
              value={age}
              onChangeText={setAge}
              icon={
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={colors.textMuted}
                />
              }
            />
          </Animated.View>
        );

      case "gender":
        return (
          <Animated.View
            key="gender"
            entering={enteringAnim}
            exiting={exitingAnim}
            style={styles.stepContent}
          >
            <Text style={styles.stepTitle}>What's your gender?</Text>
            <Text style={styles.stepSubtitle}>
              This helps us personalize your experience
            </Text>

            <View style={styles.optionsGrid}>
              {GENDER_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.genderOption,
                    gender === option.value && styles.genderOptionSelected,
                  ]}
                  onPress={() => setGender(option.value)}
                >
                  <Ionicons
                    name={option.icon as any}
                    size={32}
                    color={
                      gender === option.value ? colors.text : colors.textMuted
                    }
                  />
                  <Text
                    style={[
                      styles.genderOptionText,
                      gender === option.value &&
                        styles.genderOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        );

      case "orientation":
        return (
          <Animated.View
            key="orientation"
            entering={enteringAnim}
            exiting={exitingAnim}
            style={styles.stepContent}
          >
            <Text style={styles.stepTitle}>
              What's your sexual orientation?
            </Text>
            <Text style={styles.stepSubtitle}>
              This helps us personalize your experience
            </Text>

            <ScrollView
              style={styles.orientationScroll}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.orientationOptions}>
                {ORIENTATION_OPTIONS.map((option) => (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.orientationOption,
                      orientation === option.value &&
                        styles.orientationOptionSelected,
                    ]}
                    onPress={() => setOrientation(option.value)}
                  >
                    <Text
                      style={[
                        styles.orientationOptionText,
                        orientation === option.value &&
                          styles.orientationOptionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </Animated.View>
        );

      case "relationshipTypes":
        return (
          <Animated.View
            key="relationshipTypes"
            entering={enteringAnim}
            exiting={exitingAnim}
            style={styles.stepContent}
          >
            <Text style={styles.stepTitle}>What Are You Looking For?</Text>
            <Text style={styles.stepSubtitle}>
              Select one relationship type
            </Text>

            <View style={styles.relationshipTypesGrid}>
              {RELATIONSHIP_TYPE_OPTIONS.map((option) => {
                const isSelected = relationshipTypes.includes(option.value);
                return (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.relationshipTypeCard,
                      isSelected && [
                        styles.relationshipTypeCardSelected,
                        { borderColor: option.color },
                      ],
                    ]}
                    onPress={() => toggleRelationshipType(option.value)}
                  >
                    <View
                      style={[
                        styles.relationshipTypeIconContainer,
                        isSelected
                          ? { backgroundColor: option.color + "30" } // Brighter when selected
                          : { backgroundColor: option.color + "15" }, // Subtle color hint when not selected
                      ]}
                    >
                      <Ionicons
                        name={option.icon as any}
                        size={32}
                        color={isSelected ? option.color : option.color + "99"} // 60% opacity when not selected
                      />
                    </View>
                    <Text
                      style={[
                        styles.relationshipTypeText,
                        isSelected && {
                          color: option.color,
                          fontWeight: fontWeight.semibold,
                        },
                      ]}
                    >
                      {option.label}
                    </Text>
                    {isSelected && (
                      <View
                        style={[
                          styles.relationshipTypeCheck,
                          { backgroundColor: option.color },
                        ]}
                      >
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color={colors.background}
                        />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        );

      case "photos":
        return (
          <Animated.View
            key="photos"
            entering={enteringAnim}
            exiting={exitingAnim}
            style={styles.stepContent}
          >
            <Text style={styles.stepTitle}>Add your best photos</Text>
            <Text style={styles.stepSubtitle}>
              Add at least 1 photo to continue
            </Text>

            <View style={styles.photoGrid}>
              {[...Array(6)].map((_, index) => (
                <Pressable
                  key={index}
                  style={[
                    styles.photoSlot,
                    index === 0 && styles.photoSlotMain,
                  ]}
                  onPress={() => {
                    if (photos[index]) {
                      handleRemovePhoto(index);
                    } else if (index <= photos.length) {
                      handlePickImage();
                    }
                  }}
                >
                  {photos[index] ? (
                    <>
                      <Image
                        source={{ uri: photos[index] }}
                        style={styles.photoImage}
                      />
                      <View style={styles.photoRemove}>
                        <Ionicons name="close" size={16} color={colors.text} />
                      </View>
                    </>
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Ionicons
                        name={index <= photos.length ? "add" : "lock-closed"}
                        size={24}
                        color={
                          index <= photos.length
                            ? colors.primary
                            : colors.textMuted
                        }
                      />
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          </Animated.View>
        );

      case "bio":
        return (
          <Animated.View
            key="bio"
            entering={enteringAnim}
            exiting={exitingAnim}
            style={styles.stepContent}
          >
            <Text style={styles.stepTitle}>Write your bio</Text>
            <Text style={styles.stepSubtitle}>
              Let others know what makes you unique
            </Text>

            <AnimatedInput
              label="About Me"
              placeholder="Tell us about yourself..."
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={4}
              style={styles.bioInput}
              containerStyle={styles.bioContainer}
            />
            <Text style={styles.charCount}>{bio.length}/500 characters</Text>
          </Animated.View>
        );

      case "tags":
        // Group tags by category
        const tagsByCategory = availableTags.reduce(
          (acc, tag) => {
            const category = tag.category || "Other";
            if (!acc[category]) {
              acc[category] = [];
            }
            acc[category].push(tag);
            return acc;
          },
          {} as Record<string, typeof availableTags>,
        );

        const categories = Object.keys(tagsByCategory).sort();

        return (
          <Animated.View
            key="tags"
            entering={enteringAnim}
            exiting={exitingAnim}
            style={styles.stepContent}
          >
            <Text style={styles.stepTitle}>What describes you?</Text>
            <Text style={styles.stepSubtitle}>
              Select at least 3 tags ({selectedTags.length} selected)
            </Text>

            <ScrollView
              style={styles.interestsScroll}
              showsVerticalScrollIndicator={false}
            >
              {categories.map((category) => (
                <View key={category} style={styles.tagCategory}>
                  <Text style={styles.tagCategoryTitle}>{category}</Text>
                  <View style={styles.interestsContainer}>
                    {tagsByCategory[category].map((tag) => (
                      <InterestChip
                        key={tag.tag_id}
                        label={
                          tag.name.charAt(0) + tag.name.slice(1).toLowerCase()
                        } // Title case
                        selected={selectedTags.includes(tag.tag_id)}
                        onPress={() => toggleTag(tag.tag_id)}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          </Animated.View>
        );

      case "location":
        return (
          <Animated.View
            key="location"
            entering={enteringAnim}
            exiting={exitingAnim}
            style={styles.stepContent}
          >
            <Text style={styles.stepTitle}>Enable Location</Text>
            <Text style={styles.stepSubtitle}>
              We use your location to find people near you
            </Text>

            <View style={styles.locationContent}>
              <View style={styles.locationIconContainer}>
                <Ionicons name="location" size={64} color={colors.primary} />
              </View>

              {city ? (
                <View style={styles.locationGranted}>
                  <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                  <Text style={styles.locationGrantedText}>
                    Located in {city}
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.locationDescription}>
                    Allow location access so we can show you people nearby and
                    help others find you.
                  </Text>
                  <Pressable
                    style={[
                      styles.locationButton,
                      locationRequesting && styles.locationButtonDisabled,
                    ]}
                    onPress={handleLocationPermission}
                    disabled={locationRequesting}
                  >
                    {locationRequesting ? (
                      <Text style={styles.locationButtonText}>
                        Getting location...
                      </Text>
                    ) : (
                      <>
                        <Ionicons
                          name="navigate"
                          size={20}
                          color={colors.text}
                        />
                        <Text style={styles.locationButtonText}>
                          Allow Location Access
                        </Text>
                      </>
                    )}
                  </Pressable>
                </>
              )}
            </View>
          </Animated.View>
        );

      case "preferences":
        return (
          <Animated.View
            key="preferences"
            entering={enteringAnim}
            exiting={exitingAnim}
            style={styles.stepContent}
          >
            <Text style={styles.stepTitle}>Set your preferences</Text>
            <Text style={styles.stepSubtitle}>
              Customize who you want to see
            </Text>

            <View style={styles.preferenceSection}>
              <View style={styles.preferenceHeader}>
                <Text style={styles.preferenceLabel}>Age Range</Text>
                <Text style={styles.preferenceValue}>
                  {ageRange.min} - {ageRange.max}
                </Text>
              </View>
              <View style={styles.sliderContainer}>
                <Text style={styles.sliderLabel}>{ageRange.min}</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={18}
                  maximumValue={99}
                  step={1}
                  value={ageRange.max}
                  onValueChange={(value) =>
                    setAgeRange((prev) => ({ ...prev, max: value }))
                  }
                  minimumTrackTintColor={colors.primary}
                  maximumTrackTintColor={colors.border}
                  thumbTintColor={colors.primary}
                />
                <Text style={styles.sliderLabel}>{ageRange.max}</Text>
              </View>
            </View>

            <View style={styles.preferenceSection}>
              <View style={styles.preferenceHeader}>
                <Text style={styles.preferenceLabel}>Maximum Distance</Text>
                <Text style={styles.preferenceValue}>{maxDistance} km</Text>
              </View>
              <Slider
                style={styles.distanceSlider}
                minimumValue={1}
                maximumValue={100}
                step={1}
                value={maxDistance}
                onValueChange={setMaxDistance}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.primary}
              />
            </View>
          </Animated.View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          {currentStepIndex > 0 && (
            <Pressable onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          )}
          <View style={styles.progressContainer}>
            <ProgressBar progress={progress} height={6} />
            <Text style={styles.progressText}>
              Step {currentStepIndex + 1} of {STEPS.length}
            </Text>
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>{renderStepContent()}</View>

        {/* Footer */}
        <View style={styles.footer}>
          <AnimatedButton
            title={
              currentStepIndex === STEPS.length - 1
                ? isSaving
                  ? "Saving..."
                  : "Complete Setup"
                : "Continue"
            }
            onPress={handleNext}
            disabled={!canProceed || isSaving}
            loading={isSaving}
            fullWidth
            size="large"
          />
        </View>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    marginRight: spacing.md,
  },
  progressContainer: {
    flex: 1,
  },
  progressText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: "right",
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  stepSubtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  genderOption: {
    width: (SCREEN_WIDTH - spacing.lg * 2 - spacing.md) / 2,
    aspectRatio: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
  },
  genderOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: "rgba(229, 57, 53, 0.1)",
  },
  genderOptionText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  genderOptionTextSelected: {
    color: colors.text,
  },
  orientationScroll: {
    flex: 1,
  },
  orientationOptions: {
    gap: spacing.md,
  },
  orientationOption: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.border,
  },
  orientationOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: "rgba(229, 57, 53, 0.1)",
  },
  orientationOptionText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
  },
  orientationOptionTextSelected: {
    color: colors.text,
    fontWeight: fontWeight.semibold,
  },
  relationshipTypesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  relationshipTypeCard: {
    width: (SCREEN_WIDTH - spacing.lg * 2 - spacing.md) / 2,
    backgroundColor: "rgba(255, 255, 255, 0.08)", // Brighter unselected state
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    alignItems: "center",
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.15)", // More visible border
    position: "relative",
  },
  relationshipTypeCardSelected: {
    borderWidth: 3,
    backgroundColor: "rgba(255, 255, 255, 0.12)", // Brighter selected state
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5, // Android shadow
  },
  relationshipTypeIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
    backgroundColor: "rgba(255, 255, 255, 0.1)", // Always visible background
  },
  relationshipTypeText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: "rgba(255, 255, 255, 0.7)", // Brighter text color
    textAlign: "center",
  },
  relationshipTypeCheck: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  photoSlot: {
    width: (SCREEN_WIDTH - spacing.lg * 2 - spacing.md * 2) / 3,
    aspectRatio: 3 / 4,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.card,
    overflow: "hidden",
  },
  photoSlotMain: {
    width: (SCREEN_WIDTH - spacing.lg * 2 - spacing.md) / 2,
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  photoRemove: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.error,
    justifyContent: "center",
    alignItems: "center",
  },
  photoPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: borderRadius.lg,
  },
  bioInput: {
    height: 120,
    textAlignVertical: "top",
  },
  bioContainer: {
    marginBottom: spacing.sm,
  },
  charCount: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: "right",
  },
  interestsScroll: {
    flex: 1,
  },
  interestsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  tagCategory: {
    marginBottom: spacing.xl,
  },
  tagCategoryTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
    marginBottom: spacing.md,
    marginLeft: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  locationContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  locationIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(229, 57, 53, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  locationDescription: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  locationButtonDisabled: {
    opacity: 0.6,
  },
  locationButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  locationGranted: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(76, 175, 80, 0.1)",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  locationGrantedText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.medium,
    color: "#4CAF50",
  },
  preferenceSection: {
    marginBottom: spacing.xl,
  },
  preferenceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  preferenceLabel: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  preferenceValue: {
    fontSize: fontSize.lg,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  sliderContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  slider: {
    flex: 1,
    height: 40,
  },
  distanceSlider: {
    width: "100%",
    height: 40,
  },
  sliderLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    width: 30,
    textAlign: "center",
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
});
