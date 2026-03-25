/**
 * Profile Service
 *
 * API calls for user profile management:
 * - Fetch current user profile
 * - Update profile data
 * - Photo management
 * - Tags management
 * - Preferences
 * - Verification
 */

import { get, put, post, del, postFormData, putFormData, ApiResponse } from "./api";
import { ENDPOINTS } from "../config/api.config";
import type {
  ProfileResponse,
  OtherUserProfileResponse,
  PhotoUploadResponse,
  TagsResponse,
  AddTagResponse,
  RemoveTagResponse,
  UpdatePreferencesResponse,
  VerificationRequestResponse,
  VerificationStatusResponse,
} from "../types";

// =====
// Core Profile Operations
// =====

/**
 * Get current user's profile
 */
export const getUserProfile = async (): Promise<
  ApiResponse<ProfileResponse>
> => {
  console.log("[profile.service] Fetching user profile");
  return get<ProfileResponse>(ENDPOINTS.USERS.PROFILE);
};

/**
 * Update current user's profile
 * Accepts partial updates
 */
export const updateUserProfile = async (
  updates: Partial<{
    name: string;
    age: number;
    bio: string;
    pronouns: string;
    sexual_orientation: string;
    languages: string[];
    interests: string[];
    interested_in: string[];
    prompts: Array<{ question: string; answer: string; order_index: number }>;
    opening_moves: Array<{ question: string; answer: string; order_index: number }>;
    job_title: string;
    company: string;
    education: string;
    drinking: string;
    smoking: string;
    exercise: string;
    pets: string;
  }>,
): Promise<ApiResponse<ProfileResponse>> => {
  console.log("[profile.service] Updating user profile:", Object.keys(updates));
  return put<ProfileResponse>(ENDPOINTS.USERS.PROFILE, updates);
};

/**
 * Get another user's profile by ID
 */
export const getOtherUserProfile = async (
  userId: string,
): Promise<ApiResponse<OtherUserProfileResponse>> => {
  console.log("[profile.service] Fetching other user profile:", userId);
  return get<OtherUserProfileResponse>(ENDPOINTS.USERS.BY_ID(userId));
};

// =====
// Photo Operations
// =====

/**
 * Upload a photo
 * Sets as primary if it's the first photo or if specified
 */
export const uploadPhoto = async (
  photoUri: string,
  isPrimary: boolean = false,
): Promise<ApiResponse<PhotoUploadResponse>> => {
  console.log("[profile.service] Uploading photo, isPrimary:", isPrimary);

  const formData = new FormData();

  formData.append("photo", {
    uri: photoUri,
    type: "image/jpeg",
    name: "profile_photo.jpg",
  } as any);

  if (isPrimary) {
    formData.append("is_primary", "true");
  }

  return postFormData<PhotoUploadResponse>(
    ENDPOINTS.USERS.UPLOAD_PHOTO,
    formData,
  );
};

/**
 * Replace an existing photo with a new image (atomic: keeps position & primary status)
 */
export const replacePhoto = async (
  photoId: string,
  photoUri: string,
): Promise<ApiResponse<PhotoUploadResponse>> => {
  console.log("[profile.service] Replacing photo:", photoId);

  const formData = new FormData();
  formData.append("photo", {
    uri: photoUri,
    type: "image/jpeg",
    name: "profile_photo.jpg",
  } as any);

  return putFormData<PhotoUploadResponse>(
    ENDPOINTS.USERS.REPLACE_PHOTO(photoId),
    formData,
  );
};

/**
 * Delete a profile photo by ID
 */
export const deletePhoto = async (
  photoId: string,
): Promise<ApiResponse<any>> => {
  console.log("[profile.service] Deleting photo:", photoId);
  return del<any>(ENDPOINTS.USERS.DELETE_PHOTO(photoId));
};

/**
 * Set a photo as the primary (profile) photo
 */
export const setPrimaryPhoto = async (
  photoId: string,
): Promise<ApiResponse<any>> => {
  console.log("[profile.service] Setting primary photo:", photoId);
  return put<any>(ENDPOINTS.USERS.SET_PRIMARY_PHOTO(photoId), {});
};

// =====
// Tags Operations
// =====

/**
 * Get all available tags
 */
export const getAllTags = async (): Promise<ApiResponse<TagsResponse>> => {
  console.log("[profile.service] Fetching all available tags");
  return get<TagsResponse>(ENDPOINTS.TAGS);
};

/**
 * Add a tag to user profile
 */
export const addTag = async (
  tagId: string,
): Promise<ApiResponse<AddTagResponse>> => {
  console.log("[profile.service] Adding tag:", tagId);
  return post<AddTagResponse>(ENDPOINTS.USERS.TAGS, {
    tag_ids: [tagId],
  });
};

/**
 * Remove a tag from user profile
 */
export const removeTag = async (
  tagId: string,
): Promise<ApiResponse<RemoveTagResponse>> => {
  console.log("[profile.service] Removing tag:", tagId);
  return del<RemoveTagResponse>(ENDPOINTS.USERS.REMOVE_TAG(tagId));
};

/**
 * Set user's relationship types
 */
export const setRelationshipTypes = async (
  types: string[],
): Promise<ApiResponse<any>> => {
  console.log("[profile.service] Setting relationship types:", types);
  return post<any>("/users/relationship-types", { types });
};

// =====
// Preferences Operations
// =====

/**
 * Update user preferences (age range, distance, interested in)
 */
export const updatePreferences = async (
  ageMin: number,
  ageMax: number,
  maxDistance: number,
  interestedIn?: string[],
): Promise<ApiResponse<UpdatePreferencesResponse>> => {
  console.log("[profile.service] Updating preferences:", {
    ageMin,
    ageMax,
    maxDistance,
    interestedIn,
  });

  const payload: any = {
    age_min: ageMin,
    age_max: ageMax,
    proximity_range: maxDistance,
  };

  if (interestedIn) {
    payload.interested_in = interestedIn;
  }

  return put<UpdatePreferencesResponse>(ENDPOINTS.USERS.PREFERENCES, payload);
};

// =====
// Verification Operations
// =====

/**
 * Submit verification request with selfie
 */
export const submitVerificationRequest = async (
  photoUri: string,
): Promise<ApiResponse<VerificationRequestResponse>> => {
  console.log("[profile.service] Submitting verification request to:", ENDPOINTS.VERIFICATION.REQUEST);
  console.log("[profile.service] Photo URI:", photoUri ? photoUri.substring(0, 80) : "EMPTY");

  const formData = new FormData();

  formData.append("selfie", {
    uri: photoUri,
    type: "image/jpeg",
    name: "verification.jpg",
  } as any);

  console.log("[profile.service] FormData created, calling postFormData...");
  const result = await postFormData<VerificationRequestResponse>(
    ENDPOINTS.VERIFICATION.REQUEST,
    formData,
  );
  console.log("[profile.service] Verification request result:", JSON.stringify(result));
  return result;
};

/**
 * Get verification status
 */
export const getVerificationStatus = async (): Promise<
  ApiResponse<VerificationStatusResponse>
> => {
  console.log("[profile.service] Fetching verification status");
  return get<VerificationStatusResponse>(ENDPOINTS.VERIFICATION.STATUS);
};

// =====
// Default Export
// =====

export default {
  getUserProfile,
  updateUserProfile,
  getOtherUserProfile,
  uploadPhoto,
  replacePhoto,
  deletePhoto,
  setPrimaryPhoto,
  getAllTags,
  addTag,
  removeTag,
  updatePreferences,
  submitVerificationRequest,
  getVerificationStatus,
};
