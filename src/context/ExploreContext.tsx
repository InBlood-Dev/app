import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { Image } from 'react-native';
import { getGalleryFeed } from '../services/discovery.service';
import type { ExploreFilters } from '../services/discovery.service';

// Grid configuration
const GRID_COLS = 3;
const CHUNK_SIZE = 1000;
const PREFETCH_CHUNKS = 1;
const CACHE_RADIUS = 50;
const MAX_CACHE_SIZE = 1500;

interface Position {
  col: number;
  row: number;
}

interface ExploreProfile {
  user_id: string;
  name: string;
  age: number;
  distance?: number;
  primary_photo: string;
  is_online?: boolean;
  last_active_at?: string;
  relationship_types: Array<{
    type: string;
    border_color: string;
  }>;
}

interface ExploreState {
  profiles: ExploreProfile[];
  hasMore: boolean;
  fetchedCount: number;
  filters: ExploreFilters;
  isInitialLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  cacheCenter: Position;
  generation: number;
}

interface ExploreContextType extends ExploreState {
  fetchInitialChunks: () => Promise<void>;
  fetchChunk: (chunkIndex: number) => Promise<void>;
  getProfileAt: (col: number, row: number) => ExploreProfile | null;
  updateCacheCenter: (col: number, row: number) => void;
  evictDistantRegions: () => void;
  applyFilters: (filters: ExploreFilters) => Promise<void>;
  retryFailedChunk: (chunkIndex: number) => Promise<void>;
}

const ExploreContext = createContext<ExploreContextType | undefined>(undefined);

export const ExploreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ExploreState>({
    profiles: [],
    hasMore: true,
    fetchedCount: 0,
    cacheCenter: { col: 0, row: 0 },
    filters: {},
    isInitialLoading: true,
    isLoadingMore: false,
    error: null,
    generation: 0,
  });

  // Use refs for spatial cache - don't need re-renders when cache updates
  const profileGridRef = useRef(new Map<string, ExploreProfile>());
  const accessTimesRef = useRef(new Map<string, number>());
  const seenProfileIds = useRef(new Set<string>());
  const fetchQueueRef = useRef<number[]>([]);
  const activeFetchesRef = useRef(0);
  const hasInitializedRef = useRef(false);
  const filtersRef = useRef<ExploreFilters>({});

  // Chunk tracking via refs (NOT state) to avoid stale closure issues
  const loadedChunksRef = useRef(new Set<number>());
  const loadingChunksRef = useRef(new Set<number>());
  const failedChunksRef = useRef(new Set<number>());

  // Ref for latest profiles (avoids stale closure in getProfileAt)
  const profilesRef = useRef<ExploreProfile[]>([]);

  // Generation counter to discard stale in-flight fetches after filter changes
  const generationRef = useRef(0);

  // Update access time for cache entry
  const updateAccessTime = useCallback((cacheKey: string) => {
    accessTimesRef.current.set(cacheKey, Date.now());
  }, []);

  // Fetch a single chunk
  const fetchChunk = useCallback(async (chunkIndex: number) => {
    // Use refs (always current) instead of state (stale in closures)
    if (loadedChunksRef.current.has(chunkIndex) || loadingChunksRef.current.has(chunkIndex)) {
      return;
    }

    const offset = chunkIndex * CHUNK_SIZE;
    const myGeneration = generationRef.current;

    // Mark as loading via ref (synchronous, no stale closure)
    loadingChunksRef.current.add(chunkIndex);
    failedChunksRef.current.delete(chunkIndex);
    setState(prev => ({ ...prev, error: null }));

    try {
      console.log(`[ExploreContext] Fetching chunk ${chunkIndex} (offset=${offset}, gen=${myGeneration})`);
      const response = await getGalleryFeed(CHUNK_SIZE, offset, filtersRef.current);

      // Discard result if a new generation started (filter changed / retry happened)
      if (generationRef.current !== myGeneration) {
        console.log(`[ExploreContext] Chunk ${chunkIndex} discarded (gen ${myGeneration} != ${generationRef.current})`);
        loadingChunksRef.current.delete(chunkIndex);
        return;
      }

      if (response.success && response.data?.profiles) {
        const newProfiles = response.data.profiles.filter(
          (profile: ExploreProfile) => !seenProfileIds.current.has(profile.user_id)
        );

        // Mark as seen
        newProfiles.forEach((profile: ExploreProfile) => seenProfileIds.current.add(profile.user_id));

        console.log(`[ExploreContext] Chunk ${chunkIndex}: received ${response.data.profiles.length} profiles, ${newProfiles.length} new`);

        // Update refs
        loadedChunksRef.current.add(chunkIndex);
        loadingChunksRef.current.delete(chunkIndex);

        // Clear spatial cache — profile count changed so the wrapping
        // calculation (totalRows) is different. Stale cache entries would
        // map cells to the wrong profiles.
        if (newProfiles.length > 0) {
          profileGridRef.current.clear();
          accessTimesRef.current.clear();
        }

        setState(prev => {
          const updatedProfiles = [...prev.profiles, ...newProfiles];
          profilesRef.current = updatedProfiles;

          console.log(`[ExploreContext] Updated state: ${updatedProfiles.length} total profiles`);

          return {
            ...prev,
            profiles: updatedProfiles,
            fetchedCount: updatedProfiles.length,
            hasMore: response.data.has_more,
            // Only clear loading once we have profiles to show.
            // If this chunk was empty, keep shimmer visible until
            // fetchInitialChunks settles all chunks.
            isInitialLoading: updatedProfiles.length > 0 ? false : prev.isInitialLoading,
            isLoadingMore: loadedChunksRef.current.size > PREFETCH_CHUNKS,
          };
        });
      } else {
        throw new Error(response.message || 'Failed to fetch profiles');
      }
    } catch (error) {
      // Discard if stale generation
      if (generationRef.current !== myGeneration) {
        loadingChunksRef.current.delete(chunkIndex);
        return;
      }

      console.error(`[ExploreContext] Error fetching chunk ${chunkIndex}:`, error);

      // Update refs
      loadingChunksRef.current.delete(chunkIndex);
      failedChunksRef.current.add(chunkIndex);

      // Don't clear isInitialLoading here — other chunks may still
      // be in flight. fetchInitialChunks handles the final cleanup.
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to fetch profiles',
      }));
    }
  }, []); // No state deps - uses refs which are always current

  // Process fetch queue with concurrency limit
  const processFetchQueue = useCallback(async () => {
    while (fetchQueueRef.current.length > 0 && activeFetchesRef.current < 3) {
      const chunkIndex = fetchQueueRef.current.shift();
      if (chunkIndex === undefined) break;

      activeFetchesRef.current++;
      fetchChunk(chunkIndex).finally(() => {
        activeFetchesRef.current--;
        processFetchQueue();
      });
    }
  }, [fetchChunk]);

  // Fetch initial chunks
  const fetchInitialChunks = useCallback(async () => {
    console.log('[ExploreContext] fetchInitialChunks called, hasInitialized:', hasInitializedRef.current);

    // Prevent duplicate initial fetches
    if (hasInitializedRef.current) {
      console.log('[ExploreContext] Already initialized, skipping fetchInitialChunks');
      return;
    }

    hasInitializedRef.current = true;
    setState(prev => ({ ...prev, isInitialLoading: true, error: null }));

    const chunkPromises: Promise<void>[] = [];
    for (let i = 0; i < PREFETCH_CHUNKS; i++) {
      chunkPromises.push(fetchChunk(i));
    }

    await Promise.allSettled(chunkPromises);
    console.log('[ExploreContext] fetchInitialChunks completed, loadedChunks:', loadedChunksRef.current.size);

    // All initial chunks have settled — ensure loading is cleared so the
    // UI can show the empty state or error state if no profiles arrived.
    setState(prev => prev.isInitialLoading ? { ...prev, isInitialLoading: false } : prev);

    // If ALL chunks failed, reset hasInitializedRef so retry works
    if (loadedChunksRef.current.size === 0) {
      console.log('[ExploreContext] All chunks failed, allowing retry');
      hasInitializedRef.current = false;
    }
  }, [fetchChunk]);

  // Get profile at grid position with wrapping
  const getProfileAt = useCallback((col: number, row: number): ExploreProfile | null => {
    const cacheKey = `${col},${row}`;

    // Check spatial cache
    const cached = profileGridRef.current.get(cacheKey);
    if (cached) {
      updateAccessTime(cacheKey);
      return cached;
    }

    // Use ref for latest profiles (avoids stale closure)
    const currentProfiles = profilesRef.current;
    if (currentProfiles.length === 0) {
      return null;
    }

    // Normalize coordinates for wrapping (handle negative values)
    const normalizedCol = ((col % GRID_COLS) + GRID_COLS) % GRID_COLS;
    const totalRows = Math.ceil(currentProfiles.length / GRID_COLS);
    const normalizedRow = ((row % totalRows) + totalRows) % totalRows;

    // Map to linear offset
    const offset = (normalizedRow * GRID_COLS + normalizedCol) % currentProfiles.length;
    const profile = currentProfiles[offset];

    // Add to spatial cache
    if (profile) {
      profileGridRef.current.set(cacheKey, profile);
      updateAccessTime(cacheKey);
    }

    return profile;
  }, [updateAccessTime]);

  // Update cache center
  const updateCacheCenter = useCallback((col: number, row: number) => {
    setState(prev => ({ ...prev, cacheCenter: { col, row } }));
  }, []);

  // Prefetch ALL profile images when profiles arrive.
  // The grid renders all profiles at once (identical 3×3 tiles),
  // so every image needs to be ready — not just those near the viewport.
  useEffect(() => {
    if (state.profiles.length > 0) {
      state.profiles.forEach(profile => {
        if (profile.primary_photo) {
          Image.prefetch(profile.primary_photo).catch(() => {});
        }
      });
    }
  }, [state.profiles.length]);

  // Evict profiles far from viewport
  const evictDistantRegions = useCallback(() => {
    const keysToRemove: string[] = [];

    profileGridRef.current.forEach((_profile, key) => {
      const [, row] = key.split(',').map(Number);
      const distance = Math.abs(row - state.cacheCenter.row);

      if (distance > CACHE_RADIUS) {
        keysToRemove.push(key);
      }
    });

    keysToRemove.forEach(key => {
      profileGridRef.current.delete(key);
      accessTimesRef.current.delete(key);
    });

    // Enforce max cache size with LRU
    if (profileGridRef.current.size > MAX_CACHE_SIZE) {
      const entries = Array.from(profileGridRef.current.entries())
        .map(([key, _profile]) => ({
          key,
          lastAccessed: accessTimesRef.current.get(key) || 0,
        }))
        .sort((a, b) => a.lastAccessed - b.lastAccessed);

      const toRemove = Math.floor(entries.length * 0.2);
      entries.slice(0, toRemove).forEach(entry => {
        profileGridRef.current.delete(entry.key);
        accessTimesRef.current.delete(entry.key);
      });
    }
  }, [state.cacheCenter.row]);

  // Apply new filters: clear all caches, increment generation, refetch
  const applyFilters = useCallback(async (newFilters: ExploreFilters) => {
    console.log('[ExploreContext] Applying filters:', JSON.stringify(newFilters));

    // Increment generation to invalidate any in-flight fetches
    generationRef.current += 1;
    const newGeneration = generationRef.current;

    // Update filter ref
    filtersRef.current = newFilters;

    // Clear all refs SYNCHRONOUSLY
    loadedChunksRef.current = new Set();
    loadingChunksRef.current = new Set();
    failedChunksRef.current = new Set();
    profileGridRef.current.clear();
    accessTimesRef.current.clear();
    seenProfileIds.current.clear();
    fetchQueueRef.current = [];
    hasInitializedRef.current = false;
    profilesRef.current = [];

    // Clear state with new generation
    setState({
      profiles: [],
      hasMore: true,
      fetchedCount: 0,
      cacheCenter: { col: 0, row: 0 },
      filters: newFilters,
      isInitialLoading: true,
      isLoadingMore: false,
      error: null,
      generation: newGeneration,
    });

    // Fetch fresh data
    await fetchInitialChunks();
  }, [fetchInitialChunks]);

  // Retry failed chunk
  const retryFailedChunk = useCallback(async (chunkIndex: number) => {
    failedChunksRef.current.delete(chunkIndex);
    await fetchChunk(chunkIndex);
  }, [fetchChunk]);

  const value: ExploreContextType = {
    ...state,
    fetchInitialChunks,
    fetchChunk,
    getProfileAt,
    updateCacheCenter,
    evictDistantRegions,
    applyFilters,
    retryFailedChunk,
  };

  return <ExploreContext.Provider value={value}>{children}</ExploreContext.Provider>;
};

export const useExplore = () => {
  const context = useContext(ExploreContext);
  if (!context) {
    throw new Error('useExplore must be used within ExploreProvider');
  }
  return context;
};

export type { ExploreProfile, ExploreFilters, Position };
