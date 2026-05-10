import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { messagesApi, type MessageDTO } from '../../api/messages';
import { MessageComposer } from '../../components/MessageComposer';
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
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList<MessageDTO>>(null);

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

        {/*
          Composer unifié : texte + 📷 (caméra/galerie) + 🎤 (appui long).
          Cf. mobile/src/components/MessageComposer.tsx
        */}
        <MessageComposer
          conversationId={conversationId}
          placeholder="Aa"
          onSent={() => {
            queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
          }}
        />
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
});
