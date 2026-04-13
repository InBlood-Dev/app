import PostHog from 'posthog-react-native';
import type { PostHogEventProperties } from '@posthog/core';
import * as Clarity from 'react-native-clarity';

const POSTHOG_API_KEY = 'phc_o2JghjxK2UTJvUJKiA5tvPZbuZgK98ahpR7GxMirRdnk';
const POSTHOG_HOST = 'https://us.i.posthog.com';
const CLARITY_PROJECT_ID = 'w6giyz4fgc';

let posthogClient: PostHog | null = null;
let initPromise: Promise<void> | null = null;

export function initAnalytics(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // Initialize PostHog
    posthogClient = new PostHog(POSTHOG_API_KEY, {
      host: POSTHOG_HOST,
    });
    await posthogClient.ready();

    // Initialize Clarity
    Clarity.initialize(CLARITY_PROJECT_ID);
  })();

  return initPromise;
}

export function getPostHog(): PostHog | null {
  return posthogClient;
}

/** Identify user across both analytics platforms */
export function identifyUser(userId: string, properties?: PostHogEventProperties) {
  posthogClient?.identify(userId, properties);
  Clarity.setCustomUserId(userId);
}

/** Track a custom event in PostHog */
export function trackEvent(event: string, properties?: PostHogEventProperties) {
  posthogClient?.capture(event, properties);
}

/** Track screen view in PostHog */
export function trackScreen(screenName: string, properties?: PostHogEventProperties) {
  posthogClient?.screen(screenName, properties);
}

/** Reset analytics on logout */
export function resetAnalytics() {
  posthogClient?.reset();
}
