import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { getStoriesFeed, createStory, deleteStory, markStoryViewed } from '../services/stories.service';
import type { StoryUser, Story } from '../types';

interface StoriesState {
  stories: StoryUser[];
  isLoading: boolean;
  error: string | null;
}

interface StoriesContextType extends StoriesState {
  fetchStories: () => Promise<void>;
  addStory: (mediaUri: string, caption?: string) => Promise<boolean>;
  removeStory: (storyId: string) => Promise<boolean>;
  viewStory: (storyId: string) => Promise<void>;
  getMyStory: () => StoryUser | null;
  clearError: () => void;
}

const initialState: StoriesState = {
  stories: [],
  isLoading: false,
  error: null,
};

const StoriesContext = createContext<StoriesContextType | undefined>(undefined);

export const StoriesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<StoriesState>(initialState);

  /**
   * Fetch stories feed from API
   */
  const fetchStories = useCallback(async () => {
    console.log('[StoriesContext] Fetching stories feed');
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await getStoriesFeed();

      if (response.success && response.data?.stories) {
        console.log('[StoriesContext] Stories fetched:', response.data.stories.length);
        setState(prev => ({
          ...prev,
          stories: response.data.stories,
          isLoading: false,
        }));
      } else if (response.success && !response.data?.stories) {
        // API succeeded but no stories data (possibly empty or backend issue)
        console.log('[StoriesContext] No stories data in response');
        setState(prev => ({
          ...prev,
          stories: [],
          isLoading: false,
        }));
      } else {
        throw new Error(response.message || 'Failed to fetch stories');
      }
    } catch (error) {
      console.error('[StoriesContext] Error fetching stories:', error);
      setState(prev => ({
        ...prev,
        stories: [], // Set empty array on error to show fallback UI
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load stories',
      }));
    }
  }, []);

  /**
   * Create a new story
   */
  const addStory = useCallback(async (mediaUri: string, caption?: string): Promise<boolean> => {
    console.log('[StoriesContext] Creating story');

    try {
      const response = await createStory(mediaUri, caption);

      if (response.success) {
        console.log('[StoriesContext] Story created successfully');
        // Refresh stories to include the new one
        await fetchStories();
        return true;
      } else {
        throw new Error(response.message);
      }
    } catch (error) {
      console.error('[StoriesContext] Error creating story:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to create story',
      }));
      return false;
    }
  }, [fetchStories]);

  /**
   * Delete a story
   */
  const removeStory = useCallback(async (storyId: string): Promise<boolean> => {
    console.log('[StoriesContext] Deleting story:', storyId);

    try {
      const response = await deleteStory(storyId);

      if (response.success) {
        console.log('[StoriesContext] Story deleted successfully');
        // Remove from local state
        setState(prev => ({
          ...prev,
          stories: prev.stories.map(user => ({
            ...user,
            stories: user.stories.filter(s => s.story_id !== storyId),
          })).filter(user => user.stories.length > 0),
        }));
        return true;
      } else {
        throw new Error(response.message);
      }
    } catch (error) {
      console.error('[StoriesContext] Error deleting story:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to delete story',
      }));
      return false;
    }
  }, []);

  /**
   * Mark a story as viewed
   */
  const viewStory = useCallback(async (storyId: string) => {
    console.log('[StoriesContext] Marking story as viewed:', storyId);

    try {
      await markStoryViewed(storyId);

      // Update local state to mark as viewed
      setState(prev => ({
        ...prev,
        stories: prev.stories.map(user => ({
          ...user,
          stories: user.stories.map(s =>
            s.story_id === storyId ? { ...s, has_viewed: true } : s
          ),
          has_unviewed: user.stories.some(s =>
            s.story_id !== storyId && !s.has_viewed
          ),
        })),
      }));
    } catch (error) {
      // Silent fail for view tracking
      console.error('[StoriesContext] Error marking story viewed:', error);
    }
  }, []);

  /**
   * Get current user's story (first item with matching user)
   * This is typically the first story in the feed belonging to current user
   */
  const getMyStory = useCallback((): StoryUser | null => {
    // My story will be added separately in the UI using current user's photo
    // This returns null as we don't track "my story" in the stories feed
    return null;
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return (
    <StoriesContext.Provider
      value={{
        ...state,
        fetchStories,
        addStory,
        removeStory,
        viewStory,
        getMyStory,
        clearError,
      }}
    >
      {children}
    </StoriesContext.Provider>
  );
};

export const useStories = (): StoriesContextType => {
  const context = useContext(StoriesContext);
  if (!context) {
    throw new Error('useStories must be used within a StoriesProvider');
  }
  return context;
};
