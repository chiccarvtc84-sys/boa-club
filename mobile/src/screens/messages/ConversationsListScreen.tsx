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

import {
  messagesApi,
  type ConversationSummaryDTO,
  type MessageSearchHitDTO,
} from '../../api/messages';
import { Avatar } from '../../components/Avatar';
import { colors } from '../../theme/colors';
import type { MessagesStackNavigation } from '../../navigation/MessagesStack';

interface ConversationsListScreenProps {
  navigation: MessagesStackNavigation<'ConversationsList'>;
}

export function ConversationsListScreen({ navigation }: ConversationsListScreenProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => messagesApi.listDMs(),
  });

  // ── Recherche FTS ──────────────────────────────────────────────
  // On debounce pour ne pas spammer l'API à chaque touche.
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const searchQuery = useQuery({
    queryKey: ['searchMessages', debouncedSearch],
    queryFn: () => messagesApi.search(debouncedSearch, 30),
    enabled: debouncedSearch.length >= 2,
  });

  const conversations = data?.conversations ?? [];
  const unreadTotal = conversations.reduce((sum, c) => sum + c.unread_count, 0);
  const isSearching = debouncedSearch.length >= 2;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages privés</Text>
        <Text style={styles.subtitle}>
          {unreadTotal === 0 ? 'Toutes lues' : `${unreadTotal} non lu${unreadTotal > 1 ? 's' : ''}`}
        </Text>
      </View>

      {/* Barre de recherche */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Rechercher dans tes messages…"
          placeholderTextColor={colors.gray400}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchInput ? (
          <Pressable onPress={() => setSearchInput('')}>
            <Text style={styles.searchClear}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {isSearching ? (
          // ── Mode recherche ──
          searchQuery.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (searchQuery.data?.hits ?? []).length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyText}>Aucun message trouvé pour « {debouncedSearch} ».</Text>
            </View>
          ) : (
            (searchQuery.data?.hits ?? []).map((hit) => (
              <SearchHitRow
                key={hit.message.id}
                hit={hit}
                query={debouncedSearch}
                onPress={() =>
                  navigation.navigate('Conversation', {
                    conversationId: hit.message.conversation_id,
                    title: hit.conversation_title ?? undefined,
                  })
                }
              />
            ))
          )
        ) : isLoading ? (
          // ── Mode liste normale ──
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>Impossible de charger tes conversations.</Text>
        ) : conversations.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyText}>
              Pas encore de conversation.{'\n'}
              Touche un nom dans un créneau pour démarrer un DM.
            </Text>
          </View>
        ) : (
          conversations.map((c) => (
            <ConvRow
              key={c.id}
              conv={c}
              onPress={() =>
                navigation.navigate('Conversation', {
                  conversationId: c.id,
                  title:
                    c.other && `${c.other.first_name} ${c.other.last_name_initial}`,
                })
              }
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

interface SearchHitRowProps {
  hit: MessageSearchHitDTO;
  query: string;
  onPress: () => void;
}

function SearchHitRow({ hit, query, onPress }: SearchHitRowProps) {
  const m = hit.message;
  const sender = m.sender
    ? `${m.sender.first_name} ${m.sender.last_name_initial}`
    : 'Système';
  const ctx =
    hit.conversation_type === 'slot_thread' && hit.conversation_title
      ? `Créneau · ${hit.conversation_title}`
      : 'DM';
  const preview = m.content ?? '—';
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Avatar
        initials={
          m.sender
            ? m.sender.first_name[0] + (m.sender.last_name_initial[0] ?? '')
            : '?'
        }
        color={3}
        size={40}
        imageUri={m.sender?.avatar_url ?? null}
      />
      <View style={styles.rowBody}>
        <Text style={styles.name} numberOfLines={1}>
          {sender}
        </Text>
        <Text style={styles.preview} numberOfLines={2}>
          {highlightMatch(preview, query)}
        </Text>
      </View>
      <Text style={styles.searchCtx} numberOfLines={2}>
        {ctx}
      </Text>
    </Pressable>
  );
}

/**
 * Helper basique qui retourne le texte tel quel (le highlight visuel
 * nécessiterait un Text imbriqué + parsing — overkill pour V1).
 */
function highlightMatch(text: string, _query: string): string {
  return text;
}

interface ConvRowProps {
  conv: ConversationSummaryDTO;
  onPress: () => void;
}

function ConvRow({ conv, onPress }: ConvRowProps) {
  const other = conv.other;
  const initials = other
    ? other.first_name[0] + (other.last_name_initial[0] ?? '')
    : '??';
  const isUnread = conv.unread_count > 0;

  let preview = conv.last_message ?? 'Aucun message';
  if (conv.last_message_type === 'photo') preview = '📷 Photo';
  if (conv.last_message_type === 'voice') preview = '🎤 Note vocale';

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Avatar
        initials={initials}
        color={2}
        size={40}
        imageUri={other?.avatar_url ?? null}
      />
      <View style={styles.rowBody}>
        <Text style={[styles.name, isUnread && styles.nameUnread]} numberOfLines={1}>
          {other ? `${other.first_name} ${other.last_name_initial}` : 'Conversation'}
        </Text>
        <Text
          style={[styles.preview, isUnread && styles.previewUnread]}
          numberOfLines={1}
        >
          {preview}
        </Text>
      </View>
      <View style={styles.rowMeta}>
        <Text style={styles.time}>{formatRelativeTime(conv.last_message_at)}</Text>
        {isUnread ? <View style={styles.unreadDot} /> : null}
      </View>
    </Pressable>
  );
}

function formatRelativeTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 1) return 'hier';
  if (diffDays < 7) return `il y a ${diffDays}j`;
  return `${d.getDate()}/${d.getMonth() + 1}`;
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

  // Barre de recherche FTS.
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
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: colors.black,
    paddingVertical: 4,
  },
  searchClear: {
    fontSize: 16,
    color: colors.gray500,
    paddingHorizontal: 4,
  },

  scroll: { paddingBottom: 24 },
  center: { paddingVertical: 50, alignItems: 'center' },
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
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    gap: 10,
  },
  rowBody: { flex: 1, minWidth: 0 },
  name: { fontSize: 13, fontWeight: '500', color: colors.black },
  nameUnread: { fontWeight: '700' },
  preview: { fontSize: 11, color: colors.gray500, marginTop: 2 },
  previewUnread: { color: colors.black, fontWeight: '500' },
  rowMeta: { alignItems: 'flex-end', gap: 4 },
  time: { fontSize: 11, color: colors.gray500 },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },

  // Recherche : contexte de la conv (DM / Créneau).
  searchCtx: {
    fontSize: 10,
    color: colors.gray400,
    fontStyle: 'italic',
    maxWidth: 80,
    textAlign: 'right',
  },
});
