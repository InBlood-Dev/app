import { post, del, get } from './api';

/**
 * Blocked user from API
 */
export interface BlockedUser {
  user_id: string;
  name: string;
  age: number;
  primary_photo: string;
  blocked_at: string;
}

/**
 * Block response
 */
interface BlockResponse {
  block: {
    block_id: string;
    blocker_user_id: string;
    blocked_user_id: string;
    created_at: string;
  };
}

/**
 * Blocked users list response
 */
interface BlockedUsersResponse {
  blocked_users: BlockedUser[];
  total: number;
}

/**
 * Block a user
 * @param userId - User ID to block
 * @returns Block details
 */
export const blockUser = async (userId: string): Promise<BlockResponse> => {
  try {
    console.log('[Blocking Service] Blocking user:', userId);

    const response = await post<BlockResponse>('/interactions/block', {
      blocked_user_id: userId,
    });

    if (!response.success) {
      throw new Error(response.message || 'Failed to block user');
    }

    console.log('[Blocking Service] User blocked successfully:', userId);
    return response.data;
  } catch (error) {
    console.error('[Blocking Service] Failed to block user:', error);
    throw error;
  }
};

/**
 * Unblock a user
 * @param userId - User ID to unblock
 */
export const unblockUser = async (userId: string): Promise<void> => {
  try {
    console.log('[Blocking Service] Unblocking user:', userId);

    const response = await del(`/interactions/unblock/${userId}`);

    if (!response.success) {
      throw new Error(response.message || 'Failed to unblock user');
    }

    console.log('[Blocking Service] User unblocked successfully:', userId);
  } catch (error) {
    console.error('[Blocking Service] Failed to unblock user:', error);
    throw error;
  }
};

/**
 * Get list of blocked users
 * @returns List of blocked users
 */
export const getBlockedUsers = async (): Promise<BlockedUser[]> => {
  try {
    console.log('[Blocking Service] Fetching blocked users...');

    const response = await get<BlockedUsersResponse>('/interactions/blocked-users');

    if (!response.success) {
      throw new Error(response.message || 'Failed to get blocked users');
    }

    console.log('[Blocking Service] Blocked users fetched:', response.data.total);
    return response.data.blocked_users;
  } catch (error) {
    console.error('[Blocking Service] Failed to get blocked users:', error);
    throw error;
  }
};

/**
 * Check if a user is blocked
 * @param userId - User ID to check
 * @returns true if user is blocked
 */
export const isUserBlocked = async (userId: string): Promise<boolean> => {
  try {
    const blockedUsers = await getBlockedUsers();
    return blockedUsers.some(user => user.user_id === userId);
  } catch (error) {
    console.error('[Blocking Service] Failed to check if user is blocked:', error);
    return false;
  }
};
