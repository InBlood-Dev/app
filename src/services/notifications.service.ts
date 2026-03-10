import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { post } from './api';
import { navigate } from '../utils/navigationRef';
import { Profile } from '../types';

interface RegisterTokenResponse {
  success: boolean;
  message?: string;
}

class NotificationService {
  private fcmToken: string | null = null;
  private notificationListener: any = null;
  private responseListener: any = null;
  private tokenRefreshListener: any = null;

  /**
   * Initialize notifications and request permission
   * @returns true if permission granted and token registered
   */
  async initialize(): Promise<boolean> {
    console.log('[Notifications] Initializing...');

    // Configure foreground notification handling
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const data = notification.request.content.data;
        // Suppress match notifications in foreground (MatchesContext handles the toast)
        if (data?.type === 'new_match') {
          return { shouldShowAlert: false, shouldPlaySound: false, shouldSetBadge: false };
        }
        return { shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true };
      },
    });

    // Create Android notification channels early — required for Android 8+ (API 26+).
    // If channels don't exist when a notification arrives, it's silently dropped.
    // Safe to call multiple times (no-op if channel already exists).
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FFE53935',
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('matches', {
        name: 'Matches',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FFE53935',
        sound: 'default',
      });
    }

    // Check if physical device (push notifications don't work on simulator)
    if (!Device.isDevice) {
      console.warn('[Notifications] Push notifications only work on physical devices');
      this.setupListeners();
      return false;
    }

    try {
      // Request permission
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('[Notifications] Permission denied');
        return false;
      }

      console.log('[Notifications] Permission granted');

      // Get raw FCM token (bypasses Expo Push API entirely)
      const tokenData = await Notifications.getDevicePushTokenAsync();
      this.fcmToken = tokenData.data;
      console.log('[Notifications] FCM Token:', this.fcmToken);

      // Register token with backend
      await this.registerToken();

      // Set up notification listeners
      this.setupListeners();

      // Handle case where app was opened from a notification tap (app was killed)
      this.handleInitialNotification();

      console.log('[Notifications] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[Notifications] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Register push token with backend
   */
  private async registerToken(): Promise<void> {
    if (!this.fcmToken) {
      console.error('[Notifications] No token to register');
      return;
    }

    try {
      const deviceId = `${Platform.OS}-${Device.modelName || 'device'}`;
      const response = await post<RegisterTokenResponse>('/notifications/register-token', {
        fcm_token: this.fcmToken,
        device_id: deviceId,
        device_type: Platform.OS === 'ios' ? 'iOS' : 'Android',
        device_name: Device.deviceName || Device.modelName || undefined,
      });

      if (!response.success) {
        throw new Error(response.message || 'Failed to register token');
      }

      console.log('[Notifications] Token registered with backend, device:', deviceId);
    } catch (error) {
      console.error('[Notifications] Failed to register token:', error);
      throw error;
    }
  }

  /**
   * Set up notification event listeners
   */
  private setupListeners(): void {
    console.log('[Notifications] Setting up listeners');

    // Listener for notifications received while app is in foreground
    this.notificationListener = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[Notifications] Received in foreground:', notification.request.content.title);
    });

    // Listener for when user taps on notification
    this.responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('[Notifications] User tapped notification');
      this.handleNotificationTap(response.notification);
    });

    // Listener for FCM token refresh — re-register with backend when token changes
    this.tokenRefreshListener = Notifications.addPushTokenListener((newToken) => {
      console.log('[Notifications] Token refreshed:', newToken.data);
      this.fcmToken = newToken.data;
      this.registerToken().catch(err =>
        console.log('[Notifications] Token refresh registration failed:', err.message)
      );
    });
  }

  /**
   * Check if app was launched from a notification tap (app was killed/background)
   */
  private async handleInitialNotification(): Promise<void> {
    try {
      const response = await Notifications.getLastNotificationResponseAsync();
      if (response) {
        console.log('[Notifications] App opened from notification');
        // Delay to ensure navigation container is mounted and ready
        setTimeout(() => {
          this.handleNotificationTap(response.notification);
        }, 1000);
      }
    } catch (error) {
      console.error('[Notifications] Failed to get initial notification:', error);
    }
  }

  /**
   * Handle notification tap — navigate to the relevant chat screen.
   * Both new_message and new_match notifications open the chat directly.
   */
  private handleNotificationTap(notification: Notifications.Notification): void {
    const data = notification.request.content.data;
    const title = notification.request.content.title || '';
    const body = notification.request.content.body || '';

    console.log('[Notifications] Handling tap — type:', data?.type);

    const conversationId = (data?.related_entity_id as string) || '';
    const relatedUserId = (data?.related_user_id as string) || '';

    if (!conversationId) {
      console.log('[Notifications] No conversation ID, skipping navigation');
      return;
    }

    if (data?.type === 'new_message') {
      // Message notification: title = sender name
      const profile = this.buildMinimalProfile(relatedUserId, title);
      navigate('ChatScreen', { matchId: '', conversationId, profile });
    } else if (data?.type === 'new_match') {
      // Match notification: extract name from body "You and {Name} liked each other!"
      let name = title || 'Someone';
      const nameMatch = body.match(/You and (.+?) liked/);
      if (nameMatch) {
        name = nameMatch[1];
      }
      const profile = this.buildMinimalProfile(relatedUserId, name);
      navigate('ChatScreen', { matchId: '', conversationId, profile });
    }
  }

  /**
   * Build a minimal Profile from notification data (name + userId).
   * ChatScreen will work fine — messages load from Firebase, header shows the name.
   */
  private buildMinimalProfile(userId: string, name: string): Profile {
    return {
      id: userId,
      name: name || 'Someone',
      age: 0,
      gender: 'other',
      photos: [],
      bio: '',
      location: { city: '' },
    };
  }

  /**
   * Unregister token and cleanup listeners
   */
  async unregister(): Promise<void> {
    console.log('[Notifications] Unregistering...');

    try {
      if (this.fcmToken) {
        const deviceId = `${Platform.OS}-${Device.modelName || 'device'}`;
        await post('/notifications/unregister-token', { device_id: deviceId });
        this.fcmToken = null;
      }

      if (this.notificationListener) {
        Notifications.removeNotificationSubscription(this.notificationListener);
        this.notificationListener = null;
      }

      if (this.responseListener) {
        Notifications.removeNotificationSubscription(this.responseListener);
        this.responseListener = null;
      }

      if (this.tokenRefreshListener) {
        this.tokenRefreshListener.remove();
        this.tokenRefreshListener = null;
      }

      console.log('[Notifications] Unregistered successfully');
    } catch (error) {
      console.error('[Notifications] Unregister failed:', error);
    }
  }

  /**
   * Check if notifications are enabled
   */
  async isEnabled(): Promise<boolean> {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  }

  /**
   * Get current FCM token
   */
  getToken(): string | null {
    return this.fcmToken;
  }
}

export const notificationService = new NotificationService();
