import { get } from './api';
import { authenticateFirebase, signOutFirebase } from '../config/firebase.config';

let firebaseToken: string | null = null;
let tokenExpiry: number | null = null;

/**
 * Response from /auth/firebase-token endpoint
 */
interface FirebaseTokenResponse {
  firebase_token: string;
  expires_in: number; // Seconds until expiration
}

/**
 * Get Firebase custom token from backend
 * Returns cached token if still valid (refreshes 1 minute before expiry)
 * @returns Firebase custom token
 */
export const getFirebaseToken = async (): Promise<string> => {
  // Return cached token if valid (with 1-minute buffer before expiry)
  if (firebaseToken && tokenExpiry && Date.now() < tokenExpiry) {
    console.log('[Firebase Auth] Using cached token');
    return firebaseToken;
  }

  try {
    console.log('[Firebase Auth] Fetching new custom token from backend...');

    // Fetch custom token from backend
    const response = await get<FirebaseTokenResponse>('/auth/firebase-token');

    if (!response.success || !response.data) {
      console.error('[Firebase Auth] Invalid response:', response);
      throw new Error(response.message || 'Failed to get Firebase token');
    }

    firebaseToken = response.data.firebase_token;
    // Set expiry with 1-minute buffer (expires_in is in seconds)
    tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;

    console.log('[Firebase Auth] Token received successfully');
    console.log('[Firebase Auth] Token expires in:', response.data.expires_in, 'seconds');

    // Authenticate Firebase SDK with the custom token
    await authenticateFirebase(firebaseToken);

    console.log('[Firebase Auth] Firebase SDK authenticated successfully');
    return firebaseToken;
  } catch (error) {
    console.error('[Firebase Auth] Failed to get Firebase token:', error);
    throw error;
  }
};

/**
 * Initialize Firebase authentication
 * Should be called after user logs in to the app
 */
export const initializeFirebaseAuth = async (): Promise<void> => {
  try {
    console.log('[Firebase Auth] Initializing Firebase authentication...');
    await getFirebaseToken();
    console.log('[Firebase Auth] Initialization complete');
  } catch (error) {
    console.error('[Firebase Auth] Initialization failed:', error);
    throw error;
  }
};

/**
 * Clear Firebase authentication state
 * Should be called when user logs out
 */
export const clearFirebaseAuth = async (): Promise<void> => {
  try {
    console.log('[Firebase Auth] Clearing Firebase authentication...');

    // Sign out from Firebase
    await signOutFirebase();

    // Clear cached token
    firebaseToken = null;
    tokenExpiry = null;

    console.log('[Firebase Auth] Cleared successfully');
  } catch (error) {
    console.error('[Firebase Auth] Clear failed:', error);
    // Don't throw - we want logout to proceed even if Firebase signout fails
  }
};

/**
 * Check if Firebase token is valid
 * @returns true if token exists and hasn't expired
 */
export const isFirebaseTokenValid = (): boolean => {
  return !!(firebaseToken && tokenExpiry && Date.now() < tokenExpiry);
};

/**
 * Refresh Firebase token proactively
 * Useful for long-running sessions
 */
export const refreshFirebaseToken = async (): Promise<string> => {
  console.log('[Firebase Auth] Refreshing token...');
  // Clear current token to force refresh
  firebaseToken = null;
  tokenExpiry = null;
  return getFirebaseToken();
};
