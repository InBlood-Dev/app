/**
 * API Configuration
 *
 * Centralized configuration for API endpoints and settings.
 * Configuration loaded from environment variables via app.config.ts
 */

import Constants from "expo-constants";

// Base URL for API requests from environment variables
export const API_BASE_URL =
  // Constants.expoConfig?.extra?.apiBaseUrl ||
  //  'http://192.168.29.105/api/v1' ||
  "https://backend-cfh1.onrender.com/api/v1"; // Fallback

// Request timeout in milliseconds from environment variables
export const API_TIMEOUT = Constants.expoConfig?.extra?.apiTimeout || 30000; // 30 seconds fallback

// Log current configuration (useful for debugging environment issues)
if (__DEV__) {
  console.log(
    "[API Config] Environment:",
    Constants.expoConfig?.extra?.env || "unknown",
  );
  console.log("[API Config] Base URL:", API_BASE_URL);
  console.log("[API Config] Timeout:", API_TIMEOUT, "ms");
}

// API Endpoints
export const ENDPOINTS = {
  // Auth
  AUTH: {
    GOOGLE_MOBILE: "/auth/google/mobile",
    REFRESH_TOKEN: "/auth/refresh-token",
  },

  // User Profile
  USERS: {
    PROFILE: "/users/profile",
    BY_ID: (userId: string) => `/users/${userId}`,
    LOCATION: "/users/location",
    UPLOAD_PHOTO: "/users/upload-photo",
    DELETE_PHOTO: (photoId: string) => `/users/photos/${photoId}`,
    REPLACE_PHOTO: (photoId: string) => `/users/photos/${photoId}/replace`,
    SET_PRIMARY_PHOTO: (photoId: string) => `/users/photos/${photoId}/set-primary`,
    TAGS: "/users/tags",
    REMOVE_TAG: (tagId: string) => `/users/tags/${tagId}`,
    PREFERENCES: "/users/preferences",
  },

  // Stories
  STORIES: {
    FEED: "/stories/feed",
    CREATE: "/stories",
    MY_STORIES: "/stories/me",
    DELETE: (storyId: string) => `/stories/${storyId}`,
    VIEW: (storyId: string) => `/stories/${storyId}/view`,
    VIEWERS: (storyId: string) => `/stories/${storyId}/viewers`,
  },

  // Discovery
  DISCOVERY: {
    FEED: "/discovery/feed",
    EXPLORE: "/explore/feed",
    GALLERY: "/explore/gallery",
  },

  // Location / Nearby
  LOCATION: {
    NEARBY_ACTIVE: "/home/nearby-active",
    MAP_NEARBY: "/map/nearby",
  },

  // Interactions
  INTERACTIONS: {
    LIKE: "/likes",
    SUPER_LIKE: "/super-likes",
    PASS: "/passes",
    MATCHES: "/matches",
    UNMATCH: (matchId: string) => `/matches/${matchId}`,
    PIN_MATCH: (matchId: string) => `/matches/${matchId}/pin`,
    UNPIN_MATCH: (matchId: string) => `/matches/${matchId}/unpin`,
    PROFILE_VIEW: "/profile-views",
    PENDING_LIKES: "/likes/received",
    DAILY_LIMITS: "/interactions/daily-limits",
  },

  // Search
  SEARCH: "/search",

  // Tags
  TAGS: "/tags",

  // Verification
  VERIFICATION: {
    REQUEST: "/verification/request",
    STATUS: "/verification/status",
  },

  // Upload
  UPLOAD: {
    SINGLE: "/upload/single",
    MULTIPLE: "/upload/multiple",
  },

  // Payments
  PAYMENTS: {
    PLANS: "/payments/plans",
    CREATE_ORDER: "/payments/create-order",
    STATUS: (orderId: string) => `/payments/status/${orderId}`,
  },

  // Subscriptions
  SUBSCRIPTIONS: {
    STATUS: "/subscriptions/status",
    CANCEL: "/subscriptions/cancel",
  },

  // Settings
  SETTINGS: "/users/settings",

  // Reports
  REPORTS: {
    CREATE: "/reports",
  },

  // Blocking
  BLOCKS: {
    LIST: "/blocks",
    BLOCK: "/blocks",
    UNBLOCK: (blockId: string) => `/blocks/${blockId}`,
  },

  // Notifications
  NOTIFICATIONS: {
    REGISTER_TOKEN: "/notifications/register-token",
    UNREGISTER_TOKEN: "/notifications/unregister-token",
  },

  // Legal
  LEGAL: {
    PAGE: (slug: string) => `/legal/${slug}`,
  },

  // Conversations
  CONVERSATIONS: {
    LIST: "/conversations",
    CREATE: "/conversations",
    STATUS: (conversationId: string) =>
      `/conversations/${conversationId}/status`,
  },
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
} as const;
