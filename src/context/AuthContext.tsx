import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { GOOGLE_USERINFO_ENDPOINT } from '../config/oauth';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  hasCompletedOnboarding: boolean;
  hasCompletedProfileSetup: boolean;
  email: string | null;
  name: string | null;
  profilePicture: string | null;
  googleUserId: string | null;
}

interface AuthContextType extends AuthState {
  googleLogin: (accessToken: string) => Promise<boolean>;
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
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>(initialState);

  const googleLogin = useCallback(async (accessToken: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Fetch user info from Google
      const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user info from Google');
      }

      const userInfo = await response.json();

      console.log('[AuthContext] Google user info:', userInfo);

      // TODO: Send to your backend API to create/login user
      // const backendResponse = await fetch('YOUR_API/auth/google', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     accessToken,
      //     email: userInfo.email,
      //     name: userInfo.name,
      //     picture: userInfo.picture,
      //     googleUserId: userInfo.id,
      //   }),
      // });
      // const backendData = await backendResponse.json();

      // For now, mock authentication success
      setState(prev => ({
        ...prev,
        isAuthenticated: true,
        isLoading: false,
        email: userInfo.email,
        name: userInfo.name,
        profilePicture: userInfo.picture,
        googleUserId: userInfo.id,
        hasCompletedOnboarding: true,
      }));

      return true;
    } catch (error) {
      console.error('[AuthContext] Google login error:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    setState(initialState);
  }, []);

  const completeOnboarding = useCallback(() => {
    setState(prev => ({ ...prev, hasCompletedOnboarding: true }));
  }, []);

  const completeProfileSetup = useCallback(() => {
    setState(prev => ({ ...prev, hasCompletedProfileSetup: true }));
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
