import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// TODO: Move to environment config
const API_BASE_URL = 'http://192.168.29.105:5000/api/v1'; // Local network IP

interface GoogleAuthData {
  user: {
    id: string;
    email: string | null;
    name: string | null;
    photo: string | null;
  };
  accessToken: string;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  hasCompletedOnboarding: boolean;
  hasCompletedProfileSetup: boolean;
  email: string | null;
  name: string | null;
  profilePicture: string | null;
  googleUserId: string | null;
  accessToken: string | null;
}

interface AuthContextType extends AuthState {
  googleLogin: (authData: GoogleAuthData) => Promise<boolean>;
  logout: () => void;
  completeOnboarding: () => void;
  completeProfileSetup: () => void;
}

const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: false,
  hasCompletedOnboarding: false,
  hasCompletedProfileSetup: false,
  email: null,
  name: null,
  profilePicture: null,
  googleUserId: null,
  accessToken: null,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>(initialState);

  const googleLogin = useCallback(async (authData: GoogleAuthData): Promise<boolean> => {
    console.log('[AuthContext] googleLogin called');
    console.log('[AuthContext] Auth data received:');
    console.log('[AuthContext]   - User ID:', authData.user.id);
    console.log('[AuthContext]   - User Email:', authData.user.email);
    console.log('[AuthContext]   - User Name:', authData.user.name);
    console.log('[AuthContext]   - Access Token length:', authData.accessToken.length);

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const endpoint = '/auth/google/mobile';
      const fullUrl = `${API_BASE_URL}${endpoint}`;
      const requestBody = {
        access_token: authData.accessToken,
      };

      console.log('='.repeat(60));
      console.log('[AuthContext] Backend API Call');
      console.log('='.repeat(60));
      console.log('[AuthContext] Base URL:', API_BASE_URL);
      console.log('[AuthContext] Endpoint:', endpoint);
      console.log('[AuthContext] Full URL:', fullUrl);
      console.log('[AuthContext] Method: POST');
      console.log('[AuthContext] Request Body:', JSON.stringify(requestBody, null, 2));
      console.log('-'.repeat(60));

      // Send access token to backend for verification
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      console.log('[AuthContext] Response Status:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.log('[AuthContext] Response Body (Error):', JSON.stringify(errorData, null, 2));
        console.log('='.repeat(60));
        setState(prev => ({ ...prev, isLoading: false }));
        return false;
      }

      const backendData = await response.json();
      console.log('[AuthContext] Response Body (Success):', JSON.stringify(backendData, null, 2));

      // Extract user data and tokens from response
      // Backend returns: { success, message, data: { user, accessToken, refreshToken } }
      const userData = backendData.data?.user || backendData.user;
      const jwtAccessToken = backendData.data?.accessToken || null;

      console.log('[AuthContext] Extracted data:');
      console.log('[AuthContext]   - userData:', userData ? 'found' : 'missing');
      console.log('[AuthContext]   - jwtAccessToken:', jwtAccessToken ? `found (length: ${jwtAccessToken.length})` : 'missing');

      // Check if user has completed profile setup
      // Backend should return profile_complete or check if profile fields exist
      const hasProfile = userData?.profile_complete === true ||
        (userData?.gender && userData?.bio && userData?.interests?.length > 0);

      console.log('[AuthContext] Profile data check:');
      console.log('[AuthContext]   - profile_complete flag:', userData?.profile_complete);
      console.log('[AuthContext]   - gender:', userData?.gender);
      console.log('[AuthContext]   - bio:', userData?.bio ? 'exists' : 'missing');
      console.log('[AuthContext]   - interests:', userData?.interests?.length || 0);
      console.log('[AuthContext]   - hasProfile (calculated):', hasProfile);
      console.log('='.repeat(60));

      // Update state with user data from backend or Google
      const newState = {
        isAuthenticated: true,
        isLoading: false,
        email: userData?.email || authData.user.email,
        name: userData?.name || authData.user.name,
        profilePicture: userData?.picture || authData.user.photo,
        googleUserId: authData.user.id,
        hasCompletedOnboarding: true,
        hasCompletedProfileSetup: hasProfile,
        accessToken: jwtAccessToken,
      };

      console.log('[AuthContext] Setting new state:');
      console.log('[AuthContext]   - isAuthenticated:', newState.isAuthenticated);
      console.log('[AuthContext]   - hasCompletedOnboarding:', newState.hasCompletedOnboarding);
      console.log('[AuthContext]   - hasCompletedProfileSetup:', newState.hasCompletedProfileSetup);
      console.log('[AuthContext]   - email:', newState.email);
      console.log('[AuthContext]   - accessToken:', newState.accessToken ? 'stored' : 'missing');

      setState(prev => ({
        ...prev,
        ...newState,
      }));

      // TODO: Persist JWT token to AsyncStorage for app restarts
      // await AsyncStorage.setItem('accessToken', jwtAccessToken);

      return true;
    } catch (error) {
      console.error('[AuthContext] Google login error:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    console.log('[AuthContext] logout called');
    console.log('[AuthContext] Resetting state to initial values');
    console.log('[AuthContext] Initial state:', JSON.stringify(initialState, null, 2));
    setState(initialState);
    console.log('[AuthContext] State reset complete');
  }, []);

  const completeOnboarding = useCallback(() => {
    setState(prev => ({ ...prev, hasCompletedOnboarding: true }));
  }, []);

  const completeProfileSetup = useCallback(() => {
    console.log('[AuthContext] completeProfileSetup called');
    console.log('[AuthContext] Setting hasCompletedProfileSetup to true');
    setState(prev => {
      console.log('[AuthContext] Previous hasCompletedProfileSetup:', prev.hasCompletedProfileSetup);
      return { ...prev, hasCompletedProfileSetup: true };
    });
    console.log('[AuthContext] Profile setup marked as complete');
  }, []);

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
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
