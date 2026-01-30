/**
 * Google OAuth Authentication Hook
 *
 * This custom hook handles Google OAuth authentication using expo-auth-session.
 * It manages the OAuth flow, platform-specific configuration, and returns
 * the authentication request and prompt function.
 *
 * Usage:
 * ```typescript
 * const { request, promptAsync, response } = useGoogleAuth();
 *
 * // Trigger OAuth flow
 * const handleLogin = async () => {
 *   const result = await promptAsync();
 *   if (result?.type === 'success') {
 *     const { authentication } = result;
 *     // Use authentication.accessToken to get user info
 *   }
 * };
 * ```
 */

import { useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { Platform } from 'react-native';
import { GOOGLE_OAUTH_CONFIG } from '../config/oauth';

/**
 * IMPORTANT: This is required for expo-auth-session to work properly on web.
 * It allows the auth session to be completed when the browser returns to the app.
 */
WebBrowser.maybeCompleteAuthSession();

/**
 * Google OAuth Authentication Hook
 *
 * @returns {object} Authentication utilities
 * @returns {AuthRequest | null} request - The auth request object (null until ready)
 * @returns {function} promptAsync - Function to trigger the OAuth flow
 * @returns {AuthSessionResult | null} response - The OAuth response (null until completed)
 */
export const useGoogleAuth = () => {
  /**
   * Determine which client ID to use based on the current platform
   *
   * @returns {string} The appropriate client ID for the current platform
   */
  const getClientId = (): string => {
    if (Platform.OS === 'ios') {
      return GOOGLE_OAUTH_CONFIG.iosClientId;
    }
    if (Platform.OS === 'android') {
      return GOOGLE_OAUTH_CONFIG.androidClientId;
    }
    // Default to web client ID for web and other platforms
    return GOOGLE_OAUTH_CONFIG.webClientId;
  };

  /**
   * Configure and create the OAuth authentication request
   *
   * useAuthRequest returns:
   * - request: The auth request object (null until configuration is complete)
   * - response: The result of the authentication (null until user completes OAuth)
   * - promptAsync: Function to trigger the OAuth flow (opens browser)
   */
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      // Platform-specific client ID
      clientId: getClientId(),

      // OAuth scopes (permissions we're requesting)
      scopes: GOOGLE_OAUTH_CONFIG.scopes,

      /**
       * Redirect URI - where Google will send the user after authentication
       *
       * makeRedirectUri generates the correct URI based on:
       * - Development: Expo's proxy URL (for Expo Go)
       * - Production: Your app's custom scheme (standalone builds)
       */
      redirectUri: AuthSession.makeRedirectUri({
        scheme: 'inblood',
        path: 'redirect',
      }),
    },
    // Google OAuth discovery document
    GOOGLE_OAUTH_CONFIG.discovery
  );

  /**
   * Log the redirect URI for debugging purposes
   * This helps verify the correct redirect URI is being used
   */
  useEffect(() => {
    const redirectUri = AuthSession.makeRedirectUri({
      scheme: 'inblood',
      path: 'redirect',
    });
    console.log('[useGoogleAuth] Redirect URI:', redirectUri);
    console.log('[useGoogleAuth] Platform:', Platform.OS);
    console.log('[useGoogleAuth] Client ID:', getClientId());
  }, []);

  /**
   * Handle OAuth response
   * This effect runs whenever the OAuth flow completes
   */
  useEffect(() => {
    if (response) {
      console.log('[useGoogleAuth] OAuth response:', response.type);

      if (response.type === 'success') {
        console.log('[useGoogleAuth] Authentication successful');
        // Note: The actual handling of the access token is done in the component
        // that uses this hook, not here
      } else if (response.type === 'error') {
        console.error('[useGoogleAuth] Authentication error:', response.error);
      } else if (response.type === 'cancel') {
        console.log('[useGoogleAuth] User cancelled authentication');
      }
    }
  }, [response]);

  return {
    /**
     * The authentication request object
     * Null until the request is fully configured
     */
    request,

    /**
     * Function to trigger the OAuth flow
     * Opens the browser for user authentication
     */
    promptAsync,

    /**
     * The OAuth response
     * Null until the user completes or cancels the authentication
     */
    response,
  };
};
