/**
 * Stories Service
 *
 * API calls for stories feature - create, read, delete, mark viewed
 */

import { get, post, del, postFormData, ApiResponse } from './api';
import { ENDPOINTS } from '../config/api.config';
import type { Story, StoryUser, StoryFeedResponse, StoryCreateResponse } from '../types';

/**
 * Get stories feed from matched users
 */
export const getStoriesFeed = async (): Promise<ApiResponse<StoryFeedResponse>> => {
  return get<StoryFeedResponse>(ENDPOINTS.STORIES.FEED);
};

/**
 * Create a new story with media
 */
export const createStory = async (
  mediaUri: string,
  caption?: string
): Promise<ApiResponse<StoryCreateResponse>> => {
  const formData = new FormData();

  formData.append('media', {
    uri: mediaUri,
    type: 'image/jpeg',
    name: 'story.jpg',
  } as any);

  if (caption) {
    formData.append('caption', caption);
  }

  return postFormData<StoryCreateResponse>(ENDPOINTS.STORIES.CREATE, formData);
};

/**
 * Delete a story by ID
 */
export const deleteStory = async (storyId: string): Promise<ApiResponse<null>> => {
  return del<null>(ENDPOINTS.STORIES.DELETE(storyId));
};

/**
 * Mark a story as viewed
 */
export const markStoryViewed = async (storyId: string): Promise<ApiResponse<null>> => {
  return post<null>(ENDPOINTS.STORIES.VIEW(storyId));
};

/**
 * Get user's own stories
 */
export const getMyStories = async (): Promise<ApiResponse<{ stories: Story[] }>> => {
  return get<{ stories: Story[] }>(ENDPOINTS.STORIES.MY_STORIES);
};

export default {
  getStoriesFeed,
  createStory,
  deleteStory,
  markStoryViewed,
  getMyStories,
};
