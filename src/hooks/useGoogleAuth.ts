/**
 * Google Sign-In Hook
 *
 * This custom hook handles Google authentication using the native Google Sign-In SDK.
 * It provides a native sign-in experience without browser redirects.
 *
 * Usage:
 * ```typescript
 * const { signIn, signOut, isConfigured } = useGoogleAuth();
 *
 * const handleLogin = async () => {
 *   const userInfo = await signIn();
 *   if (userInfo) {
 *     // Use userInfo.user.email, userInfo.user.name, etc.
 *   }
 * };
 * ```
 */

import { useEffect, useState, useCallback } from 'react';
import {
  GoogleSignin,
  statusCodes,
  isSuccessResponse,
  isErrorWithCode,
  type User,
} from '@react-native-google-signin/google-signin';

interface GoogleAuthResult {
  user: {
    id: string;
    email: string | null;
    name: string | null;
    photo: string | null;
  };
  idToken: string | null;
}

interface UseGoogleAuthReturn {
  signIn: () => Promise<GoogleAuthResult | null>;
  signOut: () => Promise<void>;
  isConfigured: boolean;
  isSigningIn: boolean;
}

/**
 * Google Sign-In Hook
 *
 * @returns {UseGoogleAuthReturn} Authentication utilities
 */
export const useGoogleAuth = (): UseGoogleAuthReturn => {
  const [isConfigured, setIsConfigured] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  /**
   * Configure Google Sign-In on mount
   */
  useEffect(() => {
    const configure = async () => {
      try {
        await GoogleSignin.configure({
          scopes: ['profile', 'email'],
        });
        setIsConfigured(true);
        console.log('[useGoogleAuth] Google Sign-In configured successfully');
      } catch (error) {
        console.error('[useGoogleAuth] Configuration error:', error);
      }
    };

    configure();
  }, []);

  /**
   * Sign in with Google
   * Opens native Google Sign-In modal
   *
   * @returns {Promise<GoogleAuthResult | null>} User info or null if cancelled/failed
   */
  const signIn = useCallback(async (): Promise<GoogleAuthResult | null> => {
    if (!isConfigured) {
      console.warn('[useGoogleAuth] Google Sign-In not configured yet');
      return null;
    }

    setIsSigningIn(true);

    try {
      // Check if user has Google Play Services
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Sign in
      const response = await GoogleSignin.signIn();

      if (isSuccessResponse(response)) {
        console.log('[useGoogleAuth] Sign-in successful');

        return {
          user: {
            id: response.data.user.id,
            email: response.data.user.email,
            name: response.data.user.name,
            photo: response.data.user.photo,
          },
          idToken: response.data.idToken,
        };
      } else {
        console.log('[useGoogleAuth] Sign-in cancelled by user');
        return null;
      }
    } catch (error) {
      if (isErrorWithCode(error)) {
        switch (error.code) {
          case statusCodes.SIGN_IN_CANCELLED:
            console.log('[useGoogleAuth] User cancelled sign-in');
            break;
          case statusCodes.IN_PROGRESS:
            console.log('[useGoogleAuth] Sign-in already in progress');
            break;
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            console.error('[useGoogleAuth] Play Services not available');
            break;
          default:
            console.error('[useGoogleAuth] Error:', error.code, error.message);
        }
      } else {
        console.error('[useGoogleAuth] Unknown error:', error);
      }
      return null;
    } finally {
      setIsSigningIn(false);
    }
  }, [isConfigured]);

  /**
   * Sign out from Google
   */
  const signOut = useCallback(async (): Promise<void> => {
    try {
      await GoogleSignin.signOut();
      console.log('[useGoogleAuth] Signed out successfully');
    } catch (error) {
      console.error('[useGoogleAuth] Sign-out error:', error);
    }
  }, []);

  return {
    signIn,
    signOut,
    isConfigured,
    isSigningIn,
  };
};
