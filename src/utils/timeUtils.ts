/**
 * Time utility functions for formatting timestamps and durations
 */

/**
 * Format story expiry countdown
 * @param expiresAt - The expiration date of the story
 * @returns Formatted string like "23h left", "45m left", or "Expired"
 */
export const formatStoryExpiry = (expiresAt: Date | string): string => {
  const expiryDate = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  const now = new Date();
  const diffMs = expiryDate.getTime() - now.getTime();

  // If expired
  if (diffMs <= 0) {
    return 'Expired';
  }

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  // Less than 1 hour
  if (diffHours < 1) {
    if (diffMinutes < 1) {
      return '< 1m left';
    }
    return `${diffMinutes}m left`;
  }

  // Less than 24 hours
  if (diffHours < 24) {
    return `${diffHours}h left`;
  }

  // More than 24 hours (shouldn't happen for stories, but handle it)
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d left`;
};

/**
 * Compute online status from a last-active timestamp.
 * < 5 min  → Online (isOnline: true)
 * 5-60 min → "Active Xm ago"
 * 1-24 hr  → "Active Xh ago"
 * > 24 hr  → "Active Xd ago"
 */
export const getOnlineStatus = (
  lastActive?: Date | string | null,
): { text: string; isOnline: boolean } => {
  if (!lastActive) return { text: 'Offline', isOnline: false };
  const diffMs = Date.now() - new Date(lastActive).getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 5) return { text: 'Online', isOnline: true };
  if (diffMin < 60) return { text: `Active ${diffMin}m ago`, isOnline: false };

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return { text: `Active ${diffHr}h ago`, isOnline: false };

  const diffDays = Math.floor(diffHr / 24);
  return { text: `Active ${diffDays}d ago`, isOnline: false };
};

/**
 * Simple boolean check: is the user online (active within 5 min)?
 */
export const isUserOnline = (lastActive?: Date | string | null): boolean => {
  if (!lastActive) return false;
  return Date.now() - new Date(lastActive).getTime() < 5 * 60 * 1000;
};

/**
 * Format relative time (e.g., "2h ago", "just now")
 * @param timestamp - The timestamp to format
 * @returns Formatted relative time string
 */
export const formatRelativeTime = (timestamp: Date | string): string => {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  // Just now (less than 1 minute)
  if (diffMs < 60 * 1000) {
    return 'just now';
  }

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Less than 1 hour
  if (diffHours < 1) {
    return `${diffMinutes}m ago`;
  }

  // Less than 24 hours
  if (diffDays < 1) {
    return `${diffHours}h ago`;
  }

  // Less than 7 days
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  // More than 7 days
  const diffWeeks = Math.floor(diffDays / 7);
  return `${diffWeeks}w ago`;
};
