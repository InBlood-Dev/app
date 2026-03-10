import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Pressable,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';
import {
  getBlockedUsers,
  unblockUser,
  BlockedUser,
} from '../../services/settings.service';

export const BlockedUsersScreen: React.FC = () => {
  const navigation = useNavigation();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  const fetchBlocked = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getBlockedUsers();
      if (response.success && response.data?.blocked_users) {
        setBlockedUsers(response.data.blocked_users);
      }
    } catch (error: any) {
      console.error('[BlockedUsers] Error fetching:', error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBlocked();
  }, [fetchBlocked]);

  const handleUnblock = useCallback((item: BlockedUser) => {
    Alert.alert(
      'Unblock User',
      `Are you sure you want to unblock ${item.blocked_user.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            try {
              setUnblocking(item.block_id);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              const response = await unblockUser(item.block_id);
              if (response.success) {
                setBlockedUsers(prev => prev.filter(b => b.block_id !== item.block_id));
              }
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to unblock user');
            } finally {
              setUnblocking(null);
            }
          },
        },
      ]
    );
  }, []);

  const renderItem = useCallback(({ item }: { item: BlockedUser }) => {
    const user = item.blocked_user;
    const isUnblocking = unblocking === item.block_id;

    return (
      <View style={styles.userRow}>
        {user.primary_photo ? (
          <Image source={{ uri: user.primary_photo }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={24} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user.name}, {user.age}</Text>
          <Text style={styles.userDetail}>{user.location_city || 'Unknown location'}</Text>
        </View>
        <Pressable
          style={styles.unblockButton}
          onPress={() => handleUnblock(item)}
          disabled={isUnblocking}
        >
          {isUnblocking ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.unblockText}>Unblock</Text>
          )}
        </Pressable>
      </View>
    );
  }, [unblocking, handleUnblock]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Blocked Users</Text>
          <View style={styles.backButton} />
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : blockedUsers.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="shield-checkmark-outline" size={64} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No blocked users</Text>
            <Text style={styles.emptySubtitle}>Users you block will appear here</Text>
          </View>
        ) : (
          <FlatList
            data={blockedUsers}
            keyExtractor={item => item.block_id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
          />
        )}
      </SafeAreaView>
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  list: {
    paddingVertical: spacing.sm,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  userName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  userDetail: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  unblockButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    minWidth: 80,
    alignItems: 'center',
  },
  unblockText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.primary,
  },
});
