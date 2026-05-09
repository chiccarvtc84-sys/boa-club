import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { messagesApi, type ConversationSummaryDTO } from '../../api/messages';
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

  const conversations = data?.conversations ?? [];
  const unreadTotal = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Messages privés</Text>
          <Text style={styles.subtitle}>
            {unreadTotal === 0 ? 'Toutes lues' : `${unreadTotal} non lu${unreadTotal > 1 ? 's' : ''}`}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {isLoading ? (
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
      <Avatar initials={initials} color={2} size={40} />
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
});
