import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  messagesApi,
  type MessageDTO,
  type MessageReactionDTO,
} from '../../api/messages';
import { MessageComposer } from '../../components/MessageComposer';
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../theme/colors';
import type {
  MessagesStackNavigation,
  MessagesStackRoute,
} from '../../navigation/MessagesStack';

// Réactions proposées dans le picker (style WhatsApp). Les emojis sont
// volontairement universels et limités pour ne pas saturer l'UI.
const REACTION_OPTIONS = ['❤️', '👍', '🥋', '💪', '😂', '🔥'];

// Date "indéfinie" pour le mute (l'année 9999 = jamais déclenchera).
const MUTE_FOREVER = '9999-12-31T23:59:59Z';

interface ConversationScreenProps {
  navigation: MessagesStackNavigation<'Conversation'>;
  route: MessagesStackRoute<'Conversation'>;
}

export function ConversationScreen({ navigation, route }: ConversationScreenProps) {
  const { conversationId, title } = route.params;
  const currentUser = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList<MessageDTO>>(null);

  // Mute optimiste : la state initiale ne reflète pas l'état serveur (V1).
  // Toggling l'icône appelle l'API ; le serveur reste source de vérité pour
  // les notifs, l'affichage est juste indicatif pendant la session.
  const [isMutedLocal, setIsMutedLocal] = useState(false);

  // État de la modale d'emoji picker : null = fermée, sinon ID du message ciblé.
  const [reactionPickerForMsgId, setReactionPickerForMsgId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => messagesApi.listMessages(conversationId),
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!data?.messages.length) return;
    messagesApi.markRead(conversationId).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  }, [conversationId, data?.messages.length, queryClient]);

  // ── Mute / Unmute ────────────────────────────────────────────

  const muteMutation = useMutation({
    mutationFn: (mute: boolean) =>
      mute
        ? messagesApi.mute(conversationId, MUTE_FOREVER)
        : messagesApi.unmute(conversationId),
    onSuccess: (_, muted) => setIsMutedLocal(muted),
    onError: () => Alert.alert('Erreur', 'Impossible de changer le mute.'),
  });

  // ── Réactions ────────────────────────────────────────────────

  const addReactionMutation = useMutation({
    mutationFn: (params: { msgId: string; emoji: string }) =>
      messagesApi.addReaction(conversationId, params.msgId, params.emoji),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['messages', conversationId] }),
  });

  const removeReactionMutation = useMutation({
    mutationFn: (params: { msgId: string; emoji: string }) =>
      messagesApi.removeReaction(conversationId, params.msgId, params.emoji),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['messages', conversationId] }),
  });

  const toggleReaction = (msgId: string, emoji: string, hasMine: boolean) => {
    if (hasMine) {
      removeReactionMutation.mutate({ msgId, emoji });
    } else {
      addReactionMutation.mutate({ msgId, emoji });
    }
  };

  const onPickReaction = (emoji: string) => {
    if (!reactionPickerForMsgId) return;
    // Cherche si déjà posée par moi pour faire un toggle propre.
    const targetMsg = data?.messages.find((m) => m.id === reactionPickerForMsgId);
    const hasMine = !!targetMsg?.reactions?.find((r) => r.emoji === emoji && r.has_mine);
    toggleReaction(reactionPickerForMsgId, emoji, hasMine);
    setReactionPickerForMsgId(null);
  };

  const messages = data?.messages ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {title ?? 'Conversation'}
          </Text>
          <Text style={styles.subtitle}>
            {isMutedLocal ? '🔕 Notifs en pause' : 'Conversation privée'}
          </Text>
        </View>
        {/* Toggle mute */}
        <Pressable
          onPress={() => muteMutation.mutate(!isMutedLocal)}
          style={styles.muteBtn}
          disabled={muteMutation.isPending}
        >
          <Text style={styles.muteIcon}>{isMutedLocal ? '🔕' : '🔔'}</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>Impossible de charger les messages.</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            inverted
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                isMine={item.sender?.id === currentUser?.id}
                onLongPress={() => {
                  if (item.type !== 'system') setReactionPickerForMsgId(item.id);
                }}
                onTapReaction={(emoji, hasMine) =>
                  toggleReaction(item.id, emoji, hasMine)
                }
              />
            )}
          />
        )}

        <MessageComposer
          conversationId={conversationId}
          placeholder="Aa"
          onSent={() => {
            queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
          }}
        />
      </KeyboardAvoidingView>

      {/* Modale emoji picker (fond semi-transparent, fermable au tap autour) */}
      <Modal
        visible={!!reactionPickerForMsgId}
        transparent
        animationType="fade"
        onRequestClose={() => setReactionPickerForMsgId(null)}
      >
        <Pressable
          style={styles.pickerBackdrop}
          onPress={() => setReactionPickerForMsgId(null)}
        >
          <View style={styles.pickerBar}>
            {REACTION_OPTIONS.map((e) => (
              <Pressable
                key={e}
                onPress={() => onPickReaction(e)}
                style={styles.pickerEmojiBtn}
                hitSlop={8}
              >
                <Text style={styles.pickerEmoji}>{e}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

interface MessageBubbleProps {
  message: MessageDTO;
  isMine: boolean;
  onLongPress: () => void;
  onTapReaction: (emoji: string, hasMine: boolean) => void;
}

function MessageBubble({ message, isMine, onLongPress, onTapReaction }: MessageBubbleProps) {
  if (message.type === 'system') {
    return (
      <View style={styles.systemWrap}>
        <Text style={styles.systemText}>{message.content}</Text>
      </View>
    );
  }
  return (
    <View
      style={[
        styles.bubbleWrap,
        isMine ? styles.bubbleWrapMine : styles.bubbleWrapThem,
      ]}
    >
      <Pressable onLongPress={onLongPress} delayLongPress={350}>
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleThem]}>
          <Text style={isMine ? styles.bubbleTextMine : styles.bubbleTextThem}>
            {message.content ?? (message.type === 'photo' ? '📷 Photo' : '🎤 Note vocale')}
          </Text>
        </View>
      </Pressable>
      {/* Réactions agrégées sous le bulle */}
      {message.reactions && message.reactions.length > 0 ? (
        <View style={[styles.reactionsRow, isMine ? { justifyContent: 'flex-end' } : null]}>
          {message.reactions.map((r) => (
            <ReactionPill
              key={r.emoji}
              reaction={r}
              onPress={() => onTapReaction(r.emoji, r.has_mine)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

interface ReactionPillProps {
  reaction: MessageReactionDTO;
  onPress: () => void;
}

function ReactionPill({ reaction, onPress }: ReactionPillProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.reactionPill, reaction.has_mine && styles.reactionPillMine]}
    >
      <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
      <Text style={[styles.reactionCount, reaction.has_mine && styles.reactionCountMine]}>
        {reaction.count}
      </Text>
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

  muteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muteIcon: { fontSize: 16 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 13, color: colors.primary, textAlign: 'center' },

  listContent: { paddingHorizontal: 12, paddingVertical: 8 },
  bubbleWrap: { maxWidth: '78%', marginBottom: 5 },
  bubbleWrapMine: { alignSelf: 'flex-end' },
  bubbleWrapThem: { alignSelf: 'flex-start' },
  bubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  bubbleMine: {
    backgroundColor: colors.chat.mineBg,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: colors.chat.themBg,
    borderBottomLeftRadius: 4,
  },
  bubbleTextMine: { fontSize: 13.5, color: colors.chat.mineText, lineHeight: 18 },
  bubbleTextThem: { fontSize: 13.5, color: colors.chat.themText, lineHeight: 18 },

  systemWrap: { alignItems: 'center', paddingVertical: 6 },
  systemText: {
    fontSize: 11,
    color: colors.gray500,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 16,
  },

  // Réactions agrégées sous chaque bulle.
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 3,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.gray100,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  reactionPillMine: {
    backgroundColor: '#FEE2E2',
    borderColor: colors.primary,
  },
  reactionEmoji: { fontSize: 12 },
  reactionCount: { fontSize: 11, color: colors.gray700, fontWeight: '600' },
  reactionCountMine: { color: colors.primary },

  // Modale emoji picker.
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerBar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  pickerEmojiBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  pickerEmoji: { fontSize: 24 },
});
