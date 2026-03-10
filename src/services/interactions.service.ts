/**
 * Interactions Service
 *
 * API calls for user interactions - likes, passes, matches
 */

import { get, post, del, ApiResponse } from './api';
import { ENDPOINTS } from '../config/api.config';
import type {
  LikeResponse,
  SuperLikeResponse,
  PassResponse,
  MatchesResponse,
  ProfileViewResponse,
  PendingLikesResponse,
  DailyLimitsResponse,
} from '../types';

/**
 * Send a like to a user
 */
export const sendLike = async (
  likedUserId: string
): Promise<ApiResponse<LikeResponse>> => {
  return post<LikeResponse>(ENDPOINTS.INTERACTIONS.LIKE, {
    target_user_id: likedUserId,
  });
};

/**
 * Send a super like to a user
 */
export const sendSuperLike = async (
  receiverUserId: string
): Promise<ApiResponse<SuperLikeResponse>> => {
  return post<SuperLikeResponse>(ENDPOINTS.INTERACTIONS.SUPER_LIKE, {
    target_user_id: receiverUserId,
  });
};

/**
 * Pass on a user
 */
export const passUser = async (
  passedUserId: string
): Promise<ApiResponse<PassResponse>> => {
  return post<PassResponse>(ENDPOINTS.INTERACTIONS.PASS, {
    target_user_id: passedUserId,
  });
};

/**
 * Get list of matches
 */
export const getMatches = async (
  limit: number = 20,
  offset: number = 0
): Promise<ApiResponse<MatchesResponse>> => {
  return get<MatchesResponse>(ENDPOINTS.INTERACTIONS.MATCHES, { limit, offset });
};

/**
 * Unmatch a user
 */
export const unmatch = async (matchId: string): Promise<ApiResponse<null>> => {
  return del<null>(ENDPOINTS.INTERACTIONS.UNMATCH(matchId));
};

/**
 * Track profile view
 * Backend implements 24-hour debouncing automatically
 */
export const trackProfileView = async (
  viewedUserId: string,
  source: 'discovery' | 'explore' | 'messages' | 'profile' | 'story'
): Promise<ApiResponse<ProfileViewResponse>> => {
  return post<ProfileViewResponse>(ENDPOINTS.INTERACTIONS.PROFILE_VIEW, {
    viewed_user_id: viewedUserId,
    source,
  });
};

/**
 * Get pending likes (who liked you)
 * Free users: only count
 * Premium users: full profile list
 */
export const getPendingLikes = async (): Promise<ApiResponse<PendingLikesResponse>> => {
  return get<PendingLikesResponse>(ENDPOINTS.INTERACTIONS.PENDING_LIKES);
};

/**
 * Pin a match/conversation
 * Pinned matches appear at the top of the conversation list
 */
export const pinMatch = async (matchId: string): Promise<ApiResponse<null>> => {
  return post<null>(ENDPOINTS.INTERACTIONS.PIN_MATCH(matchId), {});
};

/**
 * Unpin a match/conversation
 * Unpinned matches move back to regular conversation list
 */
export const unpinMatch = async (matchId: string): Promise<ApiResponse<null>> => {
  return del<null>(ENDPOINTS.INTERACTIONS.UNPIN_MATCH(matchId));
};

/**
 * Get current daily limits (swipes, super likes)
 * Frontend calls this on mount to initialize limit state
 */
export const getDailyLimits = async (): Promise<ApiResponse<DailyLimitsResponse>> => {
  return get<DailyLimitsResponse>(ENDPOINTS.INTERACTIONS.DAILY_LIMITS);
};

/**
 * Create or get a direct conversation with another user
 */
export const createOrGetConversation = async (
  targetUserId: string
): Promise<ApiResponse<any>> => {
  return post(ENDPOINTS.CONVERSATIONS.CREATE, { target_user_id: targetUserId });
};

/**
 * Get conversation status (is_matched)
 */
export const getConversationStatus = async (
  conversationId: string
): Promise<ApiResponse<any>> => {
  return get(ENDPOINTS.CONVERSATIONS.STATUS(conversationId));
};

/**
 * Get all conversations (matched + non-matched) from the unified backend endpoint.
 * Backed by Firebase user_conversations index — includes every conversation the
 * current user is part of, regardless of match status.
 */
export const getConversations = async (): Promise<ApiResponse<any>> => {
  return get(ENDPOINTS.CONVERSATIONS.LIST);
};

export default {
  sendLike,
  sendSuperLike,
  passUser,
  getMatches,
  unmatch,
  trackProfileView,
  getPendingLikes,
  pinMatch,
  unpinMatch,
  getDailyLimits,
  createOrGetConversation,
  getConversationStatus,
  getConversations,
};
