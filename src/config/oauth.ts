/**
 * Google OAuth Configuration
 *
 * This file contains all OAuth-related configuration for Google authentication.
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to https://console.cloud.google.com/
 * 2. Create a new project: "InBlood Dating App"
 * 3. Enable Google+ API and Google OAuth 2.0
 * 4. Configure OAuth consent screen:
 *    - App name: InBlood
 *    - Add logo and privacy policy URL
 *    - Scopes: email, profile, openid
 * 5. Create OAuth 2.0 credentials:
 *    - iOS: Bundle ID = com.inblood.app
 *    - Android: Package name = com.inblood.app (+ SHA-1 certificate)
 *    - Web: Authorized redirect URIs
 * 6. Replace the placeholder client IDs below with your actual values
 */

export const GOOGLE_OAUTH_CONFIG = {
  /**
   * Google OAuth Discovery endpoints
   * These are standard Google OAuth 2.0 endpoints
   */
  discovery: {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
  },

  /**
   * Client IDs for each platform
   *
   * IMPORTANT: You must replace these placeholders with your actual client IDs
   * from Google Cloud Console. Each platform requires a separate client ID.
   *
   * To get your client IDs:
   * 1. Go to Google Cloud Console > Credentials
   * 2. Create OAuth 2.0 Client ID for each platform
   * 3. Copy the client ID and paste it here
   */
  // IMPORTANT: For Expo development, you might need to use a Web client ID
  // Create a Web application OAuth client in Google Cloud Console
  // and add redirect URIs: https://auth.expo.io/@your-username/inblood and inblood://redirect
  iosClientId: '592676235268-k7ievgp7oanju3th1qjiui515u42otth.apps.googleusercontent.com',
  androidClientId: '592676235268-k7ievgp7oanju3th1qjiui515u42otth.apps.googleusercontent.com',
  webClientId: '592676235268-k7ievgp7oanju3th1qjiui515u42otth.apps.googleusercontent.com',

  /**
   * Expo client ID for development in Expo Go
   * This is used when running the app in Expo Go during development
   * NOTE: If you get "400: redirect_uri_mismatch", create a Web client ID instead
   */
  expoClientId: '592676235268-k7ievgp7oanju3th1qjiui515u42otth.apps.googleusercontent.com',

  /**
   * OAuth scopes
   * - openid: Required for OpenID Connect
   * - profile: Access to user's basic profile info (name, picture)
   * - email: Access to user's email address
   */
  scopes: ['openid', 'profile', 'email'],

  /**
   * Redirect URI
   * Must match the scheme defined in app.json
   * Format: {scheme}://redirect
   */
  redirectUri: 'inblood://redirect',
};

/**
 * Google User Info API endpoint
 * Used to fetch user profile information after successful authentication
 */
export const GOOGLE_USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v2/userinfo';
