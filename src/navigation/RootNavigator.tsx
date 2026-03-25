import React, { useCallback, useRef } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer, Theme } from '@react-navigation/native';
import { trackScreen } from '../lib/analytics';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';
import { ProfileSetupScreen } from '../screens/profile/ProfileSetupScreen';
import { ProfileDetailScreen } from '../screens/home/ProfileDetailScreen';
import { MatchScreen } from '../screens/home/MatchScreen';
import { ChatScreen } from '../screens/chat/ChatScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { BlockedUsersScreen } from '../screens/settings/BlockedUsersScreen';
import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { RootStackParamList } from './types';
import { useAuth, useMatches } from '../context';
import { colors } from '../theme';
import { MatchToast } from '../components/MatchToast';
import { navigationRef } from '../utils/navigationRef';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme: Theme = {
  dark: true,
  colors: {
    primary: colors.primary,
    background: colors.background,
    card: colors.card,
    text: colors.text,
    border: colors.border,
    notification: colors.primary,
  },
  fonts: {
    regular: {
      fontFamily: 'System',
      fontWeight: '400',
    },
    medium: {
      fontFamily: 'System',
      fontWeight: '500',
    },
    bold: {
      fontFamily: 'System',
      fontWeight: '700',
    },
    heavy: {
      fontFamily: 'System',
      fontWeight: '900',
    },
  },
};

export const RootNavigator: React.FC = () => {
  const { isAuthenticated, hasCompletedOnboarding, hasCompletedProfileSetup } = useAuth();
  const { matchToast, dismissMatchToast } = useMatches();
  const routeNameRef = useRef<string | undefined>(undefined);

  const handleToastPress = useCallback(() => {
    if (matchToast && navigationRef.isReady()) {
      dismissMatchToast();
      navigationRef.navigate('ChatScreen', {
        matchId: matchToast.matchId,
        conversationId: matchToast.conversationId,
        profile: matchToast.profile,
      });
    }
  }, [matchToast, dismissMatchToast]);

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      onReady={() => {
        routeNameRef.current = navigationRef.getCurrentRoute()?.name;
      }}
      onStateChange={() => {
        const previousRouteName = routeNameRef.current;
        const currentRouteName = navigationRef.getCurrentRoute()?.name;
        if (currentRouteName && previousRouteName !== currentRouteName) {
          trackScreen(currentRouteName);
        }
        routeNameRef.current = currentRouteName;
      }}
    >
      <MatchToast
        visible={!!matchToast}
        matchData={matchToast}
        onDismiss={dismissMatchToast}
        onPress={handleToastPress}
      />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {!hasCompletedOnboarding ? (
          /* Onboarding */
          <Stack.Screen
            name="Onboarding"
            component={OnboardingScreen}
            options={{ animation: 'fade' }}
          />
        ) : !isAuthenticated ? (
          /* Auth Flow */
          <Stack.Screen
            name="Auth"
            component={AuthNavigator}
            options={{ animation: 'fade' }}
          />
        ) : !hasCompletedProfileSetup ? (
          /* Profile Setup */
          <Stack.Screen
            name="ProfileSetup"
            component={ProfileSetupScreen}
            options={{ animation: 'slide_from_right' }}
          />
        ) : (
          <>
            {/* Main App */}
            <Stack.Screen
              name="MainTabs"
              component={MainTabNavigator}
              options={{ animation: 'fade' }}
            />

            {/* Modal Screens */}
            <Stack.Screen
              name="MatchScreen"
              component={MatchScreen}
              options={{
                animation: 'fade',
                presentation: 'fullScreenModal',
              }}
            />

            <Stack.Screen
              name="ProfileDetail"
              component={ProfileDetailScreen}
              options={{
                animation: 'slide_from_bottom',
                presentation: 'modal',
              }}
            />

            <Stack.Screen
              name="ChatScreen"
              component={ChatScreen}
              options={{
                animation: 'slide_from_right',
              }}
            />

            <Stack.Screen
              name="EditProfile"
              component={EditProfileScreen}
              options={{
                animation: 'slide_from_bottom',
                presentation: 'modal',
              }}
            />

            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{
                animation: 'slide_from_right',
              }}
            />

            <Stack.Screen
              name="BlockedUsers"
              component={BlockedUsersScreen}
              options={{
                animation: 'slide_from_right',
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
