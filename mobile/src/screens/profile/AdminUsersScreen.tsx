/**
 * Dashboard de gestion des membres — réservé aux admins.
 *
 * Liste paginée (server-side limit 200) avec :
 *  - barre de recherche (q)
 *  - filtres rôle (member/coach/admin) + statut (active/pending/suspended)
 *  - tap sur une ligne → action sheet pour promouvoir le rôle / changer le statut
 *
 * Tout passe par PATCH /api/admin/users/:id, le service backend vérifie que
 * l'appelant est admin (sinon 403 not_admin).
 */
import { useEffect, useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminApi, type AdminUserSummaryDTO } from '../../api/admin';
import { ApiError } from '../../api/client';
import { Avatar } from '../../components/Avatar';
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../theme/colors';
import type { ProfileStackNavigation } from '../../navigation/ProfileStack';

interface AdminUsersScreenProps {
  navigation: ProfileStackNavigation<'AdminUsers'>;
}

type RoleFilter = 'all' | 'member' | 'coach' | 'admin';
type StatusFilter = 'all' | 'pending' | 'active' | 'suspended';

const ROLE_LABEL: Record<AdminUserSummaryDTO['role'], string> = {
  member: 'Membre',
  coach: 'Coach',
  admin: 'Admin',
};

const STATUS_LABEL: Record<AdminUserSummaryDTO['status'], string> = {
  pending: 'En attente',
  active: 'Actif',
  suspended: 'Suspendu',
  deleted: 'Supprimé',
};

const STATUS_COLOR: Record<AdminUserSummaryDTO['status'], string> = {
  pending: '#F59E0B',
  active: '#10B981',
  suspended: '#DC2626',
  deleted: colors.gray400,
};

export function AdminUsersScreen({ navigation }: AdminUsersScreenProps) {
  const me = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filters = useMemo(
    () => ({
      q: debouncedSearch || undefined,
      role: roleFilter !== 'all' ? roleFilter : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
    }),
    [debouncedSearch, roleFilter, statusFilter],
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ['adminUsers', filters],
    queryFn: () => adminApi.listUsers(filters),
  });

  const updateMutation = useMutation({
    mutationFn: (params: {
      userID: string;
      role?: AdminUserSummaryDTO['role'];
      status?: 'pending' | 'active' | 'suspended';
    }) =>
      adminApi.updateUser(params.userID, {
        role: params.role,
        status: params.status,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminUsers'] }),
    onError: (err) => {
      let msg = 'Action impossible.';
      if (err instanceof ApiError) {
        if (err.code === 'cannot_modify_self') msg = 'Tu ne peux pas modifier ton propre compte.';
        else if (err.code === 'not_admin') msg = "Tu n'as pas les droits.";
        else if (err.code === 'target_user_not_found') msg = 'Utilisateur introuvable.';
      }
      Alert.alert('Échec', msg);
    },
  });

  const onUserAction = (u: AdminUserSummaryDTO) => {
    if (u.id === me?.id) {
      Alert.alert('Impossible', 'Tu ne peux pas modifier ton propre compte.');
      return;
    }

    const options: { label: string; action: () => void }[] = [];

    // Promotion / rétrogradation rôle
    if (u.role !== 'member') {
      options.push({
        label: 'Rétrograder en membre',
        action: () => updateMutation.mutate({ userID: u.id, role: 'member' }),
      });
    }
    if (u.role !== 'coach') {
      options.push({
        label: 'Promouvoir coach',
        action: () => updateMutation.mutate({ userID: u.id, role: 'coach' }),
      });
    }
    if (u.role !== 'admin') {
      options.push({
        label: 'Promouvoir admin',
        action: () => confirmDestructive(
          'Promouvoir admin ?',
          `${u.first_name} aura tous les droits, y compris la gestion des comptes.`,
          () => updateMutation.mutate({ userID: u.id, role: 'admin' }),
        ),
      });
    }

    // Statut
    if (u.status !== 'active') {
      options.push({
        label: 'Activer le compte',
        action: () => updateMutation.mutate({ userID: u.id, status: 'active' }),
      });
    }
    if (u.status !== 'suspended') {
      options.push({
        label: 'Suspendre le compte',
        action: () => confirmDestructive(
          'Suspendre ?',
          `${u.first_name} ne pourra plus se connecter jusqu'à réactivation.`,
          () => updateMutation.mutate({ userID: u.id, status: 'suspended' }),
        ),
      });
    }

    showActionSheet(`${u.first_name} ${u.last_name_initial}`, options);
  };

  const users = data?.users ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Membres</Text>
          <Text style={styles.subtitle}>{users.length} affiché{users.length > 1 ? 's' : ''}</Text>
        </View>
      </View>

      {/* Barre de recherche */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Email ou prénom…"
          placeholderTextColor={colors.gray400}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {searchInput ? (
          <Pressable onPress={() => setSearchInput('')}>
            <Text style={styles.searchClear}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Filtres pills */}
      <View style={styles.filterRow}>
        <FilterPill label="Tous"   active={roleFilter === 'all'}    onPress={() => setRoleFilter('all')} />
        <FilterPill label="Members" active={roleFilter === 'member'} onPress={() => setRoleFilter('member')} />
        <FilterPill label="Coachs"  active={roleFilter === 'coach'}  onPress={() => setRoleFilter('coach')} />
        <FilterPill label="Admins"  active={roleFilter === 'admin'}  onPress={() => setRoleFilter('admin')} />
      </View>
      <View style={styles.filterRow}>
        <FilterPill label="Tous"      active={statusFilter === 'all'}       onPress={() => setStatusFilter('all')} />
        <FilterPill label="Actifs"    active={statusFilter === 'active'}    onPress={() => setStatusFilter('active')} />
        <FilterPill label="Attente"   active={statusFilter === 'pending'}   onPress={() => setStatusFilter('pending')} />
        <FilterPill label="Suspendus" active={statusFilter === 'suspended'} onPress={() => setStatusFilter('suspended')} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
        ) : error ? (
          <Text style={styles.errorText}>
            {error instanceof ApiError && error.code === 'not_admin'
              ? "Cette page est réservée aux admins."
              : 'Impossible de charger la liste.'}
          </Text>
        ) : users.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Aucun membre ne correspond aux filtres.</Text>
          </View>
        ) : (
          users.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              isMe={u.id === me?.id}
              onPress={() => onUserAction(u)}
            />
          ))
        )}
        {updateMutation.isPending ? (
          <View style={styles.savingBanner}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.savingText}>Mise à jour…</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

interface UserRowProps {
  user: AdminUserSummaryDTO;
  isMe: boolean;
  onPress: () => void;
}

function UserRow({ user, isMe, onPress }: UserRowProps) {
  const initials =
    (user.first_name[0] ?? '?') + (user.last_name_initial[0] ?? '');
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Avatar
        initials={initials}
        color={user.role === 'admin' ? 2 : user.role === 'coach' ? 3 : 1}
        size={40}
        imageUri={user.avatar_url ?? null}
      />
      <View style={styles.rowBody}>
        <Text style={styles.name} numberOfLines={1}>
          {user.first_name} {user.last_name_initial}
          {isMe ? <Text style={styles.youTag}> (toi)</Text> : null}
        </Text>
        <Text style={styles.email} numberOfLines={1}>
          {user.email}
        </Text>
      </View>
      <View style={styles.badges}>
        <View style={[styles.badge, badgeStyleForRole(user.role)]}>
          <Text style={styles.badgeText}>{ROLE_LABEL[user.role]}</Text>
        </View>
        <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[user.status] }]} />
        <Text style={[styles.statusLabel, { color: STATUS_COLOR[user.status] }]}>
          {STATUS_LABEL[user.status]}
        </Text>
      </View>
    </Pressable>
  );
}

function badgeStyleForRole(role: AdminUserSummaryDTO['role']) {
  switch (role) {
    case 'admin':
      return { backgroundColor: colors.primary };
    case 'coach':
      return { backgroundColor: colors.belt.purple };
    default:
      return { backgroundColor: colors.gray500 };
  }
}

interface FilterPillProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

function FilterPill({ label, active, onPress }: FilterPillProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.filterPill, active && styles.filterPillActive]}
    >
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </Pressable>
  );
}

// ─── Helpers UI ────────────────────────────────────────────────

function showActionSheet(
  title: string,
  options: { label: string; action: () => void }[],
) {
  if (options.length === 0) {
    Alert.alert(title, "Aucune action disponible pour ce compte.");
    return;
  }
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options: ['Annuler', ...options.map((o) => o.label)],
        cancelButtonIndex: 0,
      },
      (idx) => {
        if (idx > 0) options[idx - 1].action();
      },
    );
  } else {
    Alert.alert(title, undefined, [
      { text: 'Annuler', style: 'cancel' },
      ...options.map((o) => ({ text: o.label, onPress: o.action })),
    ]);
  }
}

function confirmDestructive(title: string, message: string, action: () => void) {
  Alert.alert(title, message, [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Confirmer', style: 'destructive', onPress: action },
  ]);
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

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    backgroundColor: colors.gray50,
  },
  searchIcon: { fontSize: 14, opacity: 0.6 },
  searchInput: { flex: 1, fontSize: 13.5, color: colors.black, paddingVertical: 4 },
  searchClear: { fontSize: 16, color: colors.gray500, paddingHorizontal: 4 },

  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  filterPill: {
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  filterPillActive: { backgroundColor: colors.black, borderColor: colors.black },
  filterText: { fontSize: 11.5, color: colors.black, fontWeight: '500' },
  filterTextActive: { color: colors.white, fontWeight: '700' },

  scroll: { paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    gap: 10,
  },
  rowBody: { flex: 1, minWidth: 0 },
  name: { fontSize: 13, fontWeight: '600', color: colors.black },
  youTag: { fontSize: 11, color: colors.gray500, fontWeight: '400' },
  email: { fontSize: 11, color: colors.gray500, marginTop: 2 },
  badges: { alignItems: 'flex-end', gap: 3 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  statusDot: { width: 6, height: 6, borderRadius: 999, marginTop: 2 },
  statusLabel: { fontSize: 10, fontWeight: '600' },

  errorText: {
    fontSize: 13,
    color: colors.primary,
    textAlign: 'center',
    paddingVertical: 30,
  },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 13, color: colors.gray500 },

  savingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  savingText: { fontSize: 12, color: colors.gray600 },
});
