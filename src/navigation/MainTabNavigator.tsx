import React, { createContext, useContext, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { FeedScreen } from '../screens/home/FeedScreen';
import { GalleryDiscoverScreen } from '../screens/home/GalleryDiscoverScreen';
import { DiscoverScreen } from '../screens/home/DiscoverScreen';
import { MatchesListScreen } from '../screens/chat/MatchesListScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { MainTabsParamList } from './types';
import { colors, fontSize, spacing, borderRadius } from '../theme';
import { useMatches } from '../context';

const Tab = createBottomTabNavigator<MainTabsParamList>();

// Context for tab bar theme
interface TabBarThemeContextType {
  isDark: boolean;
  setIsDark: (dark: boolean) => void;
}

const TabBarThemeContext = createContext<TabBarThemeContextType>({
  isDark: false,
  setIsDark: () => {},
});

export const useTabBarTheme = () => useContext(TabBarThemeContext);

interface TabIconProps {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  badge?: number;
  isDarkTheme?: boolean;
}

const TabIcon: React.FC<TabIconProps> = ({ name, focused, badge, isDarkTheme = false }) => {
  const scale = useSharedValue(focused ? 1 : 0.9);
  const backgroundColor = useSharedValue(focused ? 'rgba(229, 57, 53, 0.15)' : 'transparent');

  React.useEffect(() => {
    scale.value = withSpring(focused ? 1.1 : 1, { damping: 15, stiffness: 200 });
    backgroundColor.value = withTiming(focused ? 'rgba(229, 57, 53, 0.15)' : 'transparent', { duration: 200 });
  }, [focused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: backgroundColor.value,
  }));

  const iconColor = focused
    ? colors.primary
    : isDarkTheme
      ? 'rgba(255, 255, 255, 0.6)'
      : colors.textMuted;

  return (
    <Animated.View style={[styles.tabIconContainer, animatedStyle]}>
      <Ionicons
        name={focused ? name : `${name}-outline` as any}
        size={24}
        color={iconColor}
      />
      {badge !== undefined && badge > 0 && (
        <View style={styles.badge}>
          <Animated.Text style={styles.badgeText}>
            {badge > 99 ? '99+' : badge}
          </Animated.Text>
        </View>
      )}
    </Animated.View>
  );
};


// Center Swipe Button Component - navigates to swipe screen
const CenterTabIcon: React.FC<{ focused: boolean }> = ({ focused }) => {
  const scale = useSharedValue(1);

  React.useEffect(() => {
    scale.value = withSpring(focused ? 1.1 : 1, { damping: 15 });
  }, [focused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.centerButtonContainer}>
      <Animated.View style={[styles.centerButton, focused && styles.centerButtonActive, animatedStyle]}>
        <Ionicons name="heart" size={26} color={colors.text} />
      </Animated.View>
    </View>
  );
};

export const MainTabNavigator: React.FC = () => {
  const { matches } = useMatches();
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const insets = useSafeAreaInsets();

  // Count unread matches
  const unreadCount = matches.filter(m => m.unreadCount > 0).length;

  return (
    <TabBarThemeContext.Provider value={{ isDark: isDarkTheme, setIsDark: setIsDarkTheme }}>
      <Tab.Navigator
        initialRouteName="Discover"
        screenOptions={{
          headerShown: false,
          tabBarStyle: [
            styles.tabBar,
            isDarkTheme ? styles.tabBarDark : styles.tabBarLight,
            { bottom: 20 },
          ],
          tabBarShowLabel: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: isDarkTheme ? 'rgba(255, 255, 255, 0.6)' : colors.textMuted,
        }}
      >
        <Tab.Screen
          name="Feed"
          component={FeedScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon name="home" focused={focused} isDarkTheme={isDarkTheme} />
            ),
          }}
          listeners={{
            tabPress: () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            },
            focus: () => {
              setIsDarkTheme(false);
            },
          }}
        />
        <Tab.Screen
          name="Discover"
          component={GalleryDiscoverScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon name="compass" focused={focused} isDarkTheme={isDarkTheme} />
            ),
          }}
          listeners={{
            tabPress: () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            },
            focus: () => {
              setIsDarkTheme(true);
            },
          }}
        />
        <Tab.Screen
          name="Add"
          component={DiscoverScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <CenterTabIcon focused={focused} />
            ),
          }}
          listeners={{
            tabPress: () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            },
            focus: () => {
              setIsDarkTheme(false);
            },
          }}
        />
        <Tab.Screen
          name="Matches"
          component={MatchesListScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon name="chatbubbles" focused={focused} badge={unreadCount} isDarkTheme={isDarkTheme} />
            ),
          }}
          listeners={{
            tabPress: () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            },
            focus: () => {
              setIsDarkTheme(false);
            },
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon name="person" focused={focused} isDarkTheme={isDarkTheme} />
            ),
          }}
          listeners={{
            tabPress: () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            },
            focus: () => {
              setIsDarkTheme(false);
            },
          }}
        />
      </Tab.Navigator>
    </TabBarThemeContext.Provider>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 10,
    right: 0,
    height: 70,
    borderRadius: 38,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 15,
    borderWidth: 0,
  },
  tabBarLight: {
    backgroundColor: '#FFFFFF',
  },
  tabBarDark: {
    backgroundColor: '#000000',
  },
  tabBarLabel: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    marginTop: spacing.xs,
  },
  tabIconContainer: {
    width: 40,
    height: 32,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
  },
  centerButtonContainer: {
    position: 'absolute',
    top: -20,
  },
  centerButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  centerButtonActive: {
    backgroundColor: colors.primaryDark,
  },
});
