/**
 * Story viewer modal
 * Full-screen story viewer with navigation and interactions
 * Extracted and enhanced from FeedScreen
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  Pressable,
  TextInput,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';

export interface DisplayStory {
  id: string;
  name: string;
  image: string;
  isMyStory: boolean;
  storyContent: string;
  age: number;
  bio: string;
  interests: string[];
  prompt: { question: string; answer: string };
  hasUnviewed?: boolean;
  viewCount?: number;
  storyUserData?: any;
}

interface StoryViewerModalProps {
  visible: boolean;
  story: DisplayStory | null;
  isOwnStory: boolean;
  onClose: () => void;
  onDelete?: () => void;
  onViewViewers?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onSendCompliment?: (text: string) => void;
  storyProgress?: number;
}

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  visible,
  story,
  isOwnStory,
  onClose,
  onDelete,
  onViewViewers,
  onNext,
  onPrevious,
  onSendCompliment,
  storyProgress = 0,
}) => {
  const [complimentText, setComplimentText] = useState('');

  // Reset compliment text when modal opens
  useEffect(() => {
    if (visible) {
      setComplimentText('');
    }
  }, [visible]);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const handleDelete = () => {
    if (onDelete) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onDelete();
    }
  };

  const handleViewViewers = () => {
    if (onViewViewers) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onViewViewers();
    }
  };

  const handleSendCompliment = () => {
    if (onSendCompliment && complimentText.trim()) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onSendCompliment(complimentText.trim());
      setComplimentText('');
    }
  };

  const handlePrevious = () => {
    if (onPrevious) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPrevious();
    }
  };

  const handleNext = () => {
    if (onNext) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onNext();
    }
  };

  if (!story) {
    return null;
  }

  const viewCount = story.viewCount || 0;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Full Screen Story Image */}
        <Image
          source={{ uri: story.storyContent || story.image }}
          style={styles.storyImage}
          resizeMode="cover"
        />

        {/* Tap zones for navigation */}
        <View style={styles.tapZonesContainer}>
          <Pressable
            style={styles.tapZoneLeft}
            onPress={handlePrevious}
          />
          <Pressable
            style={styles.tapZoneRight}
            onPress={handleNext}
          />
        </View>

        {/* Top gradient overlay with timer and header */}
        <LinearGradient
          colors={['rgba(0,0,0,0.6)', 'transparent']}
          style={styles.topGradient}
        >
          <SafeAreaView edges={['top']} style={styles.topOverlay}>
            {/* Progress bar */}
            <View style={styles.timerBar}>
              <View style={[styles.timerFill, { width: `${storyProgress}%` }]} />
            </View>

            {/* Story header */}
            <View style={styles.header}>
              <View style={styles.userInfo}>
                {story.image ? (
                  <Image
                    source={{ uri: story.image }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Ionicons name="person" size={20} color={colors.textSecondary} />
                  </View>
                )}
                <View>
                  <Text style={styles.username}>{story.name}</Text>
                  {story.age && (
                    <Text style={styles.age}>{story.age}</Text>
                  )}
                </View>
              </View>

              {/* Action buttons */}
              <View style={styles.headerActions}>
                {isOwnStory && onDelete && (
                  <Pressable
                    style={styles.actionButton}
                    onPress={handleDelete}
                  >
                    <Ionicons name="trash-outline" size={24} color={colors.primary} />
                  </Pressable>
                )}
                <Pressable
                  style={styles.actionButton}
                  onPress={handleClose}
                >
                  <Ionicons name="close" size={28} color={colors.text} />
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* Bottom section */}
        <SafeAreaView edges={['bottom']} style={styles.bottomContainer}>
          {isOwnStory ? (
            // Viewers button for own story
            onViewViewers && (
              <Pressable
                style={styles.viewersButton}
                onPress={handleViewViewers}
              >
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.05)']}
                  style={styles.viewersButtonGradient}
                >
                  <Ionicons name="eye" size={20} color={colors.text} />
                  <Text style={styles.viewersText}>
                    {viewCount} {viewCount === 1 ? 'view' : 'views'}
                  </Text>
                </LinearGradient>
              </Pressable>
            )
          ) : (
            // Compliment input for other's story
            <View style={styles.complimentInputContainer}>
              <TextInput
                style={styles.complimentInput}
                placeholder="Add compliment..."
                placeholderTextColor={colors.textMuted}
                value={complimentText}
                onChangeText={setComplimentText}
                maxLength={200}
              />
              <Pressable
                style={[
                  styles.sendButton,
                  !complimentText.trim() && styles.sendButtonDisabled
                ]}
                onPress={handleSendCompliment}
                disabled={!complimentText.trim()}
              >
                <Ionicons
                  name="send"
                  size={20}
                  color={complimentText.trim() ? colors.primary : colors.textMuted}
                />
              </Pressable>
            </View>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  storyImage: {
    ...StyleSheet.absoluteFillObject,
  },
  tapZonesContainer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    zIndex: 5,
  },
  tapZoneLeft: {
    flex: 1,
    height: '100%',
  },
  tapZoneRight: {
    flex: 1,
    height: '100%',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    zIndex: 10,
  },
  topOverlay: {
    paddingTop: spacing.xl,
  },
  timerBar: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  timerFill: {
    height: '100%',
    backgroundColor: colors.text,
    borderRadius: 1.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.text,
  },
  avatarPlaceholder: {
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  username: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semiBold,
    color: colors.text,
  },
  age: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    zIndex: 10,
  },
  viewersButton: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  viewersButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  viewersText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  complimentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  complimentInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

export default StoryViewerModal;
