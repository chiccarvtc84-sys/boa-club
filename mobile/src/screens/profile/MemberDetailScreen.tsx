/**
 * Fiche détaillée d'un autre membre.
 *
 * Affiche : avatar, nom, ceinture/stripes, bio, disciplines, poids (selon
 * weight_visibility), date d'inscription, dernière connexion. Boutons :
 *   - "Envoyer un message" → ouvre/crée la DM
 *   - "Ajouter en ami" / "Retirer des amis" (toggle selon état)
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { friendsApi } from '../../api/friends';
import { messagesApi } from '../../api/messages';
import { usersApi } from '../../api/users';
import { ApiError } from '../../api/client';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { colors } from '../../theme/colors';
import type { Belt } from '../../types/models';
import type {
  ProfileStackNavigation,
  ProfileStackRoute,
} from '../../navigation/ProfileStack';

interface Props {
  navigation: ProfileStackNavigation<'MemberDetail'>;
  route: ProfileStackRoute<'MemberDetail'>;
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

export function MemberDetailScreen({ navigation, route }: Props) {
  const { userId } = route.params;
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['publicProfile', userId],
    queryFn: () => usersApi.getPublic(userId),
  });

  // Liste amis pour savoir si le user courant a déjà ajouté la cible.
  const friendsQuery = useQuery({
    queryKey: ['friends'],
    queryFn: () => friendsApi.list(),
  });
  const isFriend = !!friendsQuery.data?.friends.find((f) => f.id === userId);

  const addMutation = useMutation({
    mutationFn: () => friendsApi.add(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['friends'] }),
    onError: (err) => {
      const detail =
        err instanceof ApiError && err.code === 'already_friend'
          ? 'Déjà dans tes amis.'
          : "Impossible d'ajouter en ami.";
      Alert.alert('Échec', detail);
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => friendsApi.remove(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['friends'] }),
    onError: () => Alert.alert('Échec', "Impossible de retirer cet ami."),
  });

  const openDMMutation = useMutation({
    mutationFn: () => messagesApi.openDM(userId),
    onError: () => Alert.alert('Échec', "Impossible d'ouvrir la conversation."),
  });

  const [isDMOpening, setIsDMOpening] = useState(false);
  const onSendMessage = async () => {
    try {
      setIsDMOpening(true);
      const res = await openDMMutation.mutateAsync();
      // On navigue via le root navigator vers l'onglet Messages.
      // Simplification : navigate(parent screen 'MessagesTab' avec params),
      // mais ici on n'a que ProfileStack en main → on revient à Profile,
      // puis l'user va tap sur Messages. Pas idéal mais minimal V1.
      Alert.alert(
        'Conversation prête',
        `Va dans l'onglet Messages — la DM avec ${profileQuery.data?.first_name ?? ''} est ouverte.`,
        [
          {
            text: 'OK',
            onPress: () => navigation.popToTop(),
          },
        ],
      );
      // On invalide la liste DM pour qu'elle apparaisse au prochain refresh.
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      // Conversation ID dispo dans `res.conversation_id` pour usage futur.
      void res;
    } finally {
      setIsDMOpening(false);
    }
  };

  const onConfirmRemove = () => {
    Alert.alert(
      'Retirer cet ami ?',
      `${profileQuery.data?.first_name ?? ''} ne sera plus dans ta liste d'amis.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: () => removeMutation.mutate(),
        },
      ],
    );
  };

  if (profileQuery.isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerSimple}>
          <Pressable onPress={() => navigation.goBack()} style={styles.back}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.title}>Chargement…</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (profileQuery.error || !profileQuery.data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerSimple}>
          <Pressable onPress={() => navigation.goBack()} style={styles.back}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.title}>Erreur</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>Impossible de charger ce profil.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const p = profileQuery.data;
  const initials = (p.first_name[0] ?? '?') + (p.last_name_initial[0] ?? '');
  const beltStyle = BELT_COLOR[p.belt];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerSimple}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>
          {p.first_name} {p.last_name_initial}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero : avatar + nom + ceinture */}
        <View style={styles.hero}>
          <Avatar
            initials={initials}
            color={1}
            size={96}
            imageUri={p.avatar_url ?? null}
          />
          <Text style={styles.userName}>
            {p.first_name} {p.last_name_initial}
          </Text>
          {p.role !== 'member' ? (
            <View style={[styles.rolePill, { backgroundColor: colors.primary }]}>
              <Text style={styles.rolePillText}>
                {p.role === 'admin' ? 'Admin' : 'Coach'}
              </Text>
            </View>
          ) : null}
          <View
            style={[
              styles.beltPill,
              {
                backgroundColor: beltStyle.bg,
                borderColor: beltStyle.border,
                borderWidth: beltStyle.border ? 1 : 0,
              },
            ]}
          >
            <Text style={[styles.beltText, { color: beltStyle.text }]}>
              {BELT_LABEL[p.belt]}
              {p.stripes > 0
                ? ` · ${p.stripes} stripe${p.stripes > 1 ? 's' : ''}`
                : ''}
            </Text>
          </View>
        </View>

        {/* Bio */}
        {p.bio ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>À propos</Text>
            <Text style={styles.bio}>{p.bio}</Text>
          </View>
        ) : null}

        {/* Stats */}
        <View style={styles.statGrid}>
          {p.weight_kg != null ? (
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{p.weight_kg} kg</Text>
              <Text style={styles.statLabel}>Poids</Text>
            </View>
          ) : null}
          {p.disciplines.length > 0 ? (
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{p.disciplines.length}</Text>
              <Text style={styles.statLabel}>Disciplines</Text>
            </View>
          ) : null}
        </View>

        {p.disciplines.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Disciplines pratiquées</Text>
            <View style={styles.disciplinesRow}>
              {p.disciplines.map((d) => (
                <View key={d} style={styles.disciplinePill}>
                  <Text style={styles.disciplineText}>{d}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Métadonnées */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activité</Text>
          <Text style={styles.metaLine}>
            Membre depuis {formatJoinDate(p.joined_at)}
          </Text>
          {p.last_login_at ? (
            <Text style={styles.metaLine}>
              Dernière connexion : {formatRelative(p.last_login_at)}
            </Text>
          ) : null}
        </View>

        {/* Actions */}
        <Button
          label="Envoyer un message"
          onPress={onSendMessage}
          loading={isDMOpening}
          full
          style={{ marginTop: 20 }}
        />
        {isFriend ? (
          <Button
            label="Retirer des amis"
            variant="outline"
            onPress={onConfirmRemove}
            loading={removeMutation.isPending}
            full
            style={{ marginTop: 10 }}
          />
        ) : (
          <Button
            label="Ajouter en ami"
            variant="outline"
            onPress={() => addMutation.mutate()}
            loading={addMutation.isPending}
            full
            style={{ marginTop: 10 }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatJoinDate(iso: string): string {
  const d = new Date(iso);
  const months = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 5) return 'en ligne';
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `il y a ${diffD}j`;
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  headerSimple: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    gap: 8,
  },
  back: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 22, color: colors.black, lineHeight: 22 },
  title: { fontSize: 16, fontWeight: '600', color: colors.black, flex: 1 },

  scroll: { padding: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 13, color: colors.primary, textAlign: 'center' },

  hero: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  userName: { fontSize: 20, fontWeight: '700', color: colors.black, marginTop: 8 },
  rolePill: { paddingHorizontal: 11, paddingVertical: 4, borderRadius: 999 },
  rolePillText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  beltPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  beltText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },

  section: { marginTop: 18 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gray600,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  bio: { fontSize: 13.5, color: colors.gray700, lineHeight: 19 },
  metaLine: { fontSize: 12.5, color: colors.gray600, marginTop: 3 },

  statGrid: { flexDirection: 'row', gap: 8, marginTop: 16 },
  statCard: {
    flex: 1,
    backgroundColor: colors.black,
    padding: 12,
    borderRadius: 10,
  },
  statNum: { fontSize: 19, fontWeight: '700', color: colors.white },
  statLabel: {
    fontSize: 10.5,
    color: colors.gray300,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 1,
  },

  disciplinesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  disciplinePill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.gray100,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  disciplineText: { fontSize: 11.5, color: colors.black, fontWeight: '600' },
});
