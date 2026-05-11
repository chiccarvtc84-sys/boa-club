import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { authApi } from '../../api/auth';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { useAuthStore } from '../../store/authStore';
import { useNotificationsStore } from '../../store/notificationsStore';
import { colors } from '../../theme/colors';
import type { Belt } from '../../types/models';
import type { ProfileStackNavigation } from '../../navigation/ProfileStack';

interface ProfileScreenProps {
  navigation: ProfileStackNavigation<'ProfileMain'>;
}

const BELT_LABEL: Record<Belt, string> = {
  white: 'Blanche',
  blue: 'Bleue',
  purple: 'Violette',
  brown: 'Marron',
  black: 'Noire',
};
const BELT_COLOR: Record<Belt, { bg: string; text: string; border?: string }> = {
  white: { bg: colors.white, text: colors.black, border: colors.black },
  blue: { bg: colors.belt.blue, text: colors.white },
  purple: { bg: colors.belt.purple, text: colors.white },
  brown: { bg: colors.belt.brown, text: colors.white },
  black: { bg: colors.belt.black, text: colors.white },
};

const VISIBILITY_LABEL: Record<string, string> = {
  public: 'Public',
  members: 'Adhérents seulement',
  private: 'Privé',
};

export function ProfileScreen({ navigation }: ProfileScreenProps) {
  const user = useAuthStore((s) => s.user);
  const tokens = useAuthStore((s) => s.tokens);
  const clearSession = useAuthStore((s) => s.clearSession);
  const followedCount = useNotificationsStore((s) => s.followed.size);
  const isAdminOrCoach = user?.role === 'admin' || user?.role === 'coach';

  if (!user) return null;

  const onLogout = async () => {
    // Best-effort : effacer le FCM token + révoquer le refresh côté serveur.
    // On ne BLOQUE PAS la déconnexion locale si l'une de ces deux étapes échoue
    // (ex: hors-ligne, expo-notifications indisponible sur web, etc.).
    try {
      const { unregisterPushAsync } = await import('../../push/register');
      unregisterPushAsync().catch(() => {});
    } catch {
      // import dynamique a échoué (ex: web sans expo-notifications) → on continue.
    }
    if (tokens?.refresh_token) {
      authApi.logout(tokens.refresh_token).catch(() => {});
    }
    await clearSession();
  };

  const initials = (user.first_name[0] + user.last_name_initial[0]).toUpperCase();
  const beltStyle = BELT_COLOR[user.belt];
  const beltLabel = `${BELT_LABEL[user.belt]}${user.stripes ? ` · ${user.stripes} stripe${user.stripes > 1 ? 's' : ''}` : ''}`;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Profil</Text>
          <Text style={styles.subtitle}>
            {user.first_name} {user.last_name_initial}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/*
          Tâche 6 : bandeau club avec dégradé (noir → rouge sombre → rouge Bōa)
          inspiré du logo officiel du club. Logo intégré à gauche, texte en
          blanc pour le contraste.
        */}
        <LinearGradient
          colors={['#0A0A0A', '#1a1a1a', '#7A1818', '#DC2626']}
          // `locations` resserrent la zone rouge sur la droite : la majorité
          // du bandeau reste noire, le rouge n'apparaît que sur ~12% à droite.
          locations={[0, 0.6, 0.92, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.clubBanner}
        >
          <View style={styles.clubBannerText}>
            <Text style={styles.clubName}>Clube Desportivo Boa</Text>
            <Text style={styles.clubLoc}>Sorgues · Vedène · Membre actif</Text>
          </View>
        </LinearGradient>

        {/* Hero */}
        <View style={styles.hero}>
          <Avatar initials={initials} color={1} size={60} imageUri={user.avatar_url} />
          <View style={styles.heroText}>
            <Text style={styles.userName}>
              {user.first_name} {user.last_name_initial}
            </Text>
            <View style={styles.beltRow}>
              <View
                style={[
                  styles.beltPill,
                  { backgroundColor: beltStyle.bg, borderColor: beltStyle.border, borderWidth: beltStyle.border ? 1 : 0 },
                ]}
              >
                <Text style={[styles.beltText, { color: beltStyle.text }]}>{beltLabel}</Text>
              </View>
              {user.weight_kg ? (
                <Text style={styles.weight}>{user.weight_kg} kg</Text>
              ) : null}
            </View>
          </View>
        </View>

        <Button
          label="Modifier mon profil"
          variant="outline"
          onPress={() => navigation.navigate('EditProfile')}
          full
          style={{ marginBottom: 14 }}
        />

        {isAdminOrCoach ? (
          <Pressable
            style={styles.coachLink}
            onPress={() => navigation.navigate('AdminDashboard')}
          >
            <Text style={styles.coachIcon}>🛡️</Text>
            <Text style={styles.coachText}>Espace coach &amp; admin</Text>
            <Text style={styles.coachArrow}>›</Text>
          </Pressable>
        ) : null}

        <View style={styles.statGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{followedCount}</Text>
            <Text style={styles.statLabel}>Cours suivis</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>0</Text>
            <Text style={styles.statLabel}>Créneaux à venir</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Communauté</Text>

        <Pressable
          style={styles.kvRow}
          onPress={() => navigation.navigate('Friends')}
        >
          <Text style={styles.kvLabel}>Mes amis</Text>
          <View style={styles.kvValue}>
            <Text style={styles.kvValueText}>👥</Text>
            <Text style={styles.kvArrow}>›</Text>
          </View>
        </Pressable>

        <Pressable
          style={styles.kvRow}
          onPress={() => navigation.navigate('MembersSearch')}
        >
          <Text style={styles.kvLabel}>Rechercher un membre</Text>
          <View style={styles.kvValue}>
            <Text style={styles.kvValueText}>🔍</Text>
            <Text style={styles.kvArrow}>›</Text>
          </View>
        </Pressable>

        <Text style={styles.sectionTitle}>Réglages</Text>

        <Pressable
          style={styles.kvRow}
          onPress={() => navigation.navigate('NotificationsSettings')}
        >
          <Text style={styles.kvLabel}>Notifications</Text>
          <View style={styles.kvValue}>
            <Text style={styles.kvValueText}>{followedCount} cours suivis</Text>
            <Text style={styles.kvArrow}>›</Text>
          </View>
        </Pressable>

        <Pressable
          style={styles.kvRow}
          onPress={() => navigation.navigate('WeightVisibility')}
        >
          <Text style={styles.kvLabel}>Visibilité du poids</Text>
          <View style={styles.kvValue}>
            <Text style={styles.kvValueText}>
              {VISIBILITY_LABEL[user.weight_visibility]}
            </Text>
            <Text style={styles.kvArrow}>›</Text>
          </View>
        </Pressable>

        <Pressable style={styles.kvRow} onPress={onLogout}>
          <Text style={[styles.kvLabel, { color: colors.primary }]}>
            Se déconnecter
          </Text>
          <Text style={[styles.kvArrow, { color: colors.primary }]}>›</Text>
        </Pressable>

        <Pressable
          style={styles.deleteLink}
          onPress={() => navigation.navigate('DeleteAccount')}
        >
          <Text style={styles.deleteLinkText}>Supprimer mon compte</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  header: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 16, fontWeight: '600', color: colors.black },
  subtitle: { fontSize: 11, color: colors.gray500, marginTop: 1 },
  scroll: { padding: 14 },
  clubBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    marginBottom: 14,
    // Légère ombre pour donner de la profondeur au bandeau dégradé.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  clubBannerText: { flex: 1, minWidth: 0 },
  clubName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 0.3,
  },
  clubLoc: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 3,
    letterSpacing: 0.2,
  },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  heroText: { flex: 1 },
  userName: { fontSize: 17, fontWeight: '600', color: colors.black },
  beltRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  beltPill: { paddingHorizontal: 9, paddingVertical: 2, borderRadius: 999 },
  beltText: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.2 },
  weight: { fontSize: 11, color: colors.gray600 },
  coachLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.primary,
    marginBottom: 14,
  },
  coachIcon: { fontSize: 18 },
  coachText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.white },
  coachArrow: { fontSize: 16, color: colors.white },
  statGrid: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: colors.black,
    padding: 12,
    borderRadius: 10,
  },
  statNum: { fontSize: 20, fontWeight: '700', color: colors.white },
  statLabel: {
    fontSize: 10.5,
    color: colors.gray300,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.black,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 4,
    marginBottom: 4,
  },
  kvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  kvLabel: { fontSize: 13, fontWeight: '500', color: colors.black },
  kvValue: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  kvValueText: { fontSize: 12.5, color: colors.gray600 },
  kvArrow: { fontSize: 14, color: colors.gray400 },
  deleteLink: {
    alignItems: 'center',
    paddingVertical: 18,
    marginTop: 24,
  },
  deleteLinkText: {
    fontSize: 12,
    color: colors.gray400,
    textDecorationLine: 'underline',
  },
});
