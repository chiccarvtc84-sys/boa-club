/**
 * Recherche de membres du club.
 *
 * Search bar en haut + liste des résultats (live, debounce 250ms).
 * Tap sur un résultat → MemberDetailScreen.
 */
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { usersApi, type UserSearchResultDTO } from '../../api/users';
import { Avatar } from '../../components/Avatar';
import { colors } from '../../theme/colors';
import type { Belt } from '../../types/models';
import type { ProfileStackNavigation } from '../../navigation/ProfileStack';

interface Props {
  navigation: ProfileStackNavigation<'MembersSearch'>;
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

export function MembersSearchScreen({ navigation }: Props) {
  const [searchInput, setSearchInput] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(searchInput.trim()), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Query : déclenchée systématiquement (le backend gère le cas "vide" en
  // renvoyant la liste complète des membres, pratique pour parcourir).
  const { data, isLoading, error } = useQuery({
    queryKey: ['usersSearch', debounced],
    queryFn: () => usersApi.search(debounced, 50),
  });

  const results = data?.users ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Rechercher un membre</Text>
          <Text style={styles.subtitle}>
            {results.length} résultat{results.length > 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Prénom ou initiale…"
          placeholderTextColor={colors.gray400}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
          autoFocus
        />
        {searchInput ? (
          <Pressable onPress={() => setSearchInput('')}>
            <Text style={styles.searchClear}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
        ) : error ? (
          <Text style={styles.errorText}>Impossible de charger la liste.</Text>
        ) : results.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔎</Text>
            <Text style={styles.emptyText}>
              {debounced
                ? `Aucun membre ne correspond à "${debounced}".`
                : "Tape un prénom pour rechercher."}
            </Text>
          </View>
        ) : (
          results.map((u) => (
            <MemberRow
              key={u.id}
              user={u}
              onPress={() =>
                navigation.navigate('MemberDetail', { userId: u.id })
              }
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

interface MemberRowProps {
  user: UserSearchResultDTO;
  onPress: () => void;
}

function MemberRow({ user, onPress }: MemberRowProps) {
  const initials =
    (user.first_name[0] ?? '?') + (user.last_name_initial[0] ?? '');
  const beltStyle = BELT_COLOR[user.belt];

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Avatar
        initials={initials}
        color={user.role === 'coach' || user.role === 'admin' ? 2 : 1}
        size={42}
        imageUri={user.avatar_url ?? null}
      />
      <View style={styles.rowBody}>
        <Text style={styles.name} numberOfLines={1}>
          {user.first_name} {user.last_name_initial}
        </Text>
        <View style={styles.rowMetaRow}>
          {user.role !== 'member' ? (
            <View style={[styles.rolePill, { backgroundColor: colors.primary }]}>
              <Text style={styles.rolePillText}>
                {user.role === 'admin' ? 'Admin' : 'Coach'}
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
              {BELT_LABEL[user.belt]}
              {user.stripes > 0 ? ` · ${user.stripes}` : ''}
            </Text>
          </View>
        </View>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
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

  scroll: { paddingBottom: 24 },
  errorText: {
    fontSize: 13,
    color: colors.primary,
    textAlign: 'center',
    paddingVertical: 30,
  },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  emptyIcon: { fontSize: 32, marginBottom: 12, opacity: 0.4 },
  emptyText: { fontSize: 13, color: colors.gray600, textAlign: 'center', lineHeight: 19 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    gap: 12,
  },
  rowBody: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: '600', color: colors.black },
  rowMetaRow: { flexDirection: 'row', gap: 5, marginTop: 4, alignItems: 'center' },
  rolePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  rolePillText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  beltPill: { paddingHorizontal: 9, paddingVertical: 2, borderRadius: 999 },
  beltText: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.2 },
  chevron: { fontSize: 18, color: colors.gray400 },
});
