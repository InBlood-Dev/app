/**
 * My Stories Modal
 * Main orchestrator component for managing user's own stories
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useStories, useAuth, useUser } from '../../context';
import { Story } from '../../types';
import { useImagePicker } from '../../hooks/useImagePicker';
import { get } from '../../services/api';
import { ENDPOINTS } from '../../config/api.config';
import StoryThumbnailCard from './StoryThumbnailCard';
import StoryPreviewModal from './StoryPreviewModal';
import ImageSourceSelector from './ImageSourceSelector';
import ViewersModal from './ViewersModal';
import StoryViewerModal, { DisplayStory } from './StoryViewerModal';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { PermissionModal } from '../common/PermissionModal';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';

interface MyStoriesModalProps {
  visible: boolean;
  onClose: () => void;
}

export const MyStoriesModal: React.FC<MyStoriesModalProps> = ({
  visible,
  onClose,
}) => {
  const { stories, addStory, removeStory, isLoading } = useStories();
  const { name: userName } = useAuth();
  const { user } = useUser();
  const userPhoto = user?.photos[0];
  const { pickFromCamera, pickFromGallery } = useImagePicker();

  const userId = user?.id;

  // UI states
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [showViewersModal, setShowViewersModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permissionType, setPermissionType] = useState<'camera' | 'gallery'>('camera');

  // Data states
  const [selectedImage, setSelectedImage] = useState<{ uri: string } | null>(null);
  const [selectedStory, setSelectedStory] = useState<DisplayStory | null>(null);
  const [storyToDelete, setStoryToDelete] = useState<Story | null>(null);
  const [storyProgress, setStoryProgress] = useState(0);
  const [localStories, setLocalStories] = useState<Story[]>([]); // Local state for own stories

  // Loading states
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Get user's own stories from the feed (stories from matched users)
  // Note: The feed endpoint may not include own stories, so we use local state
  const myStories = stories.find(user => user.user_id === userId);
  const feedStories = myStories?.stories || [];

  // Combine local stories with feed stories (in case backend includes them)
  const myStoriesList = localStories.length > 0 ? localStories : feedStories;

  // Reset states when modal closes
  useEffect(() => {
    if (!visible) {
      setShowImagePicker(false);
      setShowPreview(false);
      setShowViewer(false);
      setShowViewersModal(false);
      setShowDeleteConfirm(false);
      setShowPermissionModal(false);
      setSelectedImage(null);
      setSelectedStory(null);
      setStoryToDelete(null);
      setStoryProgress(0);
    }
  }, [visible]);

  // Fetch own stories when modal opens
  useEffect(() => {
    const fetchOwnStories = async () => {
      if (!visible || !userId) return;

      try {
        console.log('[MyStoriesModal] Fetching own stories...');
        // Make API call to get user's own stories
        // Using GET /stories/me endpoint
        const response = await get<{ stories: Story[] }>(ENDPOINTS.STORIES.MY_STORIES);

        if (response.success && response.data?.stories) {
          console.log('[MyStoriesModal] Own stories fetched:', response.data.stories.length);
          setLocalStories(response.data.stories);
        } else {
          console.log('[MyStoriesModal] No own stories or failed:', response.message);
          setLocalStories([]);
        }
      } catch (error) {
        console.error('[MyStoriesModal] Error fetching own stories:', error);
        setLocalStories([]);
      }
    };

    fetchOwnStories();
  }, [visible, userId]);

  // Story timer effect
  useEffect(() => {
    if (!showViewer || !selectedStory) return;

    const duration = 10000; // 10 seconds
    const interval = 50;
    const increment = (interval / duration) * 100;

    const timer = setInterval(() => {
      setStoryProgress(prev => {
        const newProgress = prev + increment;
        if (newProgress >= 100) {
          clearInterval(timer);
          handleCloseViewer();
          return 100;
        }
        return newProgress;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [showViewer, selectedStory]);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  // Image selection handlers
  const handleAddStoryPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowImagePicker(true);
  };

  const handleSelectCamera = async () => {
    setShowImagePicker(false);
    const result = await pickFromCamera();

    if (result) {
      setSelectedImage({ uri: result.uri });
      setShowPreview(true);
    } else {
      // Permission denied
      setPermissionType('camera');
      setShowPermissionModal(true);
    }
  };

  const handleSelectGallery = async () => {
    setShowImagePicker(false);
    const result = await pickFromGallery();

    if (result) {
      setSelectedImage({ uri: result.uri });
      setShowPreview(true);
    } else {
      // Permission denied
      setPermissionType('gallery');
      setShowPermissionModal(true);
    }
  };

  // Upload handler
  const handleShare = async (caption: string) => {
    if (!selectedImage) return;

    setIsUploading(true);
    const success = await addStory(selectedImage.uri, caption);

    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowPreview(false);
      setSelectedImage(null);

      // Refresh own stories after upload
      try {
        console.log('[MyStoriesModal] Refreshing own stories after upload...');
        const response = await get<{ stories: Story[] }>(ENDPOINTS.STORIES.MY_STORIES);
        if (response.success && response.data?.stories) {
          console.log('[MyStoriesModal] Own stories refreshed:', response.data.stories.length);
          setLocalStories(response.data.stories);
        }
      } catch (error) {
        console.error('[MyStoriesModal] Error refreshing stories:', error);
      }
    } else {
      // Error is already handled by StoriesContext
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setIsUploading(false);
  };

  // Story viewing handlers
  const handleViewStory = (story: Story) => {
    const displayStory: DisplayStory = {
      id: story.story_id,
      name: userName || 'You',
      image: userPhoto || '',
      isMyStory: true,
      storyContent: story.media_url,
      age: 0,
      bio: '',
      interests: [],
      prompt: { question: '', answer: '' },
      viewCount: story.view_count,
    };
    setSelectedStory(displayStory);
    setStoryProgress(0);
    setShowViewer(true);
  };

  const handleCloseViewer = () => {
    setShowViewer(false);
    setSelectedStory(null);
    setStoryProgress(0);
  };

  // Delete handlers
  const handleDeletePress = () => {
    if (selectedStory && myStoriesList.length > 0) {
      const story = myStoriesList.find(s => s.story_id === selectedStory.id);
      if (story) {
        setStoryToDelete(story);
        setShowDeleteConfirm(true);
        setShowViewer(false);
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (!storyToDelete) return;

    setIsDeleting(true);
    const success = await removeStory(storyToDelete.story_id);

    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowDeleteConfirm(false);
      setStoryToDelete(null);
      setSelectedStory(null);

      // Remove from local state immediately
      setLocalStories(prev => prev.filter(s => s.story_id !== storyToDelete.story_id));

      // Refresh from backend
      try {
        const response = await get<{ stories: Story[] }>(ENDPOINTS.STORIES.MY_STORIES);
        if (response.success && response.data?.stories) {
          setLocalStories(response.data.stories);
        }
      } catch (error) {
        console.error('[MyStoriesModal] Error refreshing stories after delete:', error);
      }
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setIsDeleting(false);
  };

  // Viewers handlers
  const handleViewViewers = () => {
    if (selectedStory) {
      setShowViewer(false);
      setShowViewersModal(true);
    }
  };

  const handleViewProfile = (userId: string) => {
    // TODO: Navigate to profile screen
    console.log('[MyStoriesModal] View profile:', userId);
    setShowViewersModal(false);
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        onRequestClose={handleClose}
      >
        <View style={styles.container}>
          <LinearGradient
            colors={['#0a0a0a', '#1a1a1a']}
            style={styles.gradient}
          >
            <SafeAreaView edges={['top']} style={styles.safeArea}>
              {/* Header */}
              <View style={styles.header}>
                <Pressable style={styles.backButton} onPress={handleClose}>
                  <Ionicons name="chevron-back" size={28} color={colors.text} />
                </Pressable>
                <Text style={styles.headerTitle}>My Stories</Text>
                <View style={styles.headerPlaceholder} />
              </View>

              {/* Content */}
              <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
              >
                {isLoading && myStoriesList.length === 0 ? (
                  // Loading state
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading your stories...</Text>
                  </View>
                ) : myStoriesList.length === 0 ? (
                  // Empty state
                  <Animated.View entering={FadeIn.duration(300)} style={styles.emptyState}>
                    <Ionicons name="book-outline" size={64} color={colors.textSecondary} />
                    <Text style={styles.emptyTitle}>No Active Stories</Text>
                    <Text style={styles.emptySubtitle}>
                      Share a moment with your matches
                    </Text>
                    <Pressable
                      style={styles.emptyAddButton}
                      onPress={handleAddStoryPress}
                    >
                      <LinearGradient
                        colors={[colors.primary, colors.primary]}
                        style={styles.emptyAddButtonGradient}
                      >
                        <Ionicons name="camera" size={24} color={colors.text} />
                        <Text style={styles.emptyAddButtonText}>
                          Add Your First Story
                        </Text>
                      </LinearGradient>
                    </Pressable>
                  </Animated.View>
                ) : (
                  // Stories grid
                  <Animated.View entering={FadeInDown.duration(300).springify()}>
                    <View style={styles.storiesGrid}>
                      {myStoriesList.map((story, index) => (
                        <StoryThumbnailCard
                          key={story.story_id}
                          story={story}
                          onPress={() => handleViewStory(story)}
                          onLongPress={() => {
                            setStoryToDelete(story);
                            setShowDeleteConfirm(true);
                          }}
                        />
                      ))}
                    </View>
                  </Animated.View>
                )}
              </ScrollView>

              {/* Floating Add Button (only if has stories) */}
              {myStoriesList.length > 0 && (
                <View style={styles.floatingButtonContainer}>
                  <Pressable
                    style={styles.floatingButton}
                    onPress={handleAddStoryPress}
                  >
                    <LinearGradient
                      colors={[colors.primary, colors.primary]}
                      style={styles.floatingButtonGradient}
                    >
                      <Ionicons name="camera" size={24} color={colors.text} />
                      <Text style={styles.floatingButtonText}>Add Story</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              )}
            </SafeAreaView>
          </LinearGradient>
        </View>
      </Modal>

      {/* Child Modals */}
      <ImageSourceSelector
        visible={showImagePicker}
        onSelectCamera={handleSelectCamera}
        onSelectGallery={handleSelectGallery}
        onCancel={() => setShowImagePicker(false)}
      />

      <StoryPreviewModal
        visible={showPreview}
        imageUri={selectedImage?.uri || ''}
        onShare={handleShare}
        onClose={() => {
          setShowPreview(false);
          setSelectedImage(null);
        }}
        isUploading={isUploading}
      />

      <StoryViewerModal
        visible={showViewer}
        story={selectedStory}
        isOwnStory={true}
        onClose={handleCloseViewer}
        onDelete={handleDeletePress}
        onViewViewers={handleViewViewers}
        storyProgress={storyProgress}
      />

      <ViewersModal
        visible={showViewersModal}
        storyId={selectedStory?.id || ''}
        onClose={() => {
          setShowViewersModal(false);
          setShowViewer(true);
        }}
        onViewProfile={handleViewProfile}
      />

      <ConfirmDeleteModal
        visible={showDeleteConfirm}
        title="Delete Story?"
        message="This story will be permanently deleted. This action cannot be undone."
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setStoryToDelete(null);
        }}
      />

      <PermissionModal
        visible={showPermissionModal}
        type={permissionType}
        onClose={() => setShowPermissionModal(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  headerPlaceholder: {
    width: 44,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl * 2,
  },
  loadingText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xxl * 2,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyAddButton: {
    marginTop: spacing.lg,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  emptyAddButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  emptyAddButtonText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  storiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.lg,
    right: spacing.lg,
  },
  floatingButton: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  floatingButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  floatingButtonText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
});

export default MyStoriesModal;
