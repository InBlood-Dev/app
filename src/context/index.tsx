import React, { ReactNode, useEffect } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { UserProvider } from './UserContext';
import { MatchesProvider } from './MatchesContext';
import { ChatProvider } from './ChatContext';
import { StoriesProvider } from './StoriesContext';
import { LocationProvider } from './LocationContext';
import { ExploreProvider } from './ExploreContext';
import { setAuthToken, setOnUnauthorized } from '../services/api';

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Inner component to sync auth token with API client
 */
const ApiTokenSync: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { accessToken, logout } = useAuth();

  useEffect(() => {
    // Set the auth token for API requests
    setAuthToken(accessToken);
    console.log('[ApiTokenSync] Token updated:', accessToken ? 'present' : 'null');
  }, [accessToken]);

  useEffect(() => {
    // Set the unauthorized callback to logout
    setOnUnauthorized(() => {
      console.log('[ApiTokenSync] Unauthorized - logging out');
      logout();
    });
  }, [logout]);

  return <>{children}</>;
};

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <AuthProvider>
      <ApiTokenSync>
        <UserProvider>
          <StoriesProvider>
            <LocationProvider>
              <ExploreProvider>
                <MatchesProvider>
                  <ChatProvider>
                    {children}
                  </ChatProvider>
                </MatchesProvider>
              </ExploreProvider>
            </LocationProvider>
          </StoriesProvider>
        </UserProvider>
      </ApiTokenSync>
    </AuthProvider>
  );
};

export { useAuth } from './AuthContext';
export { useUser, type RelationshipTypeId } from './UserContext';
export { useMatches } from './MatchesContext';
export { useChat } from './ChatContext';
export { useStories } from './StoriesContext';
export { useLocation } from './LocationContext';
export { useExplore } from './ExploreContext';
