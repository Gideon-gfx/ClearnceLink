import { useEffect } from 'react';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiRequest } from '../api';

let currentPushToken = null;

export function usePushNotifications(session) {
  const token = session?.token;
  const role = session?.user?.role;
  useEffect(() => {
    if (!token || !['student', 'staff', 'institution'].includes(role) || Platform.OS === 'web') return;
    // Expo Go cannot receive remote pushes in SDK 57. A development/production build is required.
    if (Constants.appOwnership === 'expo') return;
    const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId || process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    if (!projectId) return;
    let live = true;
    (async () => {
      try {
        const Notifications = await import('expo-notifications');
        Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
        if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('clearance-updates', { name: 'Clearance updates', importance: Notifications.AndroidImportance.HIGH, sound: 'default' });
        const existing = await Notifications.getPermissionsAsync();
        const permission = existing.granted ? existing : await Notifications.requestPermissionsAsync();
        if (!permission.granted || !live) return;
        const pushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        if (!live) return;
        await apiRequest('/api/push-tokens', { pushToken, platform: Platform.OS }, token, 'POST');
        currentPushToken = pushToken;
      } catch (error) { console.warn('Push notifications could not be enabled:', error.message); }
    })();
    return () => { live = false; };
  }, [token, role]);
}

export async function unregisterPushNotifications(sessionToken) {
  if (!sessionToken || !currentPushToken) return;
  const pushToken = currentPushToken;
  currentPushToken = null;
  try { await apiRequest('/api/push-tokens', { pushToken }, sessionToken, 'DELETE'); }
  catch (error) { console.warn('Could not remove this device notification token:', error.message); }
}
