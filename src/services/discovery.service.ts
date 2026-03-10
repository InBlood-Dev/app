/**
 * Discovery Service
 *
 * API calls for user discovery and recommendations
 */

import { get, ApiResponse } from './api';
import { ENDPOINTS } from '../config/api.config';
import type { DiscoveryFeedResponse, ExploreFeedResponse } from '../types';

/**
 * Get recommended users for "Your Dates" section
 */
export const getDiscoveryFeed = async (
  limit: number = 20
): Promise<ApiResponse<DiscoveryFeedResponse>> => {
  return get<DiscoveryFeedResponse>(ENDPOINTS.DISCOVERY.FEED, { limit });
};

export interface ExploreFilters {
  relationship_type?: string[];
}

/**
 * Get users for explore/grid view (legacy)
 */
export const getExploreFeed = async (
  limit: number = 30,
  offset: number = 0,
  filters?: ExploreFilters
): Promise<ApiResponse<ExploreFeedResponse>> => {
  const params: Record<string, any> = { limit, offset };

  if (filters?.relationship_type?.length) params.relationship_type = filters.relationship_type.join(',');

  console.log('[discovery.service] getExploreFeed params:', JSON.stringify(params));
  return get<ExploreFeedResponse>(ENDPOINTS.DISCOVERY.EXPLORE, params);
};

/**
 * Get users for gallery view (lightweight, optimized for large batches)
 */
export const getGalleryFeed = async (
  limit: number = 1000,
  offset: number = 0,
  filters?: ExploreFilters
): Promise<ApiResponse<ExploreFeedResponse>> => {
  const params: Record<string, any> = { limit, offset };

  if (filters?.relationship_type?.length) params.relationship_type = filters.relationship_type.join(',');

  console.log('[discovery.service] getGalleryFeed params:', JSON.stringify(params));
  return get<ExploreFeedResponse>(ENDPOINTS.DISCOVERY.GALLERY, params);
};

export default {
  getDiscoveryFeed,
  getExploreFeed,
  getGalleryFeed,
};
