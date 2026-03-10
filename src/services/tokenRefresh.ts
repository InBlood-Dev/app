/**
 * Token Refresh Service
 *
 * Handles JWT access token refresh using the stored refresh token.
 * Uses raw fetch (not api.ts) to avoid recursive 401 handling.
 * Implements a mutex so concurrent refresh requests share one in-flight call.
 *
 * Returns typed results so callers can distinguish between:
 * - success: got a new token
 * - auth_failed: refresh token is definitively invalid (must re-login)
 * - transient_error: network issue, server down, cold start, etc. (keep session)
 */

import { API_BASE_URL, ENDPOINTS } from '../config/api.config';
import {
  getRefreshToken,
  getAccessToken,
  isTokenExpired,
  storeAuthTokens,
} from '../utils/secureStorage';

export type RefreshResult =
  | { status: 'success'; token: string }
  | { status: 'auth_failed' }
  | { status: 'transient_error'; error?: string };

// Mutex: only one refresh can be in-flight at a time
let refreshPromise: Promise<RefreshResult> | null = null;

/**
 * Attempt to refresh the access token using the stored refresh token.
 * Returns a typed result indicating success, definitive auth failure, or transient error.
 * Multiple concurrent calls share a single in-flight request.
 */
export const refreshAccessToken = async (): Promise<RefreshResult> => {
  if (refreshPromise) {
    console.log('[TokenRefresh] Refresh already in-flight, waiting...');
    return refreshPromise;
  }

  refreshPromise = doRefresh();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
};

async function doRefresh(): Promise<RefreshResult> {
  try {
    const refreshToken = await getRefreshToken();

    if (!refreshToken) {
      console.log('[TokenRefresh] No refresh token stored');
      return { status: 'auth_failed' };
    }

    console.log('[TokenRefresh] Attempting token refresh...');

    const response = await fetch(
      `${API_BASE_URL}${ENDPOINTS.AUTH.REFRESH_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }
    );

    if (!response.ok) {
      console.log('[TokenRefresh] Refresh failed with status:', response.status);

      // 401/403 means the refresh token is definitively invalid/expired
      // User MUST re-login - no point keeping the session
      if (response.status === 401 || response.status === 403) {
        return { status: 'auth_failed' };
      }

      // Any other HTTP error (500, 502, 503, 504, etc.) is transient
      // Server might be cold-starting, temporarily overloaded, etc.
      // Keep the refresh token - it may still be valid
      return {
        status: 'transient_error',
        error: `Server returned ${response.status}`,
      };
    }

    const data = await response.json();
    const newAccessToken = data.data?.accessToken;
    const newRefreshToken = data.data?.refreshToken;

    if (!newAccessToken) {
      console.log('[TokenRefresh] No access token in refresh response');
      return {
        status: 'transient_error',
        error: 'No access token in response',
      };
    }

    // Store new tokens (backend rotates refresh token each time)
    // Access token TTL matches backend JWT_EXPIRES_IN (30min = 1800s)
    const expiresIn = data.data?.expiresIn || 1800;
    await storeAuthTokens(newAccessToken, newRefreshToken, expiresIn);

    console.log('[TokenRefresh] Token refreshed successfully');
    return { status: 'success', token: newAccessToken };
  } catch (error) {
    // Network errors, DNS failures, timeouts, fetch aborts, etc.
    // These are always transient - the refresh token is probably still valid
    console.error('[TokenRefresh] Refresh error:', error);
    return {
      status: 'transient_error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Proactive refresh: check if the stored access token is expired
 * and refresh before any API call fails.
 * Returns a valid access token or null if no session / refresh failed.
 */
export const ensureValidToken = async (
  currentToken: string | null
): Promise<string | null> => {
  if (!currentToken) {
    currentToken = await getAccessToken();
    if (!currentToken) return null;
  }

  const expired = await isTokenExpired();
  if (!expired) {
    return currentToken;
  }

  console.log('[TokenRefresh] Token expired, refreshing proactively...');
  const result = await refreshAccessToken();
  return result.status === 'success' ? result.token : null;
};
