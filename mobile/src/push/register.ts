/**
 * Demande la permission de push, récupère le token Expo Push, et l'envoie au backend.
 *
 * À appeler après login/register. Ne fait rien (silencieusement) si :
 * - on tourne sur Web ou simulator (push non supporté)
 * - l'utilisateur refuse la permission
 * - on n'a pas de FCM/APNs config (Expo Go vs dev build)
 *
 * Côté backend, le token est stocké dans users.fcm_token et utilisé pour
 * envoyer les push (broadcast, retard/absence, message reçu, etc.).
 */
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { meApi } from '../api/me';

export async function registerForPushAsync(): Promise<void> {
  // Sur web, expo-notifications n'a pas le mécanisme push (à part SW custom).
  if (Platform.OS === 'web') return;

  // Sur simulateur iOS, les push ne fonctionnent pas (besoin d'un vrai device).
  if (!Device.isDevice) return;

  try {
    // Permission OS.
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    // Channel par défaut sur Android (obligatoire depuis Android 8).
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Notifications',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        lightColor: '#DC2626',
      });
    }

    // Token Expo Push (compatible avec FCM côté Expo).
    // En dev build natif avec googleServicesFile configuré, on récupère le FCM token natif.
    // En Expo Go ou web : on récupère le token Expo Push (utilisable via Expo's push service).
    const tokenResult = await Notifications.getExpoPushTokenAsync({
      projectId: undefined, // auto-détecté depuis app.json
    });
    const token = tokenResult.data;
    if (!token) return;

    await meApi.setFCMToken(token);
  } catch {
    // Erreur silencieuse : un échec d'enregistrement push ne doit pas bloquer
    // le login. L'utilisateur peut toujours utiliser l'app sans notif.
  }
}

/** À appeler au logout pour ne plus recevoir de push sur ce device. */
export async function unregisterPushAsync(): Promise<void> {
  try {
    await meApi.clearFCMToken();
  } catch {
    // ignore
  }
}
