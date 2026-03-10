/**
 * Search Service
 *
 * Handles user search functionality
 */

import { get, ApiResponse } from './api';
import { ENDPOINTS } from '../config/api.config';

export interface SearchUser {
  user_id: string;
  name: string;
  age: number;
  primary_photo: string;
  distance: number | null;
}

export interface SearchResponse {
  users: SearchUser[];
}

/**
 * Search users by query (name or tags)
 */
export const searchUsers = async (
  query: string,
  limit: number = 20
): Promise<SearchUser[]> => {
  console.log('[SearchService] Searching users:', { query, limit });

  const response = await get<SearchResponse>(ENDPOINTS.SEARCH, {
    q: query,
    limit,
  });

  console.log('[SearchService] Search results:', response.data.users.length, 'users');
  return response.data.users;
};

export default {
  searchUsers,
};
