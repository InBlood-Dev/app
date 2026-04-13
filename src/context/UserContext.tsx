import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { User, ApiUserProfile, ApiPhoto, ApiTag, ApiPrompt } from '../types';
import { trackEvent } from '../lib/analytics';
import {
  getUserProfile,
  updateUserProfile as updateUserProfileApi,
  getOtherUserProfile,
  uploadPhoto as uploadPhotoApi,
  deletePhoto as deletePhotoApi,
  setPrimaryPhoto as setPrimaryPhotoApi,
  replacePhoto as replacePhotoApi,
  getAllTags,
  addTag as addTagApi,
  removeTag as removeTagApi,
  updatePreferences as updatePreferencesApi,
  getVerificationStatus,
  submitVerificationRequest,
} from '../services/profile.service';
import { useAuth } from './AuthContext';

// Relationship type for filter selection
export type RelationshipTypeId = 'long-term' | 'casual' | 'friendship' | 'marriage' | 'open' | null;

// Cache duration: 30 seconds
const CACHE_DURATION = 30000;

interface UserState {
  user: User | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  availableTags: ApiTag[];
  tagsLoading: boolean;
  lastFetched: Date | null;
}

interface UserContextType extends UserState {
  // Profile fetching
  fetchProfile: (forceRefresh?: boolean) => Promise<void>;
  refreshProfile: () => Promise<void>;
  fetchOtherUser: (userId: string) => Promise<User | null>;

  // Profile updates
  updateProfile: (updates: Partial<User>) => Promise<boolean>;

  // Photo management
  uploadPhoto: (photoUri: string, isPrimary?: boolean) => Promise<boolean>;
  replacePhoto: (photoId: string, photoUri: string) => Promise<boolean>;
  deletePhoto: (photoId: string) => Promise<boolean>;
  setPrimaryPhoto: (photoId: string) => Promise<boolean>;

  // Tags management
  fetchAvailableTags: () => Promise<void>;
  addTag: (tagId: string) => Promise<boolean>;
  removeTag: (tagId: string) => Promise<boolean>;

  // Preferences
  updatePreferences: (
    ageMin: number,
    ageMax: number,
    maxDistance: number,
    interestedIn?: string[]
  ) => Promise<boolean>;
  updateDiscoveryFilters: (
    ageMin: number,
    ageMax: number,
    maxDistance: number,
    genderPreference: string
  ) => Promise<boolean>;

  // Verification
  submitVerification: (photoUri: string) => Promise<boolean>;
  checkVerificationStatus: () => Promise<void>;

  // Local state management
  updateUser: (updates: Partial<User>) => void; // Optimistic updates
  setUser: (user: User) => void;
  clearUser: () => void;
  clearError: () => void;

  // Filter state
  selectedRelationshipType: RelationshipTypeId;
  setSelectedRelationshipType: (type: RelationshipTypeId) => void;
}

/**
 * Convert API user profile to local User type
 * Safely handles null/undefined arrays from backend
 * Handles backend inconsistencies (user_id vs _id, photos array vs primary_photo)
 * Validates that required profile fields exist - throws error for incomplete profiles
 */
const apiProfileToUser = (apiProfile: any, fallbackProfilePicture?: string | null): User => {
  // Validate critical required fields that must exist in a complete profile
  // Users who haven't completed onboarding will be missing these fields
  if (!apiProfile.age || !apiProfile.gender) {
    console.error('[apiProfileToUser] Incomplete profile detected - missing required fields');
    console.error('[apiProfileToUser] age:', apiProfile.age);
    console.error('[apiProfileToUser] gender:', apiProfile.gender);
    throw new Error(
      'Incomplete profile: User has not completed profile setup. Missing required fields (age, gender).'
    );
  }

  // Handle backend inconsistency: some endpoints return _id, others return user_id
  const userId = apiProfile.user_id || apiProfile._id;
  if (!userId) {
    throw new Error('Invalid profile: Missing user ID');
  }

  // Handle photos: if photos array is missing, use primary_photo as fallback
  // If still no photos, use fallbackProfilePicture from auth context
  let photos: string[] = [];
  let photoMeta: Array<{ id: string; url: string; isPrimary: boolean; orderIndex: number }> = [];
  if (apiProfile.photos && Array.isArray(apiProfile.photos) && apiProfile.photos.length > 0) {
    photos = apiProfile.photos.map((p: ApiPhoto) => p.url);
    photoMeta = apiProfile.photos.map((p: ApiPhoto) => ({
      id: p._id,
      url: p.url,
      isPrimary: p.is_primary,
      orderIndex: p.order_index,
    }));
    // DEBUG: verify _id is present in photo objects from backend
    console.log('[apiProfileToUser] photoMeta IDs:', photoMeta.map(m => m.id));
    console.log('[apiProfileToUser] first photo raw _id:', apiProfile.photos[0]?._id);
  } else if (apiProfile.primary_photo) {
    photos = [apiProfile.primary_photo];
  } else if (fallbackProfilePicture) {
    photos = [fallbackProfilePicture];
    console.log('[apiProfileToUser] Using fallback profile picture from auth context');
  }

  // Handle preferences: some endpoints return proximity_range, others return preference_max_distance
  const maxDistance = apiProfile.preference_max_distance || apiProfile.proximity_range || 100;
  const ageMin = apiProfile.preference_age_min || apiProfile.age_min || 18;
  const ageMax = apiProfile.preference_age_max || apiProfile.age_max || 99;

  return {
    id: userId,
    name: apiProfile.name,
    age: apiProfile.age,
    gender: apiProfile.gender as 'Man' | 'Woman' | 'Non-Binary' | 'Other',
    interestedIn: (apiProfile.interested_in || []) as ('Man' | 'Woman' | 'Non-Binary' | 'everyone')[],
    photos,
    photoMeta,
    bio: apiProfile.bio || '',
    interests: apiProfile.interests || [],
    prompts: (apiProfile.prompts || []).map((p: ApiPrompt) => ({
      question: p.question,
      answer: p.answer,
    })),
    openingMoves: (apiProfile.opening_moves || []).map((p: ApiPrompt) => ({
      question: p.question,
      answer: p.answer,
    })),
    pronouns: apiProfile.pronouns || undefined,
    orientation: apiProfile.sexual_orientation || undefined,
    languages: apiProfile.languages || [],
    tags: (apiProfile.tags || []).map((t: ApiTag) => t.name),
    relationshipTypes: apiProfile.relationship_types || [],
    stats: {
      seductions: apiProfile.seductions_count || 0,
      likes: apiProfile.hearts_count || 0,
    },
    location: {
      city: apiProfile.location_city || 'Unknown',
      distance: 0,
    },
    preferences: {
      ageRange: {
        min: ageMin,
        max: ageMax,
      },
      maxDistance,
    },
    verified: apiProfile.is_verified || false,
    lastActive: apiProfile.last_active_at ? new Date(apiProfile.last_active_at) : undefined,
    settings: {
      isDiscoverable: apiProfile.is_discoverable !== undefined ? apiProfile.is_discoverable : true,
      showDistance: apiProfile.show_distance || 'exact',
      showLastActive: apiProfile.show_last_active !== undefined ? apiProfile.show_last_active : true,
    },
  };
};

const defaultUser: User = {
  id: 'current-user',
  name: '',
  age: 25,
  gender: 'male',
  interestedIn: ['female'],
  photos: [],
  bio: '',
  interests: [],
  location: {
    city: 'New York',
    distance: 0,
  },
  preferences: {
    ageRange: { min: 21, max: 35 },
    maxDistance: 25,
  },
  verified: false,
};

const initialState: UserState = {
  user: null,
  isLoading: false,
  isRefreshing: false,
  error: null,
  availableTags: [],
  tagsLoading: false,
  lastFetched: null,
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<UserState>(initialState);
  const [selectedRelationshipType, setSelectedRelationshipType] = useState<RelationshipTypeId>(null);
  const { isAuthenticated, accessToken, profilePicture, hasCompletedProfileSetup } = useAuth();

  /**
   * Fetch current user profile from backend
   * Implements caching to avoid redundant requests
   */
  const fetchProfile = useCallback(async (forceRefresh: boolean = false) => {
    // Skip if already loading
    if (state.isLoading && !forceRefresh) {
      console.log('[UserContext] Already loading, skipping duplicate fetch');
      return;
    }

    // Skip if recently fetched (within 30 seconds)
    if (!forceRefresh && state.lastFetched) {
      const timeSinceLastFetch = Date.now() - state.lastFetched.getTime();
      if (timeSinceLastFetch < CACHE_DURATION) {
        console.log('[UserContext] Recently fetched, using cached data');
        return;
      }
    }

    console.log('[UserContext] Fetching user profile');
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await getUserProfile();

      if (response.success && response.data?.user) {
        console.log('[UserContext] Profile fetched successfully');
        console.log('[UserContext] Backend response has photos:', !!response.data.user.photos);
        console.log('[UserContext] Backend response has primary_photo:', !!response.data.user.primary_photo);
        console.log('[UserContext] Backend photos count:', response.data.user.photos?.length || 0);
        console.log('[UserContext] Backend user_id:', response.data.user.user_id || response.data.user._id);
        console.log('[UserContext] Fallback profile picture available:', !!profilePicture);

        const convertedUser = apiProfileToUser(response.data.user, profilePicture);
        console.log('[UserContext] Converted user photos count:', convertedUser.photos.length);
        console.log('[UserContext] Converted user photos:', convertedUser.photos);

        setState((prev) => ({
          ...prev,
          user: convertedUser,
          isLoading: false,
          lastFetched: new Date(),
        }));
      } else {
        throw new Error(response.message || 'Failed to fetch profile');
      }
    } catch (error: any) {
      console.error('[UserContext] Error fetching profile:', error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to load profile',
      }));
    }
  }, [state.isLoading, state.lastFetched, profilePicture]);

  /**
   * Refresh profile with pull-to-refresh
   */
  const refreshProfile = useCallback(async () => {
    console.log('[UserContext] Refreshing profile');
    setState((prev) => ({ ...prev, isRefreshing: true, error: null }));

    try {
      const response = await getUserProfile();

      if (response.success && response.data?.user) {
        const convertedUser = apiProfileToUser(response.data.user);
        setState((prev) => ({
          ...prev,
          user: convertedUser,
          isRefreshing: false,
          lastFetched: new Date(),
        }));
      } else {
        throw new Error(response.message || 'Failed to refresh profile');
      }
    } catch (error: any) {
      console.error('[UserContext] Error refreshing profile:', error);
      setState((prev) => ({
        ...prev,
        isRefreshing: false,
        error: error.message || 'Failed to refresh profile',
      }));
    }
  }, []);

  /**
   * Fetch another user's profile
   */
  const fetchOtherUser = useCallback(async (userId: string): Promise<User | null> => {
    console.log('[UserContext] Fetching other user profile:', userId);

    try {
      const response = await getOtherUserProfile(userId);

      if (response.success && response.data?.user) {
        console.log('[UserContext] Other user profile fetched');
        return apiProfileToUser(response.data.user);
      } else {
        throw new Error(response.message || 'Failed to fetch user profile');
      }
    } catch (error: any) {
      console.error('[UserContext] Error fetching other user:', error);
      return null;
    }
  }, []);

  /**
   * Update profile on backend
   */
  const updateProfile = useCallback(
    async (updates: Partial<User>): Promise<boolean> => {
      console.log('[UserContext] Updating profile:', updates);

      // Optimistic update
      setState((prev) => ({
        ...prev,
        user: prev.user ? { ...prev.user, ...updates } : null,
      }));

      try {
        // Convert User updates to API format
        const apiUpdates: any = {};

        if (updates.name !== undefined) apiUpdates.name = updates.name;
        if (updates.age !== undefined) apiUpdates.age = updates.age;
        if (updates.bio !== undefined) apiUpdates.bio = updates.bio;
        if (updates.pronouns !== undefined) apiUpdates.pronouns = updates.pronouns;
        if (updates.orientation !== undefined)
          apiUpdates.sexual_orientation = updates.orientation;
        if (updates.languages !== undefined) apiUpdates.languages = updates.languages;
        if (updates.interestedIn !== undefined) apiUpdates.interested_in = updates.interestedIn;
        if (updates.prompts !== undefined)
          apiUpdates.prompts = updates.prompts.map((p, i) => ({
            question: p.question,
            answer: p.answer,
            order_index: i,
          }));
        if (updates.openingMoves !== undefined)
          apiUpdates.opening_moves = updates.openingMoves.map((p, i) => ({
            question: p.question,
            answer: p.answer,
            order_index: i,
          }));

        const response = await updateUserProfileApi(apiUpdates);

        if (response.success) {
          console.log('[UserContext] Profile updated successfully');
          // Fetch full enriched profile instead of using raw update response
          // (update endpoint returns raw Mongoose doc missing photos, tags, relationship_types)
          await fetchProfile(true);
          return true;
        } else {
          throw new Error(response.message || 'Failed to update profile');
        }
      } catch (error: any) {
        console.error('[UserContext] Error updating profile:', error);

        // Revert optimistic update
        await fetchProfile(true);

        setState((prev) => ({
          ...prev,
          error: error.message || 'Failed to update profile',
        }));
        return false;
      }
    },
    [fetchProfile]
  );

  /**
   * Upload a photo
   */
  const uploadPhoto = useCallback(
    async (photoUri: string, isPrimary: boolean = false): Promise<boolean> => {
      console.log('[UserContext] uploadPhoto START, isPrimary:', isPrimary);
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await uploadPhotoApi(photoUri, isPrimary);
        console.log('[UserContext] uploadPhoto API response success:', response.success);
        console.log('[UserContext] uploadPhoto API response data:', JSON.stringify(response.data));

        // Backend returns single photo object: { photo_id, url, is_primary, order_index }
        if (response.success && response.data?.url) {
          console.log('[UserContext] Photo uploaded, re-fetching profile');
          trackEvent('photo_uploaded', { is_primary: isPrimary });

          // Re-fetch profile to get complete updated photos array from backend
          await fetchProfile(true);

          return true;
        } else {
          throw new Error(response.message || 'Failed to upload photo');
        }
      } catch (error: any) {
        console.error('[UserContext] uploadPhoto ERROR:', error?.message, error?.response?.data);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error.message || 'Failed to upload photo',
        }));
        return false;
      }
    },
    [fetchProfile]
  );

  /**
   * Replace a photo with a new image (keeps same position & primary status)
   */
  const replacePhoto = useCallback(
    async (photoId: string, photoUri: string): Promise<boolean> => {
      console.log('[UserContext] replacePhoto START, photoId:', photoId);

      try {
        const response = await replacePhotoApi(photoId, photoUri);
        console.log('[UserContext] replacePhoto API response success:', response.success);

        if (response.success) {
          console.log('[UserContext] Photo replaced, re-fetching profile');
          await fetchProfile(true);
          return true;
        } else {
          throw new Error(response.message || 'Failed to replace photo');
        }
      } catch (error: any) {
        console.error('[UserContext] replacePhoto ERROR:', error?.message);
        setState((prev) => ({
          ...prev,
          error: error.message || 'Failed to replace photo',
        }));
        return false;
      }
    },
    [fetchProfile]
  );

  /**
   * Delete a photo
   */
  const deletePhoto = useCallback(
    async (photoId: string): Promise<boolean> => {
      console.log('[UserContext] deletePhoto START, photoId:', photoId);

      try {
        const response = await deletePhotoApi(photoId);
        console.log('[UserContext] deletePhoto API response:', JSON.stringify(response));

        if (response.success) {
          console.log('[UserContext] Photo deleted successfully, re-fetching profile');
          await fetchProfile(true);
          return true;
        } else {
          throw new Error(response.message || 'Failed to delete photo');
        }
      } catch (error: any) {
        console.error('[UserContext] deletePhoto ERROR:', error?.message, error?.response?.data);
        setState((prev) => ({
          ...prev,
          error: error.message || 'Failed to delete photo',
        }));
        return false;
      }
    },
    [fetchProfile]
  );

  /**
   * Set a photo as the primary (profile) photo
   */
  const setPrimaryPhoto = useCallback(
    async (photoId: string): Promise<boolean> => {
      console.log('[UserContext] Setting primary photo:', photoId);

      try {
        const response = await setPrimaryPhotoApi(photoId);

        if (response.success) {
          console.log('[UserContext] Primary photo updated successfully');
          await fetchProfile(true);
          return true;
        } else {
          throw new Error(response.message || 'Failed to update profile photo');
        }
      } catch (error: any) {
        console.error('[UserContext] Error setting primary photo:', error);
        setState((prev) => ({
          ...prev,
          error: error.message || 'Failed to update profile photo',
        }));
        return false;
      }
    },
    [fetchProfile]
  );

  /**
   * Fetch all available tags
   */
  const fetchAvailableTags = useCallback(async () => {
    console.log('[UserContext] Fetching available tags');
    setState((prev) => ({ ...prev, tagsLoading: true }));

    try {
      const response = await getAllTags();

      if (response.success && response.data?.tags) {
        console.log('[UserContext] Tags fetched:', response.data.tags.length);
        setState((prev) => ({
          ...prev,
          availableTags: response.data.tags,
          tagsLoading: false,
        }));
      } else {
        throw new Error(response.message || 'Failed to fetch tags');
      }
    } catch (error: any) {
      console.error('[UserContext] Error fetching tags:', error);
      setState((prev) => ({
        ...prev,
        tagsLoading: false,
        error: error.message || 'Failed to load tags',
      }));
    }
  }, []);

  /**
   * Add a tag
   */
  const addTag = useCallback(
    async (tagId: string): Promise<boolean> => {
      console.log('[UserContext] Adding tag:', tagId);

      try {
        const response = await addTagApi(tagId);

        if (response.success) {
          console.log('[UserContext] Tag added successfully');

          // If backend returns updated tags list, update state
          // Otherwise, tags will be updated on next profile fetch
          if (response.data?.user_tags) {
            setState((prev) => ({
              ...prev,
              user: prev.user
                ? {
                    ...prev.user,
                    tags: response.data.user_tags.map((t: ApiTag) => t.name),
                  }
                : null,
            }));
          }

          return true;
        } else {
          throw new Error(response.message || 'Failed to add tag');
        }
      } catch (error: any) {
        console.error('[UserContext] Error adding tag:', error);

        setState((prev) => ({
          ...prev,
          error: error.message || 'Failed to add tag',
        }));
        return false;
      }
    },
    []
  );

  /**
   * Remove a tag
   */
  const removeTag = useCallback(async (tagId: string): Promise<boolean> => {
    console.log('[UserContext] Removing tag:', tagId);

    try {
      const response = await removeTagApi(tagId);

      if (response.success && response.data?.user_tags) {
        console.log('[UserContext] Tag removed successfully');

        setState((prev) => ({
          ...prev,
          user: prev.user
            ? {
                ...prev.user,
                tags: response.data.user_tags.map((t: ApiTag) => t.name),
              }
            : null,
        }));

        return true;
      } else {
        throw new Error(response.message || 'Failed to remove tag');
      }
    } catch (error: any) {
      console.error('[UserContext] Error removing tag:', error);
      setState((prev) => ({
        ...prev,
        error: error.message || 'Failed to remove tag',
      }));
      return false;
    }
  }, []);

  /**
   * Update preferences
   */
  const updatePreferences = useCallback(
    async (
      ageMin: number,
      ageMax: number,
      maxDistance: number,
      interestedIn?: string[]
    ): Promise<boolean> => {
      console.log('[UserContext] Updating preferences');

      // Optimistic update
      setState((prev) => ({
        ...prev,
        user: prev.user
          ? {
              ...prev.user,
              preferences: {
                ageRange: { min: ageMin, max: ageMax },
                maxDistance,
              },
              ...(interestedIn && { interestedIn }),
            }
          : null,
      }));

      try {
        const response = await updatePreferencesApi(ageMin, ageMax, maxDistance, interestedIn);

        if (response.success) {
          console.log('[UserContext] Preferences updated successfully');
          return true;
        } else {
          throw new Error(response.message || 'Failed to update preferences');
        }
      } catch (error: any) {
        console.error('[UserContext] Error updating preferences:', error);

        // Revert optimistic update
        await fetchProfile(true);

        setState((prev) => ({
          ...prev,
          error: error.message || 'Failed to update preferences',
        }));
        return false;
      }
    },
    [fetchProfile]
  );

  /**
   * Update discovery filters (convenience wrapper for updatePreferences)
   * Used by DiscoverScreen filter modal
   */
  const updateDiscoveryFilters = useCallback(
    async (
      ageMin: number,
      ageMax: number,
      maxDistance: number,
      genderPreference: string // 'women' | 'men' | 'everyone'
    ): Promise<boolean> => {
      console.log('[UserContext] Updating discovery filters');

      // Map UI gender to backend interested_in array
      const { mapGenderToInterestedIn, validateFilters } = require('../utils/filterMapping');
      const interestedIn = mapGenderToInterestedIn(genderPreference);

      // Validate filters
      const validation = validateFilters(ageMin, ageMax, maxDistance);
      if (!validation.valid) {
        setState((prev) => ({
          ...prev,
          error: validation.error,
        }));
        return false;
      }

      // Delegate to existing updatePreferences method
      // This handles optimistic updates, error rollback, etc.
      return updatePreferences(ageMin, ageMax, maxDistance, interestedIn);
    },
    [updatePreferences]
  );

  /**
   * Submit verification request
   */
  const submitVerification = useCallback(async (photoUri: string): Promise<boolean> => {
    console.log('[UserContext] submitVerification called, photoUri:', photoUri ? photoUri.substring(0, 80) : 'EMPTY');

    // Don't set isLoading here — this runs fire-and-forget alongside the UI
    try {
      console.log('[UserContext] Calling submitVerificationRequest API...');
      const response = await submitVerificationRequest(photoUri);
      console.log('[UserContext] Verification API response:', JSON.stringify(response));

      if (response.success) {
        console.log('[UserContext] Verification submitted successfully!');
        return true;
      } else {
        console.error('[UserContext] Verification API returned success=false:', response.message);
        return false;
      }
    } catch (error: any) {
      console.error('[UserContext] Verification submission FAILED:', error?.message || error);
      console.error('[UserContext] Verification error statusCode:', error?.statusCode);
      // Re-throw so callers can log it
      throw error;
    }
  }, []);

  /**
   * Check verification status
   */
  const checkVerificationStatus = useCallback(async () => {
    console.log('[UserContext] Checking verification status');

    try {
      const response = await getVerificationStatus();

      if (response.success && response.data) {
        console.log('[UserContext] Verification status:', response.data.status);

        // Update verified status if approved
        if (response.data.status === 'approved') {
          setState((prev) => ({
            ...prev,
            user: prev.user ? { ...prev.user, verified: true } : null,
          }));
        }
      }
    } catch (error: any) {
      console.error('[UserContext] Error checking verification status:', error);
    }
  }, []);

  /**
   * Local state updates (optimistic)
   */
  const updateUser = useCallback((updates: Partial<User>) => {
    setState((prev) => ({
      ...prev,
      user: prev.user ? { ...prev.user, ...updates } : { ...defaultUser, ...updates },
    }));
  }, []);

  const setUser = useCallback((newUser: User) => {
    setState((prev) => ({ ...prev, user: newUser }));
  }, []);

  const clearUser = useCallback(() => {
    setState(initialState);
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  /**
   * Auto-fetch profile on mount when authenticated
   * IMPORTANT: Only fetch if profile setup is complete to avoid errors with incomplete profiles
   * Skip if there's already an error to prevent infinite loops
   */
  useEffect(() => {
    if (
      isAuthenticated &&
      accessToken &&
      hasCompletedProfileSetup &&
      !state.user &&
      !state.isLoading &&
      !state.error
    ) {
      console.log('[UserContext] Auto-fetching profile on mount');
      fetchProfile();
    } else if (isAuthenticated && !hasCompletedProfileSetup) {
      console.log('[UserContext] Skipping profile fetch - profile setup not complete');
    }
  }, [isAuthenticated, accessToken, hasCompletedProfileSetup, state.user, state.isLoading, state.error, fetchProfile]);

  /**
   * Clear user data on logout
   */
  useEffect(() => {
    if (!isAuthenticated && state.user) {
      console.log('[UserContext] Clearing user data on logout');
      clearUser();
    }
  }, [isAuthenticated, state.user, clearUser]);

  return (
    <UserContext.Provider
      value={{
        ...state,
        fetchProfile,
        refreshProfile,
        fetchOtherUser,
        updateProfile,
        uploadPhoto,
        replacePhoto,
        deletePhoto,
        setPrimaryPhoto,
        fetchAvailableTags,
        addTag,
        removeTag,
        updatePreferences,
        updateDiscoveryFilters,
        submitVerification,
        checkVerificationStatus,
        updateUser,
        setUser,
        clearUser,
        clearError,
        selectedRelationshipType,
        setSelectedRelationshipType,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export { defaultUser };
