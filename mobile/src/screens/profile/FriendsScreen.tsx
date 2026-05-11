/**
 * Mes amis : liste avec toggle notifs, retrait, et accès à la recherche
 * pour en ajouter de nouveaux.
 *
 * Tap sur une ligne → MemberDetailScreen (où on peut retirer + envoyer DM).
 * Tap sur 🔔 → toggle notifications (optimistic update via React Query).
 * Tap sur bouton "+" en haut → MembersSearchScreen.
 */
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { friendsApi, type FriendDTO } from '../../api/friends';
import { Avatar } from '../../components/Avatar';
import { colors } from '../../theme/colors';
import type { Belt } from '../../types/models';
import type { ProfileStackNavigation } from '../../navigation/ProfileStack';

interface Props {
  navigation: ProfileStackNavigation<'Friends'>;
}

const BELT_LABEL: Record<Belt, string> = {
  white: 'Blanche',
  blue: 'Bleue',
  purple: 'Violette',
  brown: 'Marron',
  black: 'Noire',
};

export function FriendsScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['friends'],
    queryFn: () => friendsApi.list(),
  });

  const toggleNotifsMutation = useMutation({
    mutationFn: (params: { friendID: string; enabled: boolean }) =>
      friendsApi.setNotifications(params.friendID, params.enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['friends'] }),
    onError: () => Alert.alert('Échec', 'Impossible de changer les notifs.'),
  });

  const removeMutation = useMutation({
    mutationFn: (friendID: string) => friendsApi.remove(friendID),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['friends'] }),
    onError: () => Alert.alert('Échec', "Impossible de retirer cet ami."),
  });

  const friends = data?.friends ?? [];

  const onConfirmRemove = (friend: FriendDTO) => {
    Alert.alert(
      'Retirer cet ami ?',
      `${friend.first_name} ne sera plus dans ta liste.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: () => removeMutation.mutate(friend.id),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Mes amis</Text>
          <Text style={styles.subtitle}>
            {friends.length} ami{friends.length > 1 ? 's' : ''}
          </Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate('MembersSearch')}
          style={styles.addBtn}
        >
          <Text style={styles.addBtnText}>+ Ajouter</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>Impossible de charger tes amis.</Text>
        ) : friends.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>Pas encore d'amis</Text>
            <Text style={styles.emptyText}>
              Trouve des membres du club et ajoute-les pour suivre leur activité
              et discuter facilement.
            </Text>
            <Pressable
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('MembersSearch')}
            >
              <Text style={styles.emptyBtnText}>Rechercher un membre</Text>
            </Pressable>
          </View>
        ) : (
          friends.map((f) => (
            <FriendRow
              key={f.id}
              friend={f}
              onPress={() => navigation.navigate('MemberDetail', { userId: f.id })}
              onToggleNotifs={(enabled) =>
                toggleNotifsMutation.mutate({ friendID: f.id, enabled })
              }
              onRemove={() => onConfirmRemove(f)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

interface FriendRowProps {
  friend: FriendDTO;
  onPress: () => void;
  onToggleNotifs: (enabled: boolean) => void;
  onRemove: () => void;
}

function FriendRow({ friend, onPress, onToggleNotifs, onRemove }: FriendRowProps) {
  const initials =
    (friend.first_name[0] ?? '?') + (friend.last_name_initial[0] ?? '');
  const isOnline = friend.last_login_at && isRecent(friend.last_login_at);

  return (
    <View style={styles.row}>
      <Pressable style={styles.rowMain} onPress={onPress}>
        <View>
          <Avatar
            initials={initials}
            color={friend.role === 'member' ? 1 : 2}
            size={44}
            imageUri={friend.avatar_url ?? null}
          />
          {isOnline ? <View style={styles.onlineDot} /> : null}
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.name} numberOfLines={1}>
            {friend.first_name} {friend.last_name_initial}
          </Text>
          <Text style={styles.subline} numberOfLines={1}>
            {/*
              Coach/Admin : on affiche "Coach" / "Admin" à la place de la
              ceinture. Sinon : ceinture + stripes habituels.
            */}
            {friend.role === 'coach'
              ? 'Coach'
              : friend.role === 'admin'
                ? 'Admin'
                : `${BELT_LABEL[friend.belt]}${friend.stripes > 0 ? ` · ${friend.stripes} stripe${friend.stripes > 1 ? 's' : ''}` : ''}`}
            {isOnline ? ' · 🟢 En ligne' : friend.last_login_at ? ` · ${formatLastSeen(friend.last_login_at)}` : ''}
          </Text>
        </View>
      </Pressable>

      <View style={styles.rowActions}>
        <View style={styles.notifSwitchWrap}>
          <Text style={styles.bellIcon}>{friend.notifications_enabled ? '🔔' : '🔕'}</Text>
          <Switch
            value={friend.notifications_enabled}
            onValueChange={onToggleNotifs}
            trackColor={{ false: colors.gray300, true: colors.primary }}
            thumbColor={colors.white}
            ios_backgroundColor={colors.gray300}
            style={styles.switch}
          />
        </View>
        <Pressable onPress={onRemove} style={styles.removeBtn}>
          <Text style={styles.removeBtnText}>✕</Text>
        </Pressable>
      </View>
    </View>
  );
}

function isRecent(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < 5 * 60 * 1000;
}

function formatLastSeen(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `vu il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vu il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `vu il y a ${d}j`;
  return 'vu il y a longtemps';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  header: {
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
  title: { fontSize: 16, fontWeight: '600', color: colors.black },
  subtitle: { fontSize: 11, color: colors.gray500, marginTop: 1 },
  addBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  addBtnText: { color: colors.white, fontSize: 12, fontWeight: '700' },

  scroll: { paddingBottom: 24 },
  center: { paddingVertical: 50, alignItems: 'center' },
  errorText: { fontSize: 13, color: colors.primary, textAlign: 'center', paddingVertical: 30 },

  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.black, marginBottom: 6 },
  emptyText: { fontSize: 13, color: colors.gray600, textAlign: 'center', lineHeight: 19, marginBottom: 18 },
  emptyBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  emptyBtnText: { color: colors.white, fontSize: 13, fontWeight: '700' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    gap: 8,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowBody: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: '600', color: colors.black },
  subline: { fontSize: 11.5, color: colors.gray500, marginTop: 2 },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: colors.white,
  },

  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  notifSwitchWrap: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  bellIcon: { fontSize: 14 },
  switch: { transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray100,
  },
  removeBtnText: { fontSize: 14, color: colors.gray600, fontWeight: '700' },
});
