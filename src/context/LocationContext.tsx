import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import * as Location from 'expo-location';
import {
  getNearbyActiveUsers,
  getMapNearbyUsers,
  updateUserLocation,
} from '../services/location.service';
import type { NearbyActiveUser, MapUser } from '../types';
import { useAuth } from './AuthContext';

interface UserLocation {
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  country?: string;
}

interface LocationState {
  nearbyActiveUsers: NearbyActiveUser[];
  mapUsers: MapUser[];
  userLocation: UserLocation | null;
  hasPermission: boolean | null;
  isLoading: boolean;
  error: string | null;
}

interface LocationContextType extends LocationState {
  requestPermission: () => Promise<boolean>;
  fetchNearbyActive: (limit?: number) => Promise<void>;
  fetchMapUsers: (radius?: number) => Promise<void>;
  updateLocation: () => Promise<void>;
  clearError: () => void;
}

const initialState: LocationState = {
  nearbyActiveUsers: [],
  mapUsers: [],
  userLocation: null,
  hasPermission: null,
  isLoading: false,
  error: null,
};

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<LocationState>(initialState);
  const { accessToken, isAuthenticated } = useAuth();

  /**
   * Request location permission
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    console.log('[LocationContext] Requesting location permission');

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === 'granted';

      console.log('[LocationContext] Permission:', granted ? 'granted' : 'denied');

      setState(prev => ({ ...prev, hasPermission: granted }));

      if (granted) {
        // Get initial location
        console.log('[LocationContext] Getting current position');
        const location = await Location.getCurrentPositionAsync({});

        console.log('[LocationContext] Location obtained:', location.coords.latitude, location.coords.longitude);
        setState(prev => ({
          ...prev,
          userLocation: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          },
        }));

        // Automatically update backend with location coordinates
        console.log('[LocationContext] Updating backend with location');
        try {
          const response = await updateUserLocation(
            location.coords.latitude,
            location.coords.longitude
          );

          if (response.success) {
            console.log('[LocationContext] Backend location updated successfully');
            console.log('[LocationContext] Location data:', response.data);
            setState(prev => ({
              ...prev,
              userLocation: {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                city: response.data.location_city,
                state: response.data.location_state,
                country: response.data.location_country,
              },
            }));
          }
        } catch (updateError) {
          console.error('[LocationContext] Error updating backend location:', updateError);
          // Don't fail permission request if backend update fails
        }
      }

      return granted;
    } catch (error) {
      console.error('[LocationContext] Error requesting permission:', error);
      setState(prev => ({
        ...prev,
        hasPermission: false,
        error: 'Failed to get location permission',
      }));
      return false;
    }
  }, []);

  /**
   * Update user's location on the server
   */
  const updateLocation = useCallback(async () => {
    console.log('[LocationContext] Updating user location');

    try {
      const location = await Location.getCurrentPositionAsync({});

      const response = await updateUserLocation(
        location.coords.latitude,
        location.coords.longitude
      );

      if (response.success) {
        console.log('[LocationContext] Location updated:', response.data);
        setState(prev => ({
          ...prev,
          userLocation: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            city: response.data.location_city,
            state: response.data.location_state,
            country: response.data.location_country,
          },
        }));
      }
    } catch (error) {
      console.error('[LocationContext] Error updating location:', error);
    }
  }, []);

  /**
   * Fetch nearby active users for homepage widget
   */
  const fetchNearbyActive = useCallback(async (limit: number = 10) => {
    console.log('[LocationContext] Fetching nearby active users');
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await getNearbyActiveUsers(limit);

      if (response.success && response.data?.users) {
        console.log('[LocationContext] Nearby active users:', response.data.users.length);
        setState(prev => ({
          ...prev,
          nearbyActiveUsers: response.data.users,
          isLoading: false,
        }));
      } else if (response.success && !response.data?.users) {
        // API succeeded but no users data
        console.log('[LocationContext] No nearby users data in response');
        setState(prev => ({
          ...prev,
          nearbyActiveUsers: [],
          isLoading: false,
        }));
      } else {
        throw new Error(response.message || 'Failed to fetch nearby users');
      }
    } catch (error) {
      console.error('[LocationContext] Error fetching nearby active:', error);
      setState(prev => ({
        ...prev,
        nearbyActiveUsers: [],
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load nearby users',
      }));
    }
  }, []);

  /**
   * Fetch users for map view with coordinates
   */
  const fetchMapUsers = useCallback(async (radius: number = 25) => {
    console.log('[LocationContext] Fetching map users');

    if (!state.userLocation) {
      console.warn('[LocationContext] No user location available');
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await getMapNearbyUsers(
        state.userLocation.latitude,
        state.userLocation.longitude,
        radius
      );

      if (response.success && response.data?.users) {
        console.log('[LocationContext] Map users:', response.data.users.length);
        setState(prev => ({
          ...prev,
          mapUsers: response.data.users,
          isLoading: false,
        }));
      } else if (response.success && !response.data?.users) {
        // API succeeded but no users data
        console.log('[LocationContext] No map users data in response');
        setState(prev => ({
          ...prev,
          mapUsers: [],
          isLoading: false,
        }));
      } else {
        throw new Error(response.message || 'Failed to fetch map users');
      }
    } catch (error) {
      console.error('[LocationContext] Error fetching map users:', error);
      setState(prev => ({
        ...prev,
        mapUsers: [],
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load map users',
      }));
    }
  }, [state.userLocation]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // CRITICAL FIX: Track if permission check has already run to prevent duplicate initialization
  const hasInitializedRef = useRef(false);
  const hasUpdatedBackendRef = useRef(false);

  /**
   * CRITICAL FIX: Check permission status ONCE on mount
   * This prevents double initialization seen in logs (lines 2-6 and 134-150)
   */
  useEffect(() => {
    if (hasInitializedRef.current) {
      console.log('[LocationContext] Already initialized, skipping duplicate permission check');
      return;
    }

    hasInitializedRef.current = true;

    const checkPermission = async () => {
      console.log('[LocationContext] Checking permission on mount (ONCE)');
      const { status } = await Location.getForegroundPermissionsAsync();
      const granted = status === 'granted';
      console.log('[LocationContext] Permission status:', granted ? 'granted' : 'not granted');
      setState(prev => ({ ...prev, hasPermission: granted }));

      if (granted) {
        try {
          console.log('[LocationContext] Getting current position on mount');
          const location = await Location.getCurrentPositionAsync({});
          console.log('[LocationContext] Position obtained:', location.coords.latitude, location.coords.longitude);

          setState(prev => ({
            ...prev,
            userLocation: {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            },
          }));
        } catch (error) {
          console.error('[LocationContext] Error getting initial location:', error);
        }
      }
    };

    checkPermission();
  }, []); // CRITICAL FIX: Empty deps - only run once on mount

  /**
   * CRITICAL FIX: Separate effect to update backend when auth becomes available
   * This runs only once when both auth and location are ready
   */
  useEffect(() => {
    if (!isAuthenticated || !accessToken || !state.userLocation || hasUpdatedBackendRef.current) {
      return;
    }

    hasUpdatedBackendRef.current = true;

    const updateBackend = async () => {
      console.log('[LocationContext] User authenticated, updating backend with location (ONCE)');
      try {
        const response = await updateUserLocation(
          state.userLocation!.latitude,
          state.userLocation!.longitude
        );

        if (response.success) {
          console.log('[LocationContext] Backend location updated successfully');
          setState(prev => ({
            ...prev,
            userLocation: {
              latitude: prev.userLocation!.latitude,
              longitude: prev.userLocation!.longitude,
              city: response.data.location_city,
              state: response.data.location_state,
              country: response.data.location_country,
            },
          }));
        }
      } catch (updateError) {
        console.error('[LocationContext] Error updating backend:', updateError);
      }
    };

    updateBackend();
  }, [isAuthenticated, accessToken, state.userLocation]); // Runs when all three become available

  return (
    <LocationContext.Provider
      value={{
        ...state,
        requestPermission,
        fetchNearbyActive,
        fetchMapUsers,
        updateLocation,
        clearError,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = (): LocationContextType => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};
