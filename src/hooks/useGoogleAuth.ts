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
import { Platform } from 'react-native';
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
  accessToken: string;
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
          iosClientId: '345043990448-qfq91ghdtg95tjommcskfbpfgf5frdb0.apps.googleusercontent.com',
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
    console.log('[useGoogleAuth] signIn called');
    console.log('[useGoogleAuth] isConfigured:', isConfigured);

    if (!isConfigured) {
      console.warn('[useGoogleAuth] Google Sign-In not configured yet');
      return null;
    }

    setIsSigningIn(true);

    try {
      // Check current signed-in state
      const currentUser = await GoogleSignin.getCurrentUser();
      console.log('[useGoogleAuth] Current user before signIn:', currentUser ? currentUser.user.email : 'none');

      // Sign out any existing Google user to force account picker
      if (currentUser) {
        console.log('[useGoogleAuth] Signing out existing user to force account picker');
        try {
          await GoogleSignin.signOut();
          console.log('[useGoogleAuth] Existing user signed out');
        } catch (signOutError) {
          console.warn('[useGoogleAuth] Failed to sign out existing user:', signOutError);
        }
      }

      // Check if user has Google Play Services (Android only)
      if (Platform.OS === 'android') {
        console.log('[useGoogleAuth] Checking Play Services');
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        console.log('[useGoogleAuth] Play Services available');
      }

      // Sign in
      console.log('[useGoogleAuth] Calling GoogleSignin.signIn()');
      const response = await GoogleSignin.signIn();
      console.log('[useGoogleAuth] signIn response type:', response.type);

      if (isSuccessResponse(response)) {
        console.log('[useGoogleAuth] Sign-in successful');
        console.log('[useGoogleAuth] User ID:', response.data.user.id);
        console.log('[useGoogleAuth] User email:', response.data.user.email);
        console.log('[useGoogleAuth] User name:', response.data.user.name);

        // Get access token for backend verification
        console.log('[useGoogleAuth] Getting access token');
        const tokens = await GoogleSignin.getTokens();
        console.log('[useGoogleAuth] Access token obtained, length:', tokens.accessToken.length);

        const result = {
          user: {
            id: response.data.user.id,
            email: response.data.user.email,
            name: response.data.user.name,
            photo: response.data.user.photo,
          },
          accessToken: tokens.accessToken,
        };

        console.log('[useGoogleAuth] Returning auth result for:', result.user.email);
        return result;
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
            console.error('[useGoogleAuth] Error code:', error.code);
            console.error('[useGoogleAuth] Error message:', error.message);
        }
      } else {
        console.error('[useGoogleAuth] Unknown error:', error);
      }
      return null;
    } finally {
      setIsSigningIn(false);
      console.log('[useGoogleAuth] signIn completed');
    }
  }, [isConfigured]);

  /**
   * Sign out from Google
   * Also revokes access to force account picker on next sign-in
   */
  const signOut = useCallback(async (): Promise<void> => {
    try {
      console.log('[useGoogleAuth] signOut called');

      // Check current user before sign out
      const currentUser = await GoogleSignin.getCurrentUser();
      console.log('[useGoogleAuth] Current user before signOut:', currentUser ? currentUser.user.email : 'none');

      // Revoke access to force account picker on next sign-in
      console.log('[useGoogleAuth] Revoking access to force account picker');
      try {
        await GoogleSignin.revokeAccess();
        console.log('[useGoogleAuth] Access revoked successfully');
      } catch (revokeError) {
        console.log('[useGoogleAuth] Revoke access failed (may not be signed in):', revokeError);
      }

      // Sign out from Google
      console.log('[useGoogleAuth] Calling GoogleSignin.signOut()');
      await GoogleSignin.signOut();
      console.log('[useGoogleAuth] Signed out successfully');

      // Verify sign out
      const userAfterSignOut = await GoogleSignin.getCurrentUser();
      console.log('[useGoogleAuth] Current user after signOut:', userAfterSignOut ? userAfterSignOut.user.email : 'none');
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
