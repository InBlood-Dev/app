/**
 * Permission request modal
 * Explains why permission is needed and provides settings navigation
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Linking,
  Platform,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';

interface PermissionModalProps {
  visible: boolean;
  type: 'camera' | 'gallery';
  onClose: () => void;
}

export const PermissionModal: React.FC<PermissionModalProps> = ({
  visible,
  type,
  onClose,
}) => {
  const handleOpenSettings = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL('app-settings:');
      } else {
        await Linking.openSettings();
      }
    } catch (error) {
      console.error('[PermissionModal] Error opening settings:', error);
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const getContent = () => {
    switch (type) {
      case 'camera':
        return {
          icon: 'camera' as const,
          title: 'Camera Access Required',
          message: 'To share stories with your matches, we need access to your camera. You can change this in your device settings.',
        };
      case 'gallery':
        return {
          icon: 'images' as const,
          title: 'Photo Library Access Required',
          message: 'To share stories with your matches, we need access to your photo library. You can change this in your device settings.',
        };
      default:
        return {
          icon: 'alert-circle' as const,
          title: 'Permission Required',
          message: 'This feature requires permission to continue.',
        };
    }
  };

  const content = getContent();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
        />

        {/* Permission Card */}
        <Animated.View entering={FadeIn.duration(200)} style={styles.card}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Ionicons name={content.icon} size={48} color={colors.primary} />
          </View>

          {/* Title */}
          <Text style={styles.title}>{content.title}</Text>

          {/* Message */}
          <Text style={styles.message}>{content.message}</Text>

          {/* Buttons */}
          <View style={styles.buttons}>
            {/* Cancel Button */}
            <Pressable
              style={styles.cancelButton}
              onPress={handleClose}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>

            {/* Open Settings Button */}
            <Pressable
              style={styles.settingsButton}
              onPress={handleOpenSettings}
            >
              <Text style={styles.settingsText}>Open Settings</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: 'rgba(21, 21, 21, 0.95)',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: spacing.xl,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semiBold,
    color: colors.text,
  },
  settingsButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  settingsText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
});

export default PermissionModal;
