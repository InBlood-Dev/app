/**
 * Image source selector bottom sheet
 * Allows user to choose between Camera and Gallery
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';

interface ImageSourceSelectorProps {
  visible: boolean;
  onSelectCamera: () => void;
  onSelectGallery: () => void;
  onCancel: () => void;
}

export const ImageSourceSelector: React.FC<ImageSourceSelectorProps> = ({
  visible,
  onSelectCamera,
  onSelectGallery,
  onCancel,
}) => {
  const handleCamera = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelectCamera();
  };

  const handleGallery = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelectGallery();
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        {/* Backdrop */}
        <Pressable
          style={styles.backdrop}
          onPress={handleCancel}
        />

        {/* Bottom Sheet */}
        <Animated.View
          entering={FadeInDown.duration(300).springify()}
          style={styles.container}
        >
          <LinearGradient
            colors={['#1a1a1a', '#0d0d0d']}
            style={styles.gradient}
          >
            <SafeAreaView edges={['bottom']}>
              {/* Handle */}
              <View style={styles.handle} />

              {/* Title */}
              <Text style={styles.title}>Add Story</Text>

              {/* Options */}
              <View style={styles.options}>
                {/* Camera Option */}
                <Pressable
                  style={styles.option}
                  onPress={handleCamera}
                >
                  <View style={styles.iconContainer}>
                    <Ionicons name="camera" size={24} color={colors.primary} />
                  </View>
                  <Text style={styles.optionText}>Camera</Text>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </Pressable>

                {/* Gallery Option */}
                <Pressable
                  style={styles.option}
                  onPress={handleGallery}
                >
                  <View style={styles.iconContainer}>
                    <Ionicons name="images" size={24} color={colors.primary} />
                  </View>
                  <Text style={styles.optionText}>Gallery</Text>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>

              {/* Cancel Button */}
              <Pressable
                style={styles.cancelButton}
                onPress={handleCancel}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </SafeAreaView>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  gradient: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  options: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    gap: spacing.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(229, 57, 53, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semiBold,
    color: colors.text,
  },
  cancelButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cancelText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semiBold,
    color: colors.primary,
  },
});

export default ImageSourceSelector;
