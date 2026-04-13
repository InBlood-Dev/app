import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
} from "react";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { setAuthToken } from "../services/api";
import { trackEvent, identifyUser, resetAnalytics } from "../lib/analytics";
import { API_BASE_URL } from "../config/api.config";
import {
  initializeFirebaseAuth,
  clearFirebaseAuth,
} from "../services/firebase-auth.service";
import { notificationService } from "../services/notifications.service";
import {
  storeAuthTokens,
  getAccessToken,
  clearAuthData,
  storeUserId,
  getUserId,
  isTokenExpired,
  setOnboardingComplete,
  getOnboardingComplete,
} from "../utils/secureStorage";
import { refreshAccessToken } from "../services/tokenRefresh";
import type { RefreshResult } from "../services/tokenRefresh";

interface GoogleAuthData {
  user: {
    id: string;
    email: string | null;
    name: string | null;
    photo: string | null;
  };
  accessToken: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  hasCompletedOnboarding: boolean;
  hasCompletedProfileSetup: boolean;
  email: string | null;
  name: string | null;
  profilePicture: string | null;
  userId: string | null; // Backend user ID (different from googleUserId)
  googleUserId: string | null;
  accessToken: string | null;
}

interface AuthContextType extends AuthState {
  googleLogin: (authData: GoogleAuthData) => Promise<boolean>;
  logout: () => void;
  completeOnboarding: () => void;
  completeProfileSetup: (userData?: {
    name?: string;
    profilePicture?: string;
  }) => void;
}

const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  hasCompletedOnboarding: true,
  hasCompletedProfileSetup: false,
  email: null,
  name: null,
  profilePicture: null,
  userId: null,
  googleUserId: null,
  accessToken: null,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<AuthState>(initialState);

  /**
   * Restore authentication session on app startup
   */
  useEffect(() => {
    const restoreSession = async () => {
      console.log("[AuthContext] Restoring session from secure storage...");

      try {
        // Check persistent onboarding state (survives logout)
        const onboardingDone = await getOnboardingComplete();

        const storedToken = await getAccessToken();
        const userId = await getUserId();

        if (storedToken && userId) {
          console.log("[AuthContext] Found stored session");
          console.log("[AuthContext]   - userId:", userId);

          // Proactive token refresh: check if access token is expired
          let validToken = storedToken;
          const expired = await isTokenExpired();

          if (expired) {
            console.log("[AuthContext] Stored token is expired, refreshing...");
            const result: RefreshResult = await refreshAccessToken();

            if (result.status === 'success') {
              validToken = result.token;
              console.log("[AuthContext] Token refreshed during session restore");
            } else if (result.status === 'auth_failed') {
              // Refresh token is definitively invalid - user must re-login
              console.log("[AuthContext] Refresh token invalid - clearing session");
              await clearAuthData();
              setState((prev) => ({
                ...prev,
                isLoading: false,
                hasCompletedOnboarding: onboardingDone,
              }));
              return;
            } else {
              // Transient error (network, cold start, 502, etc.)
              // Keep the session alive - use the expired token
              // The api.ts 401 interceptor will retry refresh on next API call
              console.log("[AuthContext] Refresh failed (transient:", result.error, ") - keeping session alive");
              // validToken stays as storedToken (expired but we keep going)
            }
          }

          // Set token in API client
          setAuthToken(validToken);

          // Update state
          setState((prev) => ({
            ...prev,
            isAuthenticated: true,
            isLoading: false,
            userId,
            accessToken: validToken,
            hasCompletedOnboarding: true,
            hasCompletedProfileSetup: true,
          }));

          // Initialize Firebase authentication (non-blocking)
          try {
            await initializeFirebaseAuth();
            console.log(
              "[AuthContext] Firebase initialized from stored session",
            );
          } catch (error) {
            console.error("[AuthContext] Firebase init failed:", error);
            // Continue anyway - user can still use basic app features
          }

          console.log("[AuthContext] Session restored successfully");
        } else {
          console.log("[AuthContext] No stored session found");
          setState((prev) => ({
            ...prev,
            isLoading: false,
            hasCompletedOnboarding: onboardingDone,
          }));
        }
      } catch (error) {
        console.error("[AuthContext] Failed to restore session:", error);
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    };

    restoreSession();
  }, []); // Run once on mount

  const googleLogin = useCallback(
    async (authData: GoogleAuthData): Promise<boolean> => {
      console.log("[AuthContext] googleLogin called");
      console.log("[AuthContext] Auth data received:");
      console.log("[AuthContext]   - User ID:", authData.user.id);
      console.log("[AuthContext]   - User Email:", authData.user.email);
      console.log("[AuthContext]   - User Name:", authData.user.name);
      console.log(
        "[AuthContext]   - Access Token length:",
        authData.accessToken.length,
      );

      setState((prev) => ({ ...prev, isLoading: true }));

      try {
        const endpoint = "/auth/google/mobile";
        const fullUrl = `${API_BASE_URL}${endpoint}`;
        const requestBody: {
          access_token: string;
          latitude?: number;
          longitude?: number;
        } = {
          access_token: authData.accessToken,
        };

        // Include location if available
        if (authData.location) {
          requestBody.latitude = authData.location.latitude;
          requestBody.longitude = authData.location.longitude;
        }

        console.log("=".repeat(6));
        console.log("[AuthContext] Backend API Call");
        console.log("=".repeat(6));
        console.log("[AuthContext] Base URL:", API_BASE_URL);
        console.log("[AuthContext] Endpoint:", endpoint);
        console.log("[AuthContext] Full URL:", fullUrl);
        console.log("[AuthContext] Method: POST");
        console.log(
          "[AuthContext] Request Body:",
          JSON.stringify(requestBody, null, 2),
        );
        console.log("-".repeat(6));

        // Send access token to backend for verification
        const response = await fetch(fullUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        console.log(
          "[AuthContext] Response Status:",
          response.status,
          response.statusText,
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.log(
            "[AuthContext] Response Body (Error):",
            JSON.stringify(errorData, null, 2),
          );
          console.log("=".repeat(6));
          setState((prev) => ({ ...prev, isLoading: false }));
          return false;
        }

        const backendData = await response.json();
        console.log(
          "[AuthContext] Response Body (Success):",
          JSON.stringify(backendData, null, 2),
        );

        // Extract user data and tokens from response
        // Backend returns: { success, message, data: { user, accessToken, refreshToken } }
        const userData = backendData.data?.user || backendData.user;
        const jwtAccessToken = backendData.data?.accessToken || null;

        // Extract backend user ID (handle inconsistent field names: user_id or _id)
        const userId = userData?.user_id || userData?._id || null;

        console.log("[AuthContext] Extracted data:");
        console.log(
          "[AuthContext]   - userData:",
          userData ? "found" : "missing",
        );
        console.log(
          "[AuthContext]   - userId:",
          userId || "MISSING - CRITICAL ERROR",
        );
        console.log(
          "[AuthContext]   - jwtAccessToken:",
          jwtAccessToken
            ? `found (length: ${jwtAccessToken.length})`
            : "missing",
        );

        // Check if user has completed profile setup
        // Backend should return profile_complete or check if profile fields exist
        const hasProfile =
          userData?.profile_complete === true ||
          (userData?.gender &&
            userData?.bio &&
            userData?.interests?.length > 0);

        console.log("[AuthContext] Profile data check:");
        console.log(
          "[AuthContext]   - profile_complete flag:",
          userData?.profile_complete,
        );
        console.log("[AuthContext]   - gender:", userData?.gender);
        console.log(
          "[AuthContext]   - bio:",
          userData?.bio ? "exists" : "missing",
        );
        console.log(
          "[AuthContext]   - interests:",
          userData?.interests?.length || 0,
        );
        console.log("[AuthContext]   - hasProfile (calculated):", hasProfile);
        console.log("=".repeat(6));

        // CRITICAL: Validate that userId was extracted
        if (!userId) {
          console.error(
            "[AuthContext] CRITICAL ERROR: Backend did not return user ID",
          );
          console.error(
            "[AuthContext] Backend response:",
            JSON.stringify(backendData, null, 2),
          );
          setState((prev) => ({ ...prev, isLoading: false }));
          return false;
        }

        // CRITICAL: Sync JWT token to API client IMMEDIATELY (synchronously)
        // This must happen BEFORE setState triggers re-renders and useEffects
        if (jwtAccessToken) {
          console.log(
            "[AuthContext] Syncing JWT token to API client SYNCHRONOUSLY",
          );
          setAuthToken(jwtAccessToken);
        }

        // Update state with user data from backend or Google
        const newState = {
          isAuthenticated: true,
          isLoading: false,
          email: userData?.email || authData.user.email,
          name: userData?.name || authData.user.name,
          profilePicture: userData?.primary_photo || null,
          userId: userId, // Backend user ID - CRITICAL for Firebase messaging
          googleUserId: authData.user.id,
          hasCompletedOnboarding: true,
          hasCompletedProfileSetup: hasProfile,
          accessToken: jwtAccessToken,
        };

        console.log("[AuthContext] Setting new state:");
        console.log(
          "[AuthContext]   - isAuthenticated:",
          newState.isAuthenticated,
        );
        console.log("[AuthContext]   - userId:", newState.userId);
        console.log("[AuthContext]   - googleUserId:", newState.googleUserId);
        console.log(
          "[AuthContext]   - hasCompletedOnboarding:",
          newState.hasCompletedOnboarding,
        );
        console.log(
          "[AuthContext]   - hasCompletedProfileSetup:",
          newState.hasCompletedProfileSetup,
        );
        console.log("[AuthContext]   - email:", newState.email);
        console.log(
          "[AuthContext]   - profilePicture:",
          newState.profilePicture || "missing",
        );
        console.log(
          "[AuthContext]   - accessToken:",
          newState.accessToken ? "stored" : "missing",
        );

        setState((prev) => ({
          ...prev,
          ...newState,
        }));

        // Persist authentication data to secure storage
        console.log(
          "[AuthContext] Persisting authentication data to secure storage...",
        );
        try {
          if (jwtAccessToken && userId) {
            const refreshToken = backendData.data?.refreshToken || null;
            const expiresIn = backendData.data?.expiresIn || 1800; // Default 30min (matches JWT_EXPIRES_IN)

            await storeAuthTokens(jwtAccessToken, refreshToken, expiresIn);
            await storeUserId(userId);
            await setOnboardingComplete();
            console.log(
              "[AuthContext] Authentication data persisted successfully",
            );
          }
        } catch (error) {
          console.error("[AuthContext] Failed to persist auth data:", error);
          // Don't block login if persistence fails
        }

        // Track auth event
        const isNewUser = userData?.is_new_user === true;
        trackEvent(isNewUser ? "user_signup" : "user_login", { method: "google" });
        if (userId) identifyUser(userId, { email: userData?.email });

        // Initialize Firebase authentication (non-blocking)
        console.log("[AuthContext] Initializing Firebase authentication...");
        try {
          await initializeFirebaseAuth();
          console.log(
            "[AuthContext] Firebase authentication initialized successfully",
          );
        } catch (error) {
          console.error("[AuthContext] Firebase authentication failed:", error);
          // Don't block login if Firebase fails - user can still use the app
          console.log(
            "[AuthContext] Continuing login despite Firebase auth failure",
          );
        }

        return true;
      } catch (error) {
        console.error("[AuthContext] Google login error:", error);
        setState((prev) => ({ ...prev, isLoading: false }));
        return false;
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    console.log("[AuthContext] logout called");
    trackEvent("user_logout");
    resetAnalytics();

    // Sign out from Google to clear cached account
    try {
      console.log("[AuthContext] Signing out from Google");
      const currentUser = await GoogleSignin.getCurrentUser();

      if (currentUser) {
        console.log(
          "[AuthContext] Current Google user:",
          currentUser.user.email,
        );

        // Revoke access to force account picker on next sign-in
        console.log("[AuthContext] Revoking Google access");
        await GoogleSignin.revokeAccess();
        console.log("[AuthContext] Google access revoked");

        // Sign out from Google
        await GoogleSignin.signOut();
        console.log("[AuthContext] Signed out from Google successfully");
      } else {
        console.log("[AuthContext] No Google user currently signed in");
      }
    } catch (error) {
      console.error("[AuthContext] Error signing out from Google:", error);
      // Continue with app logout even if Google sign-out fails
    }

    // Unregister push notifications BEFORE clearing API token (needs auth)
    console.log("[AuthContext] Unregistering push notifications");
    try {
      await notificationService.unregister();
      console.log("[AuthContext] Push notifications unregistered");
    } catch (error) {
      console.error("[AuthContext] Failed to unregister notifications:", error);
    }

    console.log("[AuthContext] Clearing API token");
    setAuthToken(null); // Clear token from API client

    // Clear secure storage
    console.log("[AuthContext] Clearing secure storage");
    try {
      await clearAuthData();
      console.log("[AuthContext] Secure storage cleared successfully");
    } catch (error) {
      console.error("[AuthContext] Failed to clear secure storage:", error);
      // Continue with logout even if storage clear fails
    }

    // Clear Firebase authentication
    console.log("[AuthContext] Clearing Firebase authentication");
    try {
      await clearFirebaseAuth();
      console.log("[AuthContext] Firebase authentication cleared successfully");
    } catch (error) {
      console.error(
        "[AuthContext] Failed to clear Firebase authentication:",
        error,
      );
      // Continue with logout even if Firebase clear fails
    }

    console.log("[AuthContext] Resetting state to initial values");
    console.log(
      "[AuthContext] Initial state:",
      JSON.stringify(initialState, null, 2),
    );
    setState({ ...initialState, isLoading: false });
    console.log("[AuthContext] State reset complete");
  }, []);

  const completeOnboarding = useCallback(async () => {
    setState((prev) => ({ ...prev, hasCompletedOnboarding: true }));
    await setOnboardingComplete();
  }, []);

  const completeProfileSetup = useCallback(
    (userData?: { name?: string; profilePicture?: string }) => {
      console.log("[AuthContext] completeProfileSetup called");
      console.log("[AuthContext] User data provided:", userData ? "yes" : "no");
      if (userData) {
        console.log("[AuthContext]   - name:", userData.name || "not provided");
        console.log(
          "[AuthContext]   - profilePicture:",
          userData.profilePicture ? "provided" : "not provided",
        );
      }
      console.log("[AuthContext] Setting hasCompletedProfileSetup to true");
      setState((prev) => {
        console.log(
          "[AuthContext] Previous hasCompletedProfileSetup:",
          prev.hasCompletedProfileSetup,
        );
        return {
          ...prev,
          hasCompletedProfileSetup: true,
          ...(userData?.name && { name: userData.name }),
          ...(userData?.profilePicture && {
            profilePicture: userData.profilePicture,
          }),
        };
      });
      console.log("[AuthContext] Profile setup marked as complete");
    },
    [],
  );

  return (
    <AuthContext.Provider
      value={{
        ...state,
        googleLogin,
        logout,
        completeOnboarding,
        completeProfileSetup,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
