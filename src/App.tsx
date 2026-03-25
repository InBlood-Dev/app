import React, { useState, useCallback, useEffect, useRef } from 'react';
import { StyleSheet, StatusBar, LogBox, Platform, AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreenExpo from 'expo-splash-screen';
import Constants from 'expo-constants';
import {
  useFonts,
  Geist_100Thin,
  Geist_200ExtraLight,
  Geist_300Light,
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
  Geist_800ExtraBold,
  Geist_900Black,
} from '@expo-google-fonts/geist';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { AppProviders, useAuth, useUser, useMatches } from './context';
import { RootNavigator } from './navigation';
import { SplashScreen } from './screens/splash';
import { ForceUpdateScreen } from './screens/ForceUpdateScreen';
import { MaintenanceScreen } from './screens/MaintenanceScreen';
import { API_BASE_URL } from './config/api.config';
import { colors } from './theme';
import { initAnalytics } from './lib/analytics';

// Keep the splash screen visible while we fetch resources
SplashScreenExpo.preventAutoHideAsync();

// Fire-and-forget: wake up the backend on cold start
fetch('https://backend-cfh1.onrender.com/health').catch(() => {});

// Initialize analytics (PostHog + Clarity)
initAnalytics().catch(() => {});

// Ignore specific warnings in development
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
]);

/**
 * PreloadGate: Coordinates splash screen dismissal with data loading.
 * Shows splash until both minimum animation time AND critical data are ready.
 * For unauthenticated/incomplete-profile users, only waits for animation.
 */
/** Check if the app needs a force update or is in maintenance mode */
const checkAppStatus = async (): Promise<{ forceUpdate: boolean; updateUrl: string; maintenance: boolean }> => {
  try {
    const currentVersion = Constants.expoConfig?.version || '0.0.0';
    const platform = Platform.OS; // 'ios' or 'android'
    const url = `${API_BASE_URL}/app/version-check?platform=${platform}&current_version=${currentVersion}`;

    console.log('[AppStatus] Checking:', url);
    const response = await fetch(url);
    const json = await response.json();
    console.log('[AppStatus] Response:', JSON.stringify(json.data));

    return {
      forceUpdate: !!(json.success && json.data?.force_update),
      updateUrl: json.data?.update_url || '',
      maintenance: !!(json.success && json.data?.maintenance_mode),
    };
  } catch (error) {
    // If backend is down, don't block users
    console.log('[AppStatus] Failed (skipping):', error);
    return { forceUpdate: false, updateUrl: '', maintenance: false };
  }
};

const PreloadGate: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading, hasCompletedProfileSetup } = useAuth();
  const { user } = useUser();
  const { fetchMatches, fetchRecommendedUsers, fetchPendingLikes } = useMatches();

  const [showSplash, setShowSplash] = useState(true);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(false);
  const [updateUrl, setUpdateUrl] = useState('');
  const [maintenance, setMaintenance] = useState(false);
  const prefetchStarted = useRef(false);

  // Check version + maintenance on mount
  useEffect(() => {
    checkAppStatus().then((status) => {
      if (status.forceUpdate) {
        setForceUpdate(true);
        setUpdateUrl(status.updateUrl);
      }
      if (status.maintenance) {
        setMaintenance(true);
      }
    });
  }, []);

  // Re-check when app returns to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && (forceUpdate || maintenance)) {
        checkAppStatus().then((status) => {
          setForceUpdate(status.forceUpdate);
          setUpdateUrl(status.forceUpdate ? status.updateUrl : '');
          setMaintenance(status.maintenance);
        });
      }
    });
    return () => subscription.remove();
  }, [forceUpdate, maintenance]);

  // Minimum splash duration (2.2s for animation to complete)
  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), 2200);
    return () => clearTimeout(timer);
  }, []);

  // Safety timeout: dismiss splash after 8s no matter what (slow network fallback)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!dataReady) {
        console.log('[PreloadGate] Safety timeout - dismissing splash');
        setDataReady(true);
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, [dataReady]);

  // Pre-fetch data when auth restoration completes
  useEffect(() => {
    if (authLoading || prefetchStarted.current) return;
    prefetchStarted.current = true;

    if (!isAuthenticated || !hasCompletedProfileSetup) {
      // Not authenticated or incomplete profile - no data to prefetch
      console.log('[PreloadGate] No prefetch needed (unauth or incomplete profile)');
      setDataReady(true);
      return;
    }

    // Authenticated user with complete profile - prefetch everything in parallel
    // UserContext already auto-fetches profile, we just need matches + discovery
    console.log('[PreloadGate] Starting data prefetch...');
    Promise.allSettled([
      fetchMatches(),
      fetchRecommendedUsers(30),
      fetchPendingLikes(),
    ]).then(() => {
      console.log('[PreloadGate] Prefetch complete');
      setDataReady(true);
    });
  }, [authLoading, isAuthenticated, hasCompletedProfileSetup, fetchMatches, fetchRecommendedUsers, fetchPendingLikes]);

  // Profile is ready when: not needed (unauth/incomplete) OR user object is loaded
  const profileReady = !isAuthenticated || !hasCompletedProfileSetup || !!user;

  // Can dismiss when all conditions met
  const canDismiss = minTimeElapsed && dataReady && profileReady;

  if (showSplash) {
    return (
      <SplashScreen
        shouldDismiss={canDismiss}
        onFinish={() => setShowSplash(false)}
      />
    );
  }

  if (forceUpdate) {
    return <ForceUpdateScreen updateUrl={updateUrl} />;
  }

  if (maintenance) {
    return <MaintenanceScreen />;
  }

  return <RootNavigator />;
};

export default function App() {
  const [fontsLoaded] = useFonts({
    Geist_100Thin,
    Geist_200ExtraLight,
    Geist_300Light,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    Geist_800ExtraBold,
    Geist_900Black,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreenExpo.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    if (fontsLoaded) {
      onLayoutRootView();
    }
  }, [fontsLoaded, onLayoutRootView]);

  if (!fontsLoaded) {
    return null;
  }

  // AppProviders mount immediately so auth restoration + data fetching
  // starts during splash animation, not after it
  return (
    <GestureHandlerRootView style={styles.container}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <StatusBar barStyle="light-content" backgroundColor={colors.background} />
          <AppProviders>
            <PreloadGate />
          </AppProviders>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
