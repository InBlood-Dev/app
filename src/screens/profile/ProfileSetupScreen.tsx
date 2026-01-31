import React, { useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  Dimensions,
  Alert,
} from 'react-native';

// TODO: Move to environment config
const API_BASE_URL = 'http://192.168.29.105:5000/api/v1';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInRight,
  FadeInLeft,
  FadeOutLeft,
  FadeOutRight,
  Layout,
  SlideInRight,
  SlideOutLeft,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import Slider from '@react-native-community/slider';
import { AnimatedButton, AnimatedInput, ProgressBar, InterestChip } from '../../components';
import { useUser, useAuth } from '../../context';
import { allInterests } from '../../data/interests';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type RootStackParamList = {
  ProfileSetup: undefined;
  MainTabs: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const STEPS = [
  'basics',
  'gender',
  'interested',
  'photos',
  'bio',
  'interests',
  'location',
  'preferences',
] as const;

type Step = typeof STEPS[number];

const GENDER_OPTIONS = [
  { value: 'male', label: 'Man', icon: 'man' },
  { value: 'female', label: 'Woman', icon: 'woman' },
  { value: 'non-binary', label: 'Non-binary', icon: 'transgender' },
  { value: 'other', label: 'Other', icon: 'ellipsis-horizontal' },
];

const INTERESTED_OPTIONS = [
  { value: 'male', label: 'Men' },
  { value: 'female', label: 'Women' },
  { value: 'everyone', label: 'Everyone' },
];

const CITIES = [
  'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai',
  'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow',
  'Chandigarh', 'Indore', 'Kochi', 'Goa', 'Surat',
];

export const ProfileSetupScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { updateUser } = useUser();
  const { completeProfileSetup, email, googleUserId, accessToken } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  const [currentStep, setCurrentStep] = useState<Step>('basics');
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  // Form state
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<string>('');
  const [interestedIn, setInterestedIn] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [city, setCity] = useState('');
  const [ageRange, setAgeRange] = useState({ min: 21, max: 35 });
  const [maxDistance, setMaxDistance] = useState(25);

  const currentStepIndex = useMemo(() => STEPS.indexOf(currentStep), [currentStep]);
  const progress = useMemo(() => (currentStepIndex + 1) / STEPS.length, [currentStepIndex]);

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 'basics':
        return name.length >= 2 && parseInt(age) >= 18 && parseInt(age) <= 100;
      case 'gender':
        return gender !== '';
      case 'interested':
        return interestedIn.length > 0;
      case 'photos':
        return photos.length >= 1;
      case 'bio':
        return bio.length >= 10;
      case 'interests':
        return interests.length >= 3;
      case 'location':
        return city !== '';
      case 'preferences':
        return true;
      default:
        return false;
    }
  }, [currentStep, name, age, gender, interestedIn, photos, bio, interests, city]);

  const handleNext = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDirection('forward');

    console.log('[ProfileSetupScreen] handleNext called');
    console.log('[ProfileSetupScreen] Current step:', currentStep);
    console.log('[ProfileSetupScreen] Current step index:', currentStepIndex);
    console.log('[ProfileSetupScreen] Total steps:', STEPS.length);

    if (currentStepIndex < STEPS.length - 1) {
      const nextStep = STEPS[currentStepIndex + 1];
      console.log('[ProfileSetupScreen] Moving to next step:', nextStep);
      setCurrentStep(nextStep);
    } else {
      // Complete profile setup - save to backend
      console.log('[ProfileSetupScreen] Final step - saving profile to backend');

      // Backend expects flat field names, not nested objects
      const profileData = {
        name,
        age: parseInt(age),
        gender,
        bio,
        interested_in: interestedIn,
        interests,
        location_city: city,
        age_min: ageRange.min,
        age_max: ageRange.max,
        proximity_range: maxDistance,
      };

      console.log('[ProfileSetupScreen] Profile data to save:');
      console.log('[ProfileSetupScreen]   - name:', profileData.name);
      console.log('[ProfileSetupScreen]   - age:', profileData.age);
      console.log('[ProfileSetupScreen]   - gender:', profileData.gender);
      console.log('[ProfileSetupScreen]   - bio:', profileData.bio);
      console.log('[ProfileSetupScreen]   - interested_in:', profileData.interested_in);
      console.log('[ProfileSetupScreen]   - interests:', profileData.interests);
      console.log('[ProfileSetupScreen]   - location_city:', profileData.location_city);
      console.log('[ProfileSetupScreen]   - age_min:', profileData.age_min);
      console.log('[ProfileSetupScreen]   - age_max:', profileData.age_max);
      console.log('[ProfileSetupScreen]   - proximity_range:', profileData.proximity_range);
      console.log('[ProfileSetupScreen]   - photos to upload:', photos.length);
      console.log('[ProfileSetupScreen] Access Token:', accessToken ? `present (length: ${accessToken.length})` : 'MISSING');

      if (!accessToken) {
        console.error('[ProfileSetupScreen] No access token available - cannot save profile');
        Alert.alert(
          'Error',
          'Authentication error. Please log out and log in again.',
          [{ text: 'OK' }]
        );
        return;
      }

      setIsSaving(true);

      try {
        // Step 1: Upload photos first
        console.log('='.repeat(60));
        console.log('[ProfileSetupScreen] Step 1: Uploading photos');
        console.log('='.repeat(60));

        const uploadedPhotoUrls: string[] = [];
        for (let i = 0; i < photos.length; i++) {
          const photoUri = photos[i];
          console.log(`[ProfileSetupScreen] Uploading photo ${i + 1}/${photos.length}: ${photoUri}`);

          const formData = new FormData();
          // Backend expects field name 'file' for single upload
          formData.append('file', {
            uri: photoUri,
            type: 'image/jpeg',
            name: `photo_${i}.jpg`,
          } as any);

          // Use the correct upload endpoint: /upload/single
          const uploadUrl = `${API_BASE_URL}/upload/single`;
          console.log(`[ProfileSetupScreen] Upload URL: ${uploadUrl}`);

          const uploadResponse = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              // Note: Don't set Content-Type for FormData - let fetch set it with boundary
            },
            body: formData,
          });

          console.log(`[ProfileSetupScreen] Photo ${i + 1} upload status:`, uploadResponse.status);

          if (uploadResponse.ok) {
            const uploadResult = await uploadResponse.json();
            console.log(`[ProfileSetupScreen] Photo ${i + 1} upload result:`, JSON.stringify(uploadResult, null, 2));
            // Check for URL in response - adjust based on actual backend response structure
            const photoUrl = uploadResult.data?.url || uploadResult.data?.secure_url || uploadResult.url;
            if (photoUrl) {
              uploadedPhotoUrls.push(photoUrl);
              console.log(`[ProfileSetupScreen] Photo ${i + 1} URL saved:`, photoUrl);
            } else {
              console.warn(`[ProfileSetupScreen] Photo ${i + 1} uploaded but no URL in response`);
            }
          } else {
            const errorResult = await uploadResponse.json().catch(() => ({}));
            console.error(`[ProfileSetupScreen] Photo ${i + 1} upload failed:`, JSON.stringify(errorResult, null, 2));
          }
        }

        console.log('[ProfileSetupScreen] Photos uploaded:', uploadedPhotoUrls.length);
        console.log('-'.repeat(60));

        // Step 2: Save profile data
        console.log('='.repeat(60));
        console.log('[ProfileSetupScreen] Step 2: Saving profile data');
        console.log('='.repeat(60));

        const endpoint = '/users/profile';
        const fullUrl = `${API_BASE_URL}${endpoint}`;

        console.log('[ProfileSetupScreen] URL:', fullUrl);
        console.log('[ProfileSetupScreen] Method: PUT');
        console.log('[ProfileSetupScreen] Authorization: Bearer token present');
        console.log('[ProfileSetupScreen] Request body:', JSON.stringify(profileData, null, 2));
        console.log('-'.repeat(60));

        const response = await fetch(fullUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify(profileData),
        });

        console.log('[ProfileSetupScreen] Response status:', response.status, response.statusText);

        const responseData = await response.json().catch(() => ({}));
        console.log('[ProfileSetupScreen] Response body:', JSON.stringify(responseData, null, 2));
        console.log('='.repeat(60));

        if (!response.ok) {
          console.error('[ProfileSetupScreen] Failed to save profile to backend');
          Alert.alert(
            'Error',
            'Failed to save profile. Please try again.',
            [{ text: 'OK' }]
          );
          setIsSaving(false);
          return;
        }

        console.log('[ProfileSetupScreen] Profile saved to backend successfully');

        // Update local state with uploaded photo URLs if available
        console.log('[ProfileSetupScreen] Updating local user state');
        updateUser({
          name,
          age: parseInt(age),
          gender: gender as any,
          interestedIn: interestedIn as any,
          photos: uploadedPhotoUrls.length > 0 ? uploadedPhotoUrls : photos,
          bio,
          interests,
          location: { city },
          preferences: { ageRange, maxDistance },
        });

        console.log('[ProfileSetupScreen] Calling completeProfileSetup');
        completeProfileSetup();
        console.log('[ProfileSetupScreen] Profile setup complete');
      } catch (error) {
        console.error('[ProfileSetupScreen] Error saving profile:', error);
        Alert.alert(
          'Error',
          'Network error. Please check your connection and try again.',
          [{ text: 'OK' }]
        );
        setIsSaving(false);
        return;
      }

      setIsSaving(false);
      // Navigation is handled automatically by RootNavigator
      // when hasCompletedProfileSetup becomes true
    }
  }, [currentStepIndex, currentStep, name, age, gender, interestedIn, photos, bio, interests, city, ageRange, maxDistance, updateUser, completeProfileSetup, email, googleUserId, accessToken]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDirection('backward');

    if (currentStepIndex > 0) {
      setCurrentStep(STEPS[currentStepIndex - 1]);
    }
  }, [currentStepIndex]);

  const handlePickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      allowsMultipleSelection: false,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPhotos(prev => [...prev, result.assets[0].uri]);
    }
  }, []);

  const handleRemovePhoto = useCallback((index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  }, []);

  const toggleInterest = useCallback((interest: string) => {
    setInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : prev.length < 10
        ? [...prev, interest]
        : prev
    );
  }, []);

  const renderStepContent = () => {
    const enteringAnim = direction === 'forward' ? FadeInRight.duration(300) : FadeInLeft.duration(300);
    const exitingAnim = direction === 'forward' ? FadeOutLeft.duration(300) : FadeOutRight.duration(300);

    switch (currentStep) {
      case 'basics':
        return (
          <Animated.View key="basics" entering={enteringAnim} exiting={exitingAnim} style={styles.stepContent}>
            <Text style={styles.stepTitle}>Let's start with the basics</Text>
            <Text style={styles.stepSubtitle}>Tell us a bit about yourself</Text>

            <AnimatedInput
              label="Your Name"
              placeholder="What's your name?"
              value={name}
              onChangeText={setName}
              icon={<Ionicons name="person-outline" size={20} color={colors.textMuted} />}
            />

            <AnimatedInput
              label="Your Age"
              placeholder="How old are you?"
              keyboardType="number-pad"
              value={age}
              onChangeText={setAge}
              icon={<Ionicons name="calendar-outline" size={20} color={colors.textMuted} />}
            />
          </Animated.View>
        );

      case 'gender':
        return (
          <Animated.View key="gender" entering={enteringAnim} exiting={exitingAnim} style={styles.stepContent}>
            <Text style={styles.stepTitle}>What's your gender?</Text>
            <Text style={styles.stepSubtitle}>This helps us personalize your experience</Text>

            <View style={styles.optionsGrid}>
              {GENDER_OPTIONS.map(option => (
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
                    color={gender === option.value ? colors.text : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.genderOptionText,
                      gender === option.value && styles.genderOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        );

      case 'interested':
        return (
          <Animated.View key="interested" entering={enteringAnim} exiting={exitingAnim} style={styles.stepContent}>
            <Text style={styles.stepTitle}>Who are you interested in?</Text>
            <Text style={styles.stepSubtitle}>Select who you'd like to meet</Text>

            <View style={styles.interestedOptions}>
              {INTERESTED_OPTIONS.map(option => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.interestedOption,
                    interestedIn.includes(option.value) && styles.interestedOptionSelected,
                  ]}
                  onPress={() => setInterestedIn([option.value])}
                >
                  <Text
                    style={[
                      styles.interestedOptionText,
                      interestedIn.includes(option.value) && styles.interestedOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        );

      case 'photos':
        return (
          <Animated.View key="photos" entering={enteringAnim} exiting={exitingAnim} style={styles.stepContent}>
            <Text style={styles.stepTitle}>Add your best photos</Text>
            <Text style={styles.stepSubtitle}>Add at least 1 photo to continue</Text>

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
                      <Image source={{ uri: photos[index] }} style={styles.photoImage} />
                      <View style={styles.photoRemove}>
                        <Ionicons name="close" size={16} color={colors.text} />
                      </View>
                    </>
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Ionicons
                        name={index <= photos.length ? 'add' : 'lock-closed'}
                        size={24}
                        color={index <= photos.length ? colors.primary : colors.textMuted}
                      />
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          </Animated.View>
        );

      case 'bio':
        return (
          <Animated.View key="bio" entering={enteringAnim} exiting={exitingAnim} style={styles.stepContent}>
            <Text style={styles.stepTitle}>Write your bio</Text>
            <Text style={styles.stepSubtitle}>Let others know what makes you unique</Text>

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

      case 'interests':
        return (
          <Animated.View key="interests" entering={enteringAnim} exiting={exitingAnim} style={styles.stepContent}>
            <Text style={styles.stepTitle}>What are your interests?</Text>
            <Text style={styles.stepSubtitle}>Select at least 3 interests ({interests.length}/10)</Text>

            <ScrollView style={styles.interestsScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.interestsContainer}>
                {allInterests.map(interest => (
                  <InterestChip
                    key={interest}
                    label={interest}
                    selected={interests.includes(interest)}
                    onPress={() => toggleInterest(interest)}
                  />
                ))}
              </View>
            </ScrollView>
          </Animated.View>
        );

      case 'location':
        return (
          <Animated.View key="location" entering={enteringAnim} exiting={exitingAnim} style={styles.stepContent}>
            <Text style={styles.stepTitle}>Where are you located?</Text>
            <Text style={styles.stepSubtitle}>This helps us find matches near you</Text>

            <ScrollView style={styles.citiesScroll} showsVerticalScrollIndicator={false}>
              {CITIES.map(cityOption => (
                <Pressable
                  key={cityOption}
                  style={[
                    styles.cityOption,
                    city === cityOption && styles.cityOptionSelected,
                  ]}
                  onPress={() => setCity(cityOption)}
                >
                  <Ionicons
                    name="location"
                    size={20}
                    color={city === cityOption ? colors.primary : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.cityOptionText,
                      city === cityOption && styles.cityOptionTextSelected,
                    ]}
                  >
                    {cityOption}
                  </Text>
                  {city === cityOption && (
                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        );

      case 'preferences':
        return (
          <Animated.View key="preferences" entering={enteringAnim} exiting={exitingAnim} style={styles.stepContent}>
            <Text style={styles.stepTitle}>Set your preferences</Text>
            <Text style={styles.stepSubtitle}>Customize who you want to see</Text>

            <View style={styles.preferenceSection}>
              <View style={styles.preferenceHeader}>
                <Text style={styles.preferenceLabel}>Age Range</Text>
                <Text style={styles.preferenceValue}>{ageRange.min} - {ageRange.max}</Text>
              </View>
              <View style={styles.sliderContainer}>
                <Text style={styles.sliderLabel}>{ageRange.min}</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={18}
                  maximumValue={99}
                  step={1}
                  value={ageRange.max}
                  onValueChange={(value) => setAgeRange(prev => ({ ...prev, max: value }))}
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
        <View style={styles.content}>
          {renderStepContent()}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <AnimatedButton
            title={currentStepIndex === STEPS.length - 1 ? (isSaving ? 'Saving...' : 'Complete Setup') : 'Continue'}
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
    flexDirection: 'row',
    alignItems: 'center',
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
    textAlign: 'right',
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  genderOption: {
    width: (SCREEN_WIDTH - spacing.lg * 2 - spacing.md) / 2,
    aspectRatio: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
  },
  genderOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(229, 57, 53, 0.1)',
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
  interestedOptions: {
    gap: spacing.md,
  },
  interestedOption: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  interestedOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(229, 57, 53, 0.1)',
  },
  interestedOptionText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
  },
  interestedOptionTextSelected: {
    color: colors.text,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  photoSlot: {
    width: (SCREEN_WIDTH - spacing.lg * 2 - spacing.md * 2) / 3,
    aspectRatio: 3 / 4,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  photoSlotMain: {
    width: (SCREEN_WIDTH - spacing.lg * 2 - spacing.md) / 2,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoRemove: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: borderRadius.lg,
  },
  bioInput: {
    height: 120,
    textAlignVertical: 'top',
  },
  bioContainer: {
    marginBottom: spacing.sm,
  },
  charCount: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'right',
  },
  interestsScroll: {
    flex: 1,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  citiesScroll: {
    flex: 1,
  },
  cityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  cityOptionSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: 'rgba(229, 57, 53, 0.1)',
  },
  cityOptionText: {
    flex: 1,
    fontSize: fontSize.lg,
    color: colors.textMuted,
  },
  cityOptionTextSelected: {
    color: colors.text,
    fontWeight: fontWeight.medium,
  },
  preferenceSection: {
    marginBottom: spacing.xl,
  },
  preferenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  slider: {
    flex: 1,
    height: 40,
  },
  distanceSlider: {
    width: '100%',
    height: 40,
  },
  sliderLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    width: 30,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
});
