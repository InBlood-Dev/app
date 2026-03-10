/**
 * Secure Storage Utility
 *
 * Provides secure storage for sensitive data like JWT tokens
 * Uses expo-secure-store on native platforms (encrypted)
 * Falls back to AsyncStorage on web (not encrypted, but better than nothing)
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Use SecureStore on native, AsyncStorage on web
const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Storage keys
 */
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'auth_access_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  TOKEN_EXPIRY: 'auth_token_expiry',
  USER_ID: 'auth_user_id',
} as const;

/**
 * Store a value securely
 */
export const setSecureItem = async (key: string, value: string): Promise<void> => {
  try {
    if (isNative) {
      await SecureStore.setItemAsync(key, value);
    } else {
      await AsyncStorage.setItem(key, value);
    }
    console.log(`[SecureStorage] Stored: ${key}`);
  } catch (error) {
    console.error(`[SecureStorage] Failed to store ${key}:`, error);
    throw error;
  }
};

/**
 * Retrieve a value securely
 */
export const getSecureItem = async (key: string): Promise<string | null> => {
  try {
    let value: string | null;

    if (isNative) {
      value = await SecureStore.getItemAsync(key);
    } else {
      value = await AsyncStorage.getItem(key);
    }

    if (value) {
      console.log(`[SecureStorage] Retrieved: ${key}`);
    }
    return value;
  } catch (error) {
    console.error(`[SecureStorage] Failed to retrieve ${key}:`, error);
    return null;
  }
};

/**
 * Delete a value securely
 */
export const deleteSecureItem = async (key: string): Promise<void> => {
  try {
    if (isNative) {
      await SecureStore.deleteItemAsync(key);
    } else {
      await AsyncStorage.removeItem(key);
    }
    console.log(`[SecureStorage] Deleted: ${key}`);
  } catch (error) {
    console.error(`[SecureStorage] Failed to delete ${key}:`, error);
    throw error;
  }
};

/**
 * Clear all secure storage
 */
export const clearSecureStorage = async (): Promise<void> => {
  try {
    const keys = Object.values(STORAGE_KEYS);

    if (isNative) {
      await Promise.all(keys.map(key => SecureStore.deleteItemAsync(key)));
    } else {
      await AsyncStorage.multiRemove(keys);
    }

    console.log('[SecureStorage] Cleared all secure storage');
  } catch (error) {
    console.error('[SecureStorage] Failed to clear storage:', error);
    throw error;
  }
};

/**
 * Token Storage Helper Functions
 */

/**
 * Store authentication tokens
 */
export const storeAuthTokens = async (
  accessToken: string,
  refreshToken?: string,
  expiresIn?: number
): Promise<void> => {
  await setSecureItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);

  if (refreshToken) {
    await setSecureItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
  }

  if (expiresIn) {
    const expiryTime = Date.now() + expiresIn * 1000; // Convert seconds to milliseconds
    await setSecureItem(STORAGE_KEYS.TOKEN_EXPIRY, expiryTime.toString());
  }
};

/**
 * Retrieve access token
 */
export const getAccessToken = async (): Promise<string | null> => {
  return getSecureItem(STORAGE_KEYS.ACCESS_TOKEN);
};

/**
 * Retrieve refresh token
 */
export const getRefreshToken = async (): Promise<string | null> => {
  return getSecureItem(STORAGE_KEYS.REFRESH_TOKEN);
};

/**
 * Check if access token is expired
 */
export const isTokenExpired = async (): Promise<boolean> => {
  const expiryTime = await getSecureItem(STORAGE_KEYS.TOKEN_EXPIRY);

  if (!expiryTime) {
    return true; // If no expiry time, consider expired
  }

  const expiry = parseInt(expiryTime, 10);
  const now = Date.now();

  // Add 1 minute buffer before actual expiry
  return now >= expiry - 60000;
};

/**
 * Store user ID
 */
export const storeUserId = async (userId: string): Promise<void> => {
  await setSecureItem(STORAGE_KEYS.USER_ID, userId);
};

/**
 * Retrieve user ID
 */
export const getUserId = async (): Promise<string | null> => {
  return getSecureItem(STORAGE_KEYS.USER_ID);
};

/**
 * Clear all auth data
 */
export const clearAuthData = async (): Promise<void> => {
  await clearSecureStorage();
};

/**
 * Persistent flags that survive logout (stored via AsyncStorage, not in STORAGE_KEYS)
 */
const PERSISTENT_ONBOARDING_KEY = 'persistent_onboarding_complete';

export const setOnboardingComplete = async (): Promise<void> => {
  await AsyncStorage.setItem(PERSISTENT_ONBOARDING_KEY, 'true');
  console.log('[SecureStorage] Onboarding marked as complete (persistent)');
};

export const getOnboardingComplete = async (): Promise<boolean> => {
  const value = await AsyncStorage.getItem(PERSISTENT_ONBOARDING_KEY);
  return value === 'true';
};
