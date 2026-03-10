/**
 * Story preview modal
 * Shows image preview with caption input before uploading
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';

interface StoryPreviewModalProps {
  visible: boolean;
  imageUri: string;
  onShare: (caption: string) => void;
  onClose: () => void;
  isUploading: boolean;
}

const MAX_CAPTION_LENGTH = 200;

export const StoryPreviewModal: React.FC<StoryPreviewModalProps> = ({
  visible,
  imageUri,
  onShare,
  onClose,
  isUploading,
}) => {
  const [caption, setCaption] = useState('');

  const handleShare = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onShare(caption.trim());
  };

  const handleClose = () => {
    if (isUploading) return; // Prevent closing while uploading
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCaption(''); // Reset caption
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Story Image Preview */}
        <Image
          source={{ uri: imageUri }}
          style={styles.image}
          resizeMode="cover"
        />

        {/* Top gradient with header */}
        <LinearGradient
          colors={['rgba(0,0,0,0.6)', 'transparent']}
          style={styles.topGradient}
        >
          <SafeAreaView edges={['top']} style={styles.topContent}>
            {/* Close Button */}
            <Pressable
              style={styles.closeButton}
              onPress={handleClose}
              disabled={isUploading}
            >
              <Ionicons name="close" size={28} color={colors.text} />
            </Pressable>
          </SafeAreaView>
        </LinearGradient>

        {/* Bottom gradient with caption and share button */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.bottomGradient}
        >
          <SafeAreaView edges={['bottom']} style={styles.bottomContent}>
            {/* Caption Input */}
            <View style={styles.captionContainer}>
              <TextInput
                style={styles.captionInput}
                placeholder="Add a caption... (optional)"
                placeholderTextColor={colors.textMuted}
                value={caption}
                onChangeText={setCaption}
                maxLength={MAX_CAPTION_LENGTH}
                multiline
                editable={!isUploading}
              />
              <Text style={styles.captionCounter}>
                {caption.length}/{MAX_CAPTION_LENGTH}
              </Text>
            </View>

            {/* Share Button */}
            <Pressable
              style={[styles.shareButton, isUploading && styles.shareButtonDisabled]}
              onPress={handleShare}
              disabled={isUploading}
            >
              <LinearGradient
                colors={isUploading
                  ? ['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']
                  : [colors.primary, colors.primary]
                }
                style={styles.shareButtonGradient}
              >
                {isUploading ? (
                  <>
                    <ActivityIndicator color={colors.text} size="small" />
                    <Text style={styles.shareButtonText}>Uploading...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="send" size={20} color={colors.text} />
                    <Text style={styles.shareButtonText}>Share Story</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </SafeAreaView>
        </LinearGradient>

        {/* Loading Overlay */}
        {isUploading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Sharing your story...</Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  topContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 100,
  },
  bottomContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.lg,
  },
  captionContainer: {
    backgroundColor: 'rgba(21, 21, 21, 0.8)',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: spacing.md,
  },
  captionInput: {
    fontSize: fontSize.md,
    color: colors.text,
    minHeight: 60,
    maxHeight: 120,
    textAlignVertical: 'top',
  },
  captionCounter: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  shareButton: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  shareButtonDisabled: {
    opacity: 0.6,
  },
  shareButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  shareButtonText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: fontWeight.medium,
  },
});

export default StoryPreviewModal;
