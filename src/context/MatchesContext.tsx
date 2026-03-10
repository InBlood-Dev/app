import React, { createContext, useContext, useState, useCallback, useRef, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Match, MatchToastData, Profile, SwipeDirection, RecommendedUser, ApiMatch, PendingLikesResponse } from '../types';
import { getDiscoveryFeed } from '../services/discovery.service';
import {
  sendLike,
  sendSuperLike,
  passUser,
  getMatches as fetchMatchesApi,
  getConversations as fetchConversationsApi,
  getPendingLikes,
  pinMatch as pinMatchApi,
  unpinMatch as unpinMatchApi,
  getDailyLimits,
} from '../services/interactions.service';
import { subscribeToUserConversations } from '../services/firebase-messaging.service';
import { useAuth } from './AuthContext';
import { notificationService } from '../services/notifications.service';
import { getSubscriptionStatus } from '../services/payment.service';

interface MatchesContextType {
  matches: Match[];
  conversations: Match[]; // non-matched direct message conversations
  profiles: Profile[];
  recommendedUsers: RecommendedUser[];
  likedProfiles: string[];
  passedProfiles: string[];
  superLikedProfiles: string[];
  currentMatchNotification: Match | null;
  isLoading: boolean;
  error: string | null;
  pendingLikes: PendingLikesResponse | null;
  superLikesRemaining: number;
  superLikeDailyLimit: number;
  swipesRemaining: number | null;
  dailySwipeLimit: number | null;
  isPremium: boolean;
  refreshPremiumStatus: () => Promise<void>;
  swipeProfile: (profileId: string, direction: SwipeDirection) => Promise<Match | null>;
  dismissMatchNotification: () => void;
  getAvailableProfiles: () => Profile[];
  undoLastSwipe: () => void;
  createMatchForProfile: (profileData: Partial<Profile>) => Match;
  findMatchByName: (name: string) => Match | undefined;
  fetchRecommendedUsers: (limit?: number, forceRefresh?: boolean) => Promise<void>;
  fetchMatches: (limit?: number, offset?: number, forceRefresh?: boolean) => Promise<void>;
  fetchConversations: () => Promise<void>;
  fetchPendingLikes: () => Promise<void>;
  pinMatch: (matchId: string) => Promise<void>;
  unpinMatch: (matchId: string) => Promise<void>;
  clearError: () => void;
  matchToast: MatchToastData | null;
  dismissMatchToast: () => void;
}

const MatchesContext = createContext<MatchesContextType | undefined>(undefined);

/**
 * Convert API user to local Profile type
 */
const apiUserToProfile = (user: RecommendedUser): Profile => ({
  id: user.user_id,
  name: user.name,
  age: user.age,
  gender: user.gender.toLowerCase() as 'male' | 'female' | 'non-binary' | 'other',
  interestedIn: ['everyone'],
  photos: user.photos,
  bio: user.bio,
  interests: user.tags.map(t => t.name),
  location: {
    city: user.location_city,
    distance: user.distance,
  },
  stats: {
    seductions: user.seductions_count || 0,
    likes: user.hearts_count || 0,
  },
  preferences: {
    ageRange: { min: 18, max: 40 },
    maxDistance: 25,
  },
  verified: user.is_verified,
  lastActive: new Date(user.last_active_at),
  matchPercentage: user.match_score,
  orientation: user.sexual_orientation,
});

/**
 * Convert API match to local Match type
 */
const safeDate = (value: any): Date => {
  if (!value) return new Date();
  const d = new Date(value);
  return isNaN(d.getTime()) ? new Date() : d;
};

const apiMatchToMatch = (apiMatch: ApiMatch): Match => ({
  id: apiMatch.match_id,
  conversationId: apiMatch.conversation_id,
  matchedAt: safeDate(apiMatch.matched_at),
  isActive: apiMatch.is_active,
  isPinned: apiMatch.is_pinned ?? false, // From backend, defaults to false if not present
  profile: {
    id: apiMatch.user.user_id,
    name: apiMatch.user.name,
    age: apiMatch.user.age,
    gender: 'female', // Default, not provided in match response
    interestedIn: ['everyone'],
    photos: [apiMatch.user.primary_photo],
    bio: '',
    interests: [],
    location: { city: '' },
    preferences: { ageRange: { min: 18, max: 40 }, maxDistance: 25 },
    verified: apiMatch.user.is_verified,
    lastActive: apiMatch.user.last_active_at ? new Date(apiMatch.user.last_active_at) : undefined,
  },
  lastMessage: apiMatch.last_message ? {
    id: apiMatch.last_message.message_id,
    senderId: apiMatch.last_message.is_from_me ? 'me' : apiMatch.user.user_id,
    text: apiMatch.last_message.content,
    timestamp: safeDate(apiMatch.last_message.sent_at),
    status: 'delivered',
    type: 'text',
  } : undefined,
  unreadCount: apiMatch.unread_count,
});

// Cache duration: 30 seconds (prevents duplicate fetches after PreloadGate pre-fetch)
const CACHE_DURATION = 30000;

/**
 * Convert a GET /conversations item (is_matched: false) to the local Match shape
 * so non-matched direct conversations can reuse the same ChatItem UI.
 */
const apiConversationToMatch = (conv: any): Match => ({
  id: conv.conversation_id,
  conversationId: conv.conversation_id,
  matchedAt: new Date(conv.last_message_at || Date.now()),
  isActive: true,
  isPinned: conv.is_pinned ?? false,
  profile: {
    id: conv.other_user.user_id,
    name: conv.other_user.name,
    age: 0,
    gender: 'other' as any,
    interestedIn: ['everyone'] as any,
    photos: conv.other_user.primary_photo ? [conv.other_user.primary_photo] : [],
    bio: '',
    interests: [],
    location: { city: '' },
    preferences: { ageRange: { min: 18, max: 40 }, maxDistance: 25 },
    verified: false,
    lastActive: conv.other_user.last_active_at
      ? new Date(conv.other_user.last_active_at)
      : undefined,
  },
  lastMessage: conv.last_message
    ? {
        id: `last-${conv.conversation_id}`,
        senderId: conv.last_message.sender_id,
        text: conv.last_message.content,
        timestamp: new Date(conv.last_message.sent_at),
        status: 'delivered' as const,
        type: 'text' as const,
      }
    : undefined,
  unreadCount: conv.unread_count ?? 0,
});

export const MatchesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated, userId } = useAuth();
  const [profiles] = useState<Profile[]>([]);
  const [recommendedUsers, setRecommendedUsers] = useState<RecommendedUser[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [conversations, setConversations] = useState<Match[]>([]);
  const [likedProfiles, setLikedProfiles] = useState<string[]>([]);
  const [passedProfiles, setPassedProfiles] = useState<string[]>([]);
  const [superLikedProfiles, setSuperLikedProfiles] = useState<string[]>([]);
  const [currentMatchNotification, setCurrentMatchNotification] = useState<Match | null>(null);
  const [lastSwipe, setLastSwipe] = useState<{ profileId: string; direction: SwipeDirection } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingLikes, setPendingLikes] = useState<PendingLikesResponse | null>(null);
  const [superLikesRemaining, setSuperLikesRemaining] = useState<number>(1);
  const [superLikeDailyLimit, setSuperLikeDailyLimit] = useState<number>(1);
  const [swipesRemaining, setSwipesRemaining] = useState<number | null>(10);
  const [dailySwipeLimit, setDailySwipeLimit] = useState<number | null>(10);
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [matchToast, setMatchToast] = useState<MatchToastData | null>(null);
  const notifListenerRef = useRef<Notifications.EventSubscription | null>(null);
  const lastFetchedMatchesRef = useRef<number>(0);
  const lastFetchedDiscoveryRef = useRef<number>(0);
  // Debounce ref for the Firebase onChildAdded listener — collapses the burst of
  // initial fires (one per existing conversation) into a single API call.
  const convFetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Stable set of conversation IDs that belong to matched conversations.
  // Used by the new_message notification handler to skip fetching non-matched
  // conversations when the message came from a matched user (no-op update).
  const matchedConvIdsRef = useRef<Set<string>>(new Set());

  // Keep matchedConvIdsRef in sync so the notification handler (which has an empty
  // dependency array and sees stale state) can still check matched conversation IDs.
  useEffect(() => {
    matchedConvIdsRef.current = new Set(
      matches.flatMap(m => [m.conversationId, m.id].filter((id): id is string => Boolean(id)))
    );
  }, [matches]);

  // Fetch daily limits from server on mount (swipes, super likes, premium status)
  useEffect(() => {
    const fetchLimits = async () => {
      try {
        const response = await getDailyLimits();
        if (response.success && response.data) {
          const { is_premium, swipes, super_likes } = response.data;
          setIsPremium(is_premium);
          setSwipesRemaining(swipes.remaining);
          setDailySwipeLimit(swipes.daily_limit);
          setSuperLikesRemaining(super_likes.remaining);
          setSuperLikeDailyLimit(super_likes.daily_limit);
          console.log('[MatchesContext] Daily limits loaded - premium:', is_premium, 'swipes:', swipes.remaining, 'super_likes:', super_likes.remaining);
        }
      } catch (err) {
        console.error('[MatchesContext] Failed to fetch daily limits:', err);
      }
    };

    fetchLimits();
  }, []);

  // Auto-initialize notifications for returning users who already granted permission.
  // On app restart, notificationService.initialize() must run again to register the
  // FCM token with the backend and set up listeners. Without this, returning users
  // would never receive push notifications after restarting the app.
  useEffect(() => {
    const autoInitNotifications = async () => {
      try {
        const hasShown = await AsyncStorage.getItem('notificationModalShown');
        if (hasShown !== 'true') return; // Modal not yet shown, wait for first-match flow

        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') return; // Permission not granted

        console.log('[MatchesContext] Auto-initializing notifications for returning user');
        await notificationService.initialize();
      } catch (error) {
        console.error('[MatchesContext] Auto-init notifications failed:', error);
      }
    };

    autoInitNotifications();
  }, []);

  // Listen for foreground push notifications (new_match + new_message)
  useEffect(() => {
    notifListenerRef.current = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;

      if (data?.type === 'new_match') {
        console.log('[MatchesContext] Received new_match push notification');
        const title = notification.request.content.title || '';
        const body = notification.request.content.body || '';

        // Build minimal profile for navigation
        const toastProfile: Profile = {
          id: (data.related_user_id as string) || '',
          name: title.replace('New Match!', '').trim() || 'Someone',
          age: 0,
          gender: 'other',
          photos: [],
          bio: '',
          location: { city: '' },
        };

        // Extract name from body: "You and {Name} liked each other!"
        const nameMatch = body.match(/You and (.+?) liked/);
        if (nameMatch) {
          toastProfile.name = nameMatch[1];
        }

        setMatchToast({
          name: toastProfile.name,
          photo: '',
          matchId: '',
          conversationId: (data.related_entity_id as string) || '',
          profile: toastProfile,
        });

        // Refresh matches list (bypass cache since this is a real-time event)
        fetchMatchesApi(20, 0).then(res => {
          if (res.success && res.data?.matches) {
            setMatches(res.data.matches.map(apiMatchToMatch));
            lastFetchedMatchesRef.current = Date.now();
          }
        }).catch(err => console.error('[MatchesContext] Failed to refresh matches after new_match:', err));
      }

      // Fix 3: a new_message notification from an unmatched sender means a non-matched
      // conversation now has activity — refresh the conversations list so it appears in inbox.
      // Skip the fetch when the notification belongs to a known matched conversation
      // (no change to non-matched conversations, avoids unnecessary API calls).
      if (data?.type === 'new_message') {
        const notifConvId = data.related_entity_id as string | undefined;
        const isFromMatchedConv = notifConvId
          ? matchedConvIdsRef.current.has(notifConvId)
          : false;

        if (!isFromMatchedConv) {
          console.log('[MatchesContext] Received new_message push from non-matched conv — refreshing conversations');
          fetchConversationsApi()
            .then(res => {
              if (res.success && res.data?.conversations) {
                const nonMatched = res.data.conversations
                  .filter((c: any) => !c.is_matched)
                  .map(apiConversationToMatch);
                setConversations(nonMatched);
              }
            })
            .catch(err => console.error('[MatchesContext] Failed to refresh conversations after new_message:', err));
        }
      }
    });

    return () => {
      notifListenerRef.current?.remove();
    };
  }, []);

  // Fix 2: Firebase real-time listener — detect when a new conversation appears in
  // user_conversations/{userId} (written by backend when another user initiates a chat).
  // onChildAdded fires for ALL existing children on first attach (initial burst), then
  // for new ones. We debounce to collapse the initial burst into a single API call.
  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    console.log('[MatchesContext] Setting up user_conversations Firebase listener for:', userId);

    const unsubscribe = subscribeToUserConversations(userId, (_convId, _otherUserId) => {
      if (convFetchDebounceRef.current) clearTimeout(convFetchDebounceRef.current);
      convFetchDebounceRef.current = setTimeout(() => {
        fetchConversationsApi()
          .then(res => {
            if (res.success && res.data?.conversations) {
              const nonMatched = res.data.conversations
                .filter((c: any) => !c.is_matched)
                .map(apiConversationToMatch);
              setConversations(nonMatched);
              console.log('[MatchesContext] Conversations refreshed via Firebase listener:', nonMatched.length);
            }
          })
          .catch(err => console.error('[MatchesContext] Conversations refresh failed:', err));
      }, 400);
    });

    return () => {
      unsubscribe();
      if (convFetchDebounceRef.current) clearTimeout(convFetchDebounceRef.current);
    };
  }, [isAuthenticated, userId]);


  /**
   * Fetch recommended users from API
   */
  const fetchRecommendedUsers = useCallback(async (limit: number = 20, forceRefresh: boolean = false) => {
    // Skip if recently fetched (prevents duplicate calls from PreloadGate + screen mount)
    if (!forceRefresh && Date.now() - lastFetchedDiscoveryRef.current < CACHE_DURATION && recommendedUsers.length > 0) {
      console.log('[MatchesContext] Using cached recommendations');
      return;
    }

    console.log('[MatchesContext] Fetching recommended users');
    setIsLoading(true);
    setError(null);

    try {
      const response = await getDiscoveryFeed(limit);

      if (response.success && response.data?.profiles) {
        console.log('[MatchesContext] Recommended users:', response.data.profiles.length);
        setRecommendedUsers(response.data.profiles);
        lastFetchedDiscoveryRef.current = Date.now();
      } else if (response.success && !response.data?.profiles) {
        // API succeeded but no profiles data
        console.log('[MatchesContext] No profiles data in response');
        setRecommendedUsers([]);
        lastFetchedDiscoveryRef.current = Date.now();
      } else {
        throw new Error(response.message || 'Failed to fetch recommendations');
      }
    } catch (err) {
      console.error('[MatchesContext] Error fetching recommended users:', err);
      setRecommendedUsers([]); // Set empty array on error
      setError(err instanceof Error ? err.message : 'Failed to load recommendations');
    } finally {
      setIsLoading(false);
    }
  }, [recommendedUsers.length]);

  /**
   * Fetch matches from API
   */
  const fetchMatches = useCallback(async (limit: number = 20, offset: number = 0, forceRefresh: boolean = false) => {
    // Skip if recently fetched and not paginating (prevents duplicate calls from PreloadGate + screen mount)
    if (!forceRefresh && offset === 0 && Date.now() - lastFetchedMatchesRef.current < CACHE_DURATION && matches.length > 0) {
      console.log('[MatchesContext] Using cached matches');
      return;
    }

    console.log('[MatchesContext] Fetching matches', forceRefresh ? '(force)' : '');
    // Don't show loading indicator on background refresh (forceRefresh from screen focus)
    // This prevents loading flashes on other screens that consume isLoading
    if (!forceRefresh) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await fetchMatchesApi(limit, offset);

      if (response.success && response.data?.matches) {
        console.log('[MatchesContext] Matches:', response.data.matches.length);
        const convertedMatches = response.data.matches.map(apiMatchToMatch);
        setMatches(convertedMatches);
        lastFetchedMatchesRef.current = Date.now();
      } else if (response.success && !response.data?.matches) {
        // API succeeded but no matches data
        console.log('[MatchesContext] No matches data in response');
        setMatches([]);
        lastFetchedMatchesRef.current = Date.now();
      } else {
        throw new Error(response.message || 'Failed to fetch matches');
      }
    } catch (err) {
      console.error('[MatchesContext] Error fetching matches:', err);
      if (!forceRefresh) {
        setMatches([]); // Set empty array on error (only for initial loads, not background refresh)
        setError(err instanceof Error ? err.message : 'Failed to load matches');
      }
    } finally {
      if (!forceRefresh) {
        setIsLoading(false);
      }
    }
  }, [matches.length]);

  /**
   * Fetch non-matched direct conversations from GET /conversations.
   * These are conversations initiated from search/explore where is_matched === false.
   * Matched conversations are intentionally excluded here — they are handled by fetchMatches.
   */
  const fetchConversations = useCallback(async () => {
    try {
      const response = await fetchConversationsApi();
      if (response.success && response.data?.conversations) {
        const nonMatched = response.data.conversations
          .filter((c: any) => !c.is_matched)
          .map(apiConversationToMatch);
        setConversations(nonMatched);
        console.log('[MatchesContext] Non-matched conversations:', nonMatched.length);
      }
    } catch (err) {
      console.error('[MatchesContext] Error fetching conversations:', err);
    }
  }, []);

  /**
   * Fetch pending likes (who liked you)
   */
  const fetchPendingLikes = useCallback(async () => {
    console.log('[MatchesContext] Fetching pending likes');
    setIsLoading(true);
    setError(null);

    try {
      const response = await getPendingLikes();

      if (response.success && response.data) {
        console.log('[MatchesContext] Pending likes count:', response.data.count);
        setPendingLikes(response.data);
      } else {
        throw new Error(response.message || 'Failed to fetch pending likes');
      }
    } catch (err) {
      console.error('[MatchesContext] Error fetching pending likes:', err);
      setPendingLikes(null);
      setError(err instanceof Error ? err.message : 'Failed to load pending likes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Swipe on a profile - calls API and handles match detection
   */
  const swipeProfile = useCallback(async (profileId: string, direction: SwipeDirection): Promise<Match | null> => {
    console.log('[MatchesContext] Swiping profile:', profileId, direction);
    setLastSwipe({ profileId, direction });

    // Optimistic UI update
    if (direction === 'left') {
      setPassedProfiles(prev => [...prev, profileId]);
    } else if (direction === 'right') {
      setLikedProfiles(prev => [...prev, profileId]);
    } else if (direction === 'up') {
      setSuperLikedProfiles(prev => [...prev, profileId]);
      setLikedProfiles(prev => [...prev, profileId]);
    }

    // Helper to update swipe limits from any response
    const updateLimitsFromResponse = (data: any) => {
      if ('swipes_remaining' in data) {
        setSwipesRemaining(data.swipes_remaining);
      }
      if ('daily_swipe_limit' in data) {
        setDailySwipeLimit(data.daily_swipe_limit);
      }
      if ('is_premium' in data) {
        setIsPremium(data.is_premium);
      }
      if ('super_likes_remaining' in data) {
        setSuperLikesRemaining(data.super_likes_remaining);
        setSuperLikeDailyLimit(data.daily_limit || 1);
      }
    };

    try {
      if (direction === 'left') {
        // Pass
        const passResponse = await passUser(profileId);
        if (passResponse.success) {
          updateLimitsFromResponse(passResponse.data);
        }
        return null;
      }

      // Like or Super Like
      const response = direction === 'up'
        ? await sendSuperLike(profileId)
        : await sendLike(profileId);

      if (response.success) {
        updateLimitsFromResponse(response.data);

        // Check for match (works for both regular like and super like)
        if ('is_matched' in response.data && response.data.is_matched && response.data.match) {
          console.log('[MatchesContext] It\'s a match!');

          // Get the full profile from recommended users
          const matchedUser = recommendedUsers.find(u => u.user_id === profileId);
          const profile = matchedUser ? apiUserToProfile(matchedUser) : profiles.find(p => p.id === profileId);

          if (profile) {
            const newMatch: Match = {
              id: response.data.match.match_id,
              conversationId: response.data.match.conversation_id,
              matchedAt: new Date(response.data.match.matched_at),
              isActive: response.data.match.is_active,
              isPinned: false, // New matches are not pinned by default
              profile,
              unreadCount: 0,
            };
            setMatches(prev => [newMatch, ...prev]);
            setCurrentMatchNotification(newMatch);
            return newMatch;
          }
        }
      }

      return null;
    } catch (err) {
      console.error('[MatchesContext] Swipe API error:', err);

      // Revert optimistic update on error
      if (direction === 'left') {
        setPassedProfiles(prev => prev.filter(id => id !== profileId));
      } else if (direction === 'right') {
        setLikedProfiles(prev => prev.filter(id => id !== profileId));
      } else if (direction === 'up') {
        setSuperLikedProfiles(prev => prev.filter(id => id !== profileId));
        setLikedProfiles(prev => prev.filter(id => id !== profileId));
      }

      // Show specific error based on status code
      if (err instanceof Error) {
        const errorMessage = err.message.toLowerCase();
        if (errorMessage.includes('daily swipe limit') || errorMessage.includes('swipe limit')) {
          setSwipesRemaining(0);
          setError('SWIPE_LIMIT_REACHED');
        } else if (errorMessage.includes('super like') && errorMessage.includes('limit')) {
          setError('Daily super like limit reached! Upgrade to Premium for more.');
        } else if (errorMessage.includes('yourself')) {
          setError('Cannot like yourself');
        } else if (errorMessage.includes('already')) {
          setError('You already liked this person');
        } else if (errorMessage.includes('not found')) {
          setError('User not found');
        } else {
          setError('Failed to process action. Please try again.');
        }
      } else {
        setError('Network error. Please check your connection.');
      }

      return null;
    }
  }, [profiles, recommendedUsers]);

  const dismissMatchNotification = useCallback(() => {
    setCurrentMatchNotification(null);
  }, []);

  const getAvailableProfiles = useCallback((): Profile[] => {
    const swipedIds = new Set([...likedProfiles, ...passedProfiles]);

    // Convert recommended users from API to Profile format
    const apiProfiles = recommendedUsers.map(apiUserToProfile);

    // Fallback to mock profiles if no API data available yet
    const profileSource = apiProfiles.length > 0 ? apiProfiles : profiles;

    return profileSource.filter(p => !swipedIds.has(p.id));
  }, [profiles, recommendedUsers, likedProfiles, passedProfiles]);

  const undoLastSwipe = useCallback(() => {
    if (!lastSwipe) return;

    const { profileId, direction } = lastSwipe;

    if (direction === 'left') {
      setPassedProfiles(prev => prev.filter(id => id !== profileId));
    } else if (direction === 'right') {
      setLikedProfiles(prev => prev.filter(id => id !== profileId));
    } else if (direction === 'up') {
      setSuperLikedProfiles(prev => prev.filter(id => id !== profileId));
      setLikedProfiles(prev => prev.filter(id => id !== profileId));
    }

    // Remove from matches if it was a match
    setMatches(prev => prev.filter(m => m.profile.id !== profileId));
    setLastSwipe(null);
  }, [lastSwipe]);

  // Find a match by profile name
  const findMatchByName = useCallback((name: string): Match | undefined => {
    return matches.find(m => m.profile.name === name);
  }, [matches]);

  // Create a match for a profile (used when sending compliments from stories)
  const createMatchForProfile = useCallback((profileData: Partial<Profile>): Match => {
    // Check if match already exists
    const existingMatch = matches.find(m =>
      m.profile.name === profileData.name || m.profile.id === profileData.id
    );
    if (existingMatch) return existingMatch;

    // Create a full profile from partial data
    const fullProfile: Profile = {
      id: profileData.id || `profile-${Date.now()}`,
      name: profileData.name || 'Unknown',
      age: profileData.age || 25,
      gender: profileData.gender || 'female',
      interestedIn: profileData.interestedIn || ['male'],
      photos: profileData.photos || [],
      bio: profileData.bio || '',
      interests: profileData.interests || [],
      location: profileData.location || { city: 'Mumbai' },
      preferences: profileData.preferences || { ageRange: { min: 18, max: 40 }, maxDistance: 25 },
      verified: profileData.verified ?? true,
      ...profileData,
    };

    const newMatch: Match = {
      id: `match-${Date.now()}`,
      matchedAt: new Date(),
      isPinned: false, // New matches are not pinned by default
      profile: fullProfile,
      unreadCount: 0,
    };

    setMatches(prev => [newMatch, ...prev]);
    return newMatch;
  }, [matches]);

  /**
   * Pin a match (optimistic UI + API call)
   */
  const pinMatch = useCallback(async (matchId: string) => {
    console.log('[MatchesContext] Pinning match:', matchId);

    // Optimistic UI update
    setMatches(prev =>
      prev.map(match =>
        match.id === matchId ? { ...match, isPinned: true } : match
      )
    );

    try {
      const response = await pinMatchApi(matchId);

      if (!response.success) {
        // Revert on error
        console.error('[MatchesContext] Pin failed:', response.message);
        setMatches(prev =>
          prev.map(match =>
            match.id === matchId ? { ...match, isPinned: false } : match
          )
        );
        setError('Failed to pin conversation');
      }
    } catch (err) {
      console.error('[MatchesContext] Pin API error:', err);
      // Revert on error
      setMatches(prev =>
        prev.map(match =>
          match.id === matchId ? { ...match, isPinned: false } : match
        )
      );
      setError('Failed to pin conversation');
    }
  }, []);

  /**
   * Unpin a match (optimistic UI + API call)
   */
  const unpinMatch = useCallback(async (matchId: string) => {
    console.log('[MatchesContext] Unpinning match:', matchId);

    // Optimistic UI update
    setMatches(prev =>
      prev.map(match =>
        match.id === matchId ? { ...match, isPinned: false } : match
      )
    );

    try {
      const response = await unpinMatchApi(matchId);

      if (!response.success) {
        // Revert on error
        console.error('[MatchesContext] Unpin failed:', response.message);
        setMatches(prev =>
          prev.map(match =>
            match.id === matchId ? { ...match, isPinned: true } : match
          )
        );
        setError('Failed to unpin conversation');
      }
    } catch (err) {
      console.error('[MatchesContext] Unpin API error:', err);
      // Revert on error
      setMatches(prev =>
        prev.map(match =>
          match.id === matchId ? { ...match, isPinned: true } : match
        )
      );
      setError('Failed to unpin conversation');
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const dismissMatchToast = useCallback(() => {
    setMatchToast(null);
  }, []);

  const refreshPremiumStatus = useCallback(async () => {
    try {
      const status = await getSubscriptionStatus();
      setIsPremium(status.is_premium);
    } catch (err) {
      console.error('[MatchesContext] Failed to refresh premium status:', err);
    }
  }, []);

  return (
    <MatchesContext.Provider
      value={{
        matches,
        conversations,
        profiles,
        recommendedUsers,
        likedProfiles,
        passedProfiles,
        superLikedProfiles,
        currentMatchNotification,
        isLoading,
        error,
        pendingLikes,
        superLikesRemaining,
        superLikeDailyLimit,
        swipesRemaining,
        dailySwipeLimit,
        isPremium,
        refreshPremiumStatus,
        swipeProfile,
        dismissMatchNotification,
        getAvailableProfiles,
        undoLastSwipe,
        createMatchForProfile,
        findMatchByName,
        fetchRecommendedUsers,
        fetchMatches,
        fetchConversations,
        fetchPendingLikes,
        pinMatch,
        unpinMatch,
        clearError,
        matchToast,
        dismissMatchToast,
      }}
    >
      {children}
    </MatchesContext.Provider>
  );
};

export const useMatches = (): MatchesContextType => {
  const context = useContext(MatchesContext);
  if (!context) {
    throw new Error('useMatches must be used within a MatchesProvider');
  }
  return context;
};
