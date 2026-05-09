import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';

interface PlaceholderScreenProps {
  title: string;
  description?: string;
}

/**
 * Écran factice pour les tabs Planning / Slots / Messages / Profile tant que
 * leur contenu réel n'est pas codé. On y met aussi le bouton "Se déconnecter"
 * pour pouvoir tester le flow auth de bout en bout.
 */
export function PlaceholderScreen({
  title,
  description = 'Cet écran sera implémenté dans une prochaine étape.',
}: PlaceholderScreenProps) {
  const tokens = useAuthStore((s) => s.tokens);
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);

  const onLogout = async () => {
    if (tokens?.refresh_token) {
      // Best-effort : on tente de révoquer côté serveur, mais on déconnecte
      // localement quoi qu'il arrive.
      authApi.logout(tokens.refresh_token).catch(() => {});
    }
    await clearSession();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.desc}>{description}</Text>
        {user ? (
          <View style={styles.userBox}>
            <Text style={styles.userLabel}>Connecté en tant que</Text>
            <Text style={styles.userName}>
              {user.first_name} {user.last_name_initial}
            </Text>
            <Text style={styles.userEmail}>{user.email}</Text>
          </View>
        ) : null}
        <Button label="Se déconnecter" onPress={onLogout} variant="outline" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  center: { flex: 1, padding: 22, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: colors.black, marginBottom: 8 },
  desc: {
    fontSize: 13,
    color: colors.gray500,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  userBox: {
    backgroundColor: colors.gray50,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 24,
    minWidth: 240,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  userLabel: {
    fontSize: 11,
    color: colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  userName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.black,
    marginTop: 4,
  },
  userEmail: { fontSize: 12, color: colors.gray600, marginTop: 2 },
});
