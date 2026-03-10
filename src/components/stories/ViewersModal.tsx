/**
 * Story viewers modal
 * Shows list of users who viewed the story
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { get, ApiResponse } from '../../services/api';
import { ENDPOINTS } from '../../config/api.config';
import { formatRelativeTime } from '../../utils/timeUtils';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';

interface StoryViewer {
  user_id: string;
  name: string;
  age: number;
  primary_photo: string;
  viewed_at: string;
}

interface ViewersResponse {
  viewers: StoryViewer[];
  total: number;
}

interface ViewersModalProps {
  visible: boolean;
  storyId: string;
  onClose: () => void;
  onViewProfile: (userId: string) => void;
}

export const ViewersModal: React.FC<ViewersModalProps> = ({
  visible,
  storyId,
  onClose,
  onViewProfile,
}) => {
  const [viewers, setViewers] = useState<StoryViewer[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchViewers = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response: ApiResponse<ViewersResponse> = await get<ViewersResponse>(
        ENDPOINTS.STORIES.VIEWERS(storyId)
      );

      if (response.success && response.data) {
        setViewers(response.data.viewers);
        setTotal(response.data.total);
      } else {
        setError(response.message || 'Failed to load viewers');
      }
    } catch (err) {
      console.error('[ViewersModal] Error fetching viewers:', err);
      setError('Failed to load viewers');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [storyId]);

  useEffect(() => {
    if (visible && storyId) {
      fetchViewers();
    }
  }, [visible, storyId, fetchViewers]);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const handleViewProfile = (userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onViewProfile(userId);
  };

  const handleRefresh = () => {
    fetchViewers(true);
  };

  const renderViewer = ({ item }: { item: StoryViewer }) => (
    <Pressable
      style={styles.viewerItem}
      onPress={() => handleViewProfile(item.user_id)}
    >
      {/* Avatar */}
      <Image
        source={{ uri: item.primary_photo || 'https://via.placeholder.com/150' }}
        style={styles.avatar}
      />

      {/* Info */}
      <View style={styles.viewerInfo}>
        <Text style={styles.viewerName}>
          {item.name}, {item.age}
        </Text>
        <Text style={styles.viewedTime}>
          {formatRelativeTime(item.viewed_at)}
        </Text>
      </View>

      {/* Chevron */}
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </Pressable>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop */}
        <Pressable
          style={styles.backdrop}
          onPress={handleClose}
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

              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>
                  Viewers {total > 0 && `(${total})`}
                </Text>
                <Pressable style={styles.closeButton} onPress={handleClose}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </Pressable>
              </View>

              {/* Content */}
              <View style={styles.content}>
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading viewers...</Text>
                  </View>
                ) : error ? (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={48} color={colors.primary} />
                    <Text style={styles.errorText}>{error}</Text>
                    <Pressable style={styles.retryButton} onPress={() => fetchViewers()}>
                      <Text style={styles.retryText}>Retry</Text>
                    </Pressable>
                  </View>
                ) : viewers.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="eye-off-outline" size={48} color={colors.textSecondary} />
                    <Text style={styles.emptyText}>No views yet</Text>
                    <Text style={styles.emptySubtext}>
                      Your matched users will see your story in their feed
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={viewers}
                    keyExtractor={(item) => item.user_id}
                    renderItem={renderViewer}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                      <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={handleRefresh}
                        tintColor={colors.primary}
                        colors={[colors.primary]}
                      />
                    }
                  />
                )}
              </View>
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
    maxHeight: '70%',
  },
  gradient: {
    paddingTop: spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    height: 400,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  errorText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
  },
  retryText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  emptyText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semiBold,
    color: colors.text,
  },
  emptySubtext: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  viewerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background,
  },
  viewerInfo: {
    flex: 1,
  },
  viewerName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semiBold,
    color: colors.text,
    marginBottom: 2,
  },
  viewedTime: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
});

export default ViewersModal;
