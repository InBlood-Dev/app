import PostHog from 'posthog-react-native';
import type { PostHogEventProperties } from '@posthog/core';
import * as Clarity from 'react-native-clarity';

const POSTHOG_API_KEY = 'your_posthog_project_api_key';
const POSTHOG_HOST = 'https://us.i.posthog.com';
const CLARITY_PROJECT_ID = 'your_clarity_project_id';

let posthogClient: PostHog | null = null;
let initPromise: Promise<void> | null = null;

export function initAnalytics(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // Initialize PostHog
    if (POSTHOG_API_KEY && POSTHOG_API_KEY !== 'your_posthog_project_api_key') {
      posthogClient = new PostHog(POSTHOG_API_KEY, {
        host: POSTHOG_HOST,
      });
      await posthogClient.ready();
    }

    // Initialize Clarity
    if (CLARITY_PROJECT_ID && CLARITY_PROJECT_ID !== 'your_clarity_project_id') {
      Clarity.initialize(CLARITY_PROJECT_ID);
    }
  })();

  return initPromise;
}

export function getPostHog(): PostHog | null {
  return posthogClient;
}

/** Identify user across both analytics platforms */
export function identifyUser(userId: string, properties?: PostHogEventProperties) {
  posthogClient?.identify(userId, properties);
  if (CLARITY_PROJECT_ID && CLARITY_PROJECT_ID !== 'your_clarity_project_id') {
    Clarity.setCustomUserId(userId);
  }
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
