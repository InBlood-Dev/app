import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  Share,
  ActivityIndicator,
} from 'react-native';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { useAuth, useUser } from '../../context';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';
import { updatePrivacySettings } from '../../services/settings.service';
import { SafetyModal } from '../../components/modals/SafetyModal';
import { TermsModal } from '../../components/modals/TermsModal';
import { RootStackParamList } from '../../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SettingItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  danger?: boolean;
}

const SettingItem: React.FC<SettingItemProps> = ({
  icon,
  title,
  subtitle,
  onPress,
  rightElement,
  danger,
}) => (
  <Pressable style={styles.settingItem} onPress={onPress}>
    <View style={[styles.settingIcon, danger && styles.settingIconDanger]}>
      <Ionicons name={icon} size={22} color={danger ? colors.error : colors.primary} />
    </View>
    <View style={styles.settingContent}>
      <Text style={[styles.settingTitle, danger && styles.settingTitleDanger]}>
        {title}
      </Text>
      {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
    </View>
    {rightElement || (
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    )}
  </Pressable>
);

// Show Distance has 3 states: exact → approximate → hide → exact
const DISTANCE_OPTIONS = ['exact', 'approximate', 'hide'] as const;
type DistanceOption = typeof DISTANCE_OPTIONS[number];
const DISTANCE_LABELS: Record<DistanceOption, string> = {
  exact: 'Exact distance',
  approximate: 'Approximate',
  hide: 'Hidden',
};

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { logout } = useAuth();
  const { user, clearUser, refreshProfile } = useUser();

  // Privacy settings - initialized from user profile
  const [isDiscoverable, setIsDiscoverable] = useState(user?.settings?.isDiscoverable ?? true);
  const [showDistance, setShowDistance] = useState<DistanceOption>(user?.settings?.showDistance ?? 'exact');
  const [savingSettings, setSavingSettings] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Sync local state when user profile loads/updates
  useEffect(() => {
    if (user?.settings) {
      setIsDiscoverable(user.settings.isDiscoverable);
      setShowDistance(user.settings.showDistance);
    }
  }, [user?.settings]);

  const saveSettings = useCallback(async (
    updates: { is_discoverable?: boolean; show_distance?: DistanceOption }
  ) => {
    setSavingSettings(true);
    try {
      const response = await updatePrivacySettings(updates);
      if (response.success) {
        // Refresh profile to sync state
        await refreshProfile();
      } else {
        throw new Error(response.message || 'Failed to update settings');
      }
    } catch (error: any) {
      console.error('[Settings] Error saving:', error.message);
      Alert.alert('Error', 'Failed to save settings. Please try again.');
      // Revert local state
      if (user?.settings) {
        setIsDiscoverable(user.settings.isDiscoverable);
        setShowDistance(user.settings.showDistance);
      }
    } finally {
      setSavingSettings(false);
    }
  }, [refreshProfile, user?.settings]);

  const handleToggleDiscoverable = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newValue = !isDiscoverable;
    setIsDiscoverable(newValue);
    saveSettings({ is_discoverable: newValue });
  }, [isDiscoverable, saveSettings]);

  const handleCycleDistance = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const currentIndex = DISTANCE_OPTIONS.indexOf(showDistance);
    const nextIndex = (currentIndex + 1) % DISTANCE_OPTIONS.length;
    const newValue = DISTANCE_OPTIONS[nextIndex];
    setShowDistance(newValue);
    saveSettings({ show_distance: newValue });
  }, [showDistance, saveSettings]);

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            clearUser();
            logout();
          },
        },
      ]
    );
  }, [logout, clearUser]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: 'Check out InBlood - Where Hearts Connect! Find your perfect match. Download now: https://play.google.com/store/apps/details?id=com.inblood.app',
      });
    } catch (error) {
      // User cancelled or share failed silently
    }
  }, []);

  // TODO: Uncomment when backend DELETE /users/me endpoint is implemented
  // const handleDeleteAccount = useCallback(() => {
  //   Alert.alert(
  //     'Delete Account',
  //     'Are you sure you want to delete your account? This action cannot be undone.',
  //     [
  //       { text: 'Cancel', style: 'cancel' },
  //       {
  //         text: 'Delete',
  //         style: 'destructive',
  //         onPress: () => {
  //           Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  //           clearUser();
  //           logout();
  //         },
  //       },
  //     ]
  //   );
  // }, [logout, clearUser]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <Animated.View entering={FadeInDown} style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={styles.backButton}>
            {savingSettings && <ActivityIndicator size="small" color={colors.primary} />}
          </View>
        </Animated.View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Account Section */}
          <Animated.View entering={FadeInUp.delay(100)} style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.sectionContent}>
              <SettingItem
                icon="person-outline"
                title="Edit Profile"
                subtitle="Update your photos and info"
                onPress={() => navigation.navigate('EditProfile')}
              />
              {/* TODO: Needs backend endpoint — no change email API exists
              <SettingItem
                icon="mail-outline"
                title="Email"
                subtitle="user@example.com"
                onPress={() => Alert.alert('Change Email', 'Email change feature coming soon!')}
              /> */}
              {/* TODO: Needs backend endpoint — no phone field in User model
              <SettingItem
                icon="call-outline"
                title="Phone Number"
                subtitle="+91 98765 43210"
                onPress={() => Alert.alert('Change Phone', 'Phone number change feature coming soon!')}
              /> */}
            </View>
          </Animated.View>

          {/* Privacy Section */}
          <Animated.View entering={FadeInUp.delay(200)} style={styles.section}>
            <Text style={styles.sectionTitle}>Privacy</Text>
            <View style={styles.sectionContent}>
              <SettingItem
                icon="eye-off-outline"
                title="Incognito Mode"
                subtitle={isDiscoverable ? 'Your profile is visible' : 'Your profile is hidden'}
                rightElement={
                  <Switch
                    value={!isDiscoverable}
                    onValueChange={handleToggleDiscoverable}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={colors.text}
                  />
                }
              />
              <SettingItem
                icon="location-outline"
                title="Show Distance"
                subtitle={DISTANCE_LABELS[showDistance]}
                onPress={handleCycleDistance}
                rightElement={
                  <View style={styles.distanceBadge}>
                    <Text style={styles.distanceBadgeText}>
                      {showDistance === 'exact' ? 'Exact' : showDistance === 'approximate' ? 'Approx' : 'Off'}
                    </Text>
                  </View>
                }
              />
              <SettingItem
                icon="ban-outline"
                title="Blocked Users"
                subtitle="Manage blocked accounts"
                onPress={() => navigation.navigate('BlockedUsers')}
              />
            </View>
          </Animated.View>

          {/* Notifications Section */}
          <Animated.View entering={FadeInUp.delay(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>Notifications</Text>
            <View style={styles.sectionContent}>
              <SettingItem
                icon="notifications-outline"
                title="Push Notifications"
                subtitle="Managed through device settings"
                onPress={() => Alert.alert(
                  'Push Notifications',
                  'To manage push notifications, go to your device Settings > Apps > InBlood > Notifications.'
                )}
              />
            </View>
          </Animated.View>

          {/* Help Section */}
          <Animated.View entering={FadeInUp.delay(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>Help & Support</Text>
            <View style={styles.sectionContent}>
              <SettingItem
                icon="help-circle-outline"
                title="Help Center"
                subtitle="Safety tips & contact support"
                onPress={() => setShowSafetyModal(true)}
              />
              <SettingItem
                icon="shield-checkmark-outline"
                title="Safety Tips"
                onPress={() => setShowSafetyModal(true)}
              />
              <SettingItem
                icon="document-text-outline"
                title="Terms & Privacy Policy"
                onPress={() => setShowTermsModal(true)}
              />
            </View>
          </Animated.View>

          {/* App Info Section */}
          <Animated.View entering={FadeInUp.delay(500)} style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <View style={styles.sectionContent}>
              <SettingItem
                icon="information-circle-outline"
                title="App Version"
                subtitle={Constants.expoConfig?.version || '1.0.0'}
              />
              <SettingItem
                icon="star-outline"
                title="Rate Us"
                subtitle="Love InBlood? Leave a review!"
                onPress={() => Alert.alert('Rate Us', 'Thank you for your support! Rating feature coming soon.')}
              />
              <SettingItem
                icon="share-social-outline"
                title="Share InBlood"
                subtitle="Invite friends to join"
                onPress={handleShare}
              />
            </View>
          </Animated.View>

          {/* Danger Zone */}
          <Animated.View entering={FadeIn.delay(600)} style={styles.section}>
            <Text style={styles.sectionTitle}>Account Actions</Text>
            <View style={styles.sectionContent}>
              <SettingItem
                icon="log-out-outline"
                title="Logout"
                onPress={handleLogout}
                danger
              />
              {/* TODO: Needs backend endpoint — no DELETE /users/me API exists
              <SettingItem
                icon="trash-outline"
                title="Delete Account"
                subtitle="Permanently delete your account"
                onPress={handleDeleteAccount}
                danger
              /> */}
            </View>
          </Animated.View>

          {/* Footer */}
          <Animated.View entering={FadeIn.delay(700)} style={styles.footer}>
            <Text style={styles.footerText}>Made with love by InBlood Team</Text>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      <SafetyModal visible={showSafetyModal} onClose={() => setShowSafetyModal(false)} />
      <TermsModal visible={showTermsModal} onClose={() => setShowTermsModal(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  section: {
    paddingTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionContent: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(229, 57, 53, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  settingIconDanger: {
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  settingTitleDanger: {
    color: colors.error,
  },
  settingSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  distanceBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(229, 57, 53, 0.15)',
  },
  distanceBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  footerText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
});
