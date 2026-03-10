/**
 * Settings Service
 *
 * API calls for privacy settings, blocking, and notification token management.
 */

import { get, put, post, del, ApiResponse } from "./api";
import { ENDPOINTS } from "../config/api.config";

// ===== Types =====

export interface PrivacySettings {
  is_discoverable: boolean;
  show_distance: 'exact' | 'approximate' | 'hide';
  show_last_active: boolean;
}

export interface BlockedUser {
  block_id: string;
  blocked_user: {
    user_id: string;
    name: string;
    age: number;
    gender: string;
    location_city: string;
    primary_photo: string | null;
  };
  blocked_at: string;
}

export interface BlockedUsersResponse {
  blocked_users: BlockedUser[];
  has_more: boolean;
}

export interface BlockUserResponse {
  block: {
    block_id: string;
    blocker_user_id: string;
    blocked_user_id: string;
    blocked_at: string;
  };
}

// ===== Privacy Settings =====

export const updatePrivacySettings = (
  settings: Partial<PrivacySettings>
): Promise<ApiResponse<PrivacySettings>> => {
  return put<PrivacySettings>(ENDPOINTS.SETTINGS, settings);
};

// ===== Blocking =====

export const getBlockedUsers = (
  limit: number = 20,
  offset: number = 0
): Promise<ApiResponse<BlockedUsersResponse>> => {
  return get<BlockedUsersResponse>(ENDPOINTS.BLOCKS.LIST, { limit, offset });
};

export const unblockUser = (
  blockId: string
): Promise<ApiResponse<{ success: boolean }>> => {
  return del<{ success: boolean }>(ENDPOINTS.BLOCKS.UNBLOCK(blockId));
};

// ===== FCM Token Management =====

export const registerFCMToken = (
  fcmToken: string,
  deviceId: string,
  deviceType: 'iOS' | 'Android' | 'Web' = 'Android'
): Promise<ApiResponse<any>> => {
  return post(ENDPOINTS.NOTIFICATIONS.REGISTER_TOKEN, {
    fcm_token: fcmToken,
    device_id: deviceId,
    device_type: deviceType,
  });
};

export const unregisterFCMToken = (
  deviceId: string
): Promise<ApiResponse<any>> => {
  return post(ENDPOINTS.NOTIFICATIONS.UNREGISTER_TOKEN, {
    device_id: deviceId,
  });
};
