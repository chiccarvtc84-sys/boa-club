import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { messagesApi, type MessageDTO } from '../../api/messages';
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../theme/colors';
import type {
  MessagesStackNavigation,
  MessagesStackRoute,
} from '../../navigation/MessagesStack';

interface ConversationScreenProps {
  navigation: MessagesStackNavigation<'Conversation'>;
  route: MessagesStackRoute<'Conversation'>;
}

export function ConversationScreen({ navigation, route }: ConversationScreenProps) {
  const { conversationId, title } = route.params;
  const currentUser = useAuthStore((s) => s.user);
  const [draft, setDraft] = useState('');
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList<MessageDTO>>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => messagesApi.listMessages(conversationId),
    refetchInterval: 5000, // polling toutes les 5s — sera remplacé par WebSocket plus tard.
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => messagesApi.send(conversationId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  // Auto-mark-read à l'ouverture et à chaque nouveau message reçu.
  useEffect(() => {
    if (!data?.messages.length) return;
    messagesApi.markRead(conversationId).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  }, [conversationId, data?.messages.length, queryClient]);

  const onSend = () => {
    const text = draft.trim();
    if (!text) return;
    sendMutation.mutate(text);
    setDraft('');
  };

  // Inverse l'ordre pour la display : `inverted` rend du plus récent en bas.
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
          <Text style={styles.subtitle}>Conversation privée</Text>
        </View>
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
              <MessageBubble message={item} isMine={item.sender?.id === currentUser?.id} />
            )}
          />
        )}

        <View style={styles.inputBar}>
          <Pressable style={styles.iconBtn} onPress={() => {}}>
            <Text style={styles.iconText}>📷</Text>
          </Pressable>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Aa"
              placeholderTextColor={colors.gray400}
              multiline
              onSubmitEditing={onSend}
              blurOnSubmit
            />
          </View>
          {draft.trim() ? (
            <Pressable
              style={styles.sendBtn}
              onPress={onSend}
              disabled={sendMutation.isPending}
            >
              <Text style={styles.sendText}>→</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.iconBtn} onPress={() => {}}>
              <Text style={styles.iconText}>🎤</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface MessageBubbleProps {
  message: MessageDTO;
  isMine: boolean;
}

function MessageBubble({ message, isMine }: MessageBubbleProps) {
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
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleThem]}>
        <Text style={isMine ? styles.bubbleTextMine : styles.bubbleTextThem}>
          {message.content}
        </Text>
      </View>
    </View>
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

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 13, color: colors.primary, textAlign: 'center' },

  listContent: { paddingHorizontal: 12, paddingVertical: 8 },
  bubbleWrap: { maxWidth: '78%', marginBottom: 3 },
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

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 18 },
  inputWrap: { flex: 1 },
  input: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.gray50,
    fontSize: 13,
    color: colors.black,
    borderWidth: 0.5,
    borderColor: colors.border,
    maxHeight: 100,
  },
  sendBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { fontSize: 16, color: colors.white, fontWeight: '700' },
});
