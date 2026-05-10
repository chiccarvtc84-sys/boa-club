import { useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { freeSlotsApi, type UserBriefDTO } from '../../api/freeSlots';
import { messagesApi, type MessageDTO } from '../../api/messages';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { MessageComposer } from '../../components/MessageComposer';
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../theme/colors';
import type { Belt } from '../../types/models';
import type {
  SlotsStackNavigation,
  SlotsStackRoute,
} from '../../navigation/SlotsStack';

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

interface SlotDetailScreenProps {
  navigation: SlotsStackNavigation<'SlotDetail'>;
  route: SlotsStackRoute<'SlotDetail'>;
}

export function SlotDetailScreen({ navigation, route }: SlotDetailScreenProps) {
  const slotId = route.params.slotId;
  const currentUser = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['freeSlots', slotId],
    queryFn: () => freeSlotsApi.get(slotId),
  });

  const isJoined = !!data?.participants.find((p) => p.id === currentUser?.id);
  const isCreator = data?.creator.id === currentUser?.id;

  const joinMutation = useMutation({
    mutationFn: () => freeSlotsApi.join(slotId),
    onSuccess: () => invalidateAll(),
  });
  const leaveMutation = useMutation({
    mutationFn: () => freeSlotsApi.leave(slotId),
    onSuccess: () => invalidateAll(),
  });
  const cancelMutation = useMutation({
    mutationFn: () => freeSlotsApi.cancel(slotId),
    onSuccess: () => {
      invalidateAll();
      navigation.goBack();
    },
  });

  // Discussion publique : conversation_id du slot_thread (créée à la demande).
  const { data: threadInfo } = useQuery({
    queryKey: ['slotThread', slotId],
    queryFn: () => messagesApi.slotThread(slotId),
    enabled: isJoined,
  });
  const conversationId = threadInfo?.conversation_id;

  const { data: messagesData } = useQuery({
    queryKey: ['slotMessages', conversationId],
    queryFn: () => messagesApi.listMessages(conversationId!, undefined, 50),
    enabled: !!conversationId,
    refetchInterval: 5000,
  });

  // Mark-read auto à l'ouverture quand on a une conv.
  useEffect(() => {
    if (conversationId) {
      messagesApi.markRead(conversationId).catch(() => {});
    }
  }, [conversationId]);

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ['freeSlots'] });
    queryClient.invalidateQueries({ queryKey: ['slotThread'] });
  }

  const onToggleJoin = () => {
    if (isJoined) leaveMutation.mutate();
    else joinMutation.mutate();
  };

  const onCancelSlot = () => {
    Alert.alert(
      'Annuler ce créneau ?',
      'Les autres participants seront notifiés. Cette action est définitive.',
      [
        { text: 'Retour', style: 'cancel' },
        {
          text: 'Annuler le créneau',
          style: 'destructive',
          onPress: () => cancelMutation.mutate(),
        },
      ],
    );
  };

  // Trie les messages chronologiquement pour les afficher dans l'ordre lecture.
  const messages = (messagesData?.messages ?? [])
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {data?.title ?? 'Créneau'}
          </Text>
          {data ? (
            <Text style={styles.subtitle}>par {data.creator.first_name}</Text>
          ) : null}
        </View>
      </View>

      {data ? (
        <View style={styles.scopeBanner}>
          <Text style={styles.scopeText}>
            👥 Discussion publique · les {data.participant_count} inscrits voient tout
          </Text>
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          {isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : error || !data ? (
            <Text style={styles.errorText}>Impossible de charger ce créneau.</Text>
          ) : (
            <>
              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>Quand</Text>
                <Text style={styles.detailValue}>
                  {formatFullDate(data.scheduled_start)} ·{' '}
                  {formatTime(data.scheduled_start)} — {formatTime(data.scheduled_end)}
                </Text>
                {data.location ? (
                  <>
                    <Text style={[styles.detailLabel, { marginTop: 10 }]}>Où</Text>
                    <Text style={styles.detailValue}>{data.location}</Text>
                  </>
                ) : null}
                {data.description ? (
                  <>
                    <Text style={[styles.detailLabel, { marginTop: 10 }]}>Description</Text>
                    <Text style={styles.detailDesc}>{data.description}</Text>
                  </>
                ) : null}
              </View>

              {data.is_cancelled ? (
                <View style={styles.cancelledBox}>
                  <Text style={styles.cancelledText}>Ce créneau a été annulé.</Text>
                </View>
              ) : (
                <>
                  <Button
                    label={isJoined ? "Je n'y vais plus" : 'Je viens'}
                    variant={isJoined ? 'outline' : 'primary'}
                    onPress={onToggleJoin}
                    loading={joinMutation.isPending || leaveMutation.isPending}
                    full
                  />
                  {isCreator ? (
                    <Pressable style={styles.cancelLink} onPress={onCancelSlot}>
                      <Text style={styles.cancelLinkText}>Annuler ce créneau</Text>
                    </Pressable>
                  ) : null}
                </>
              )}

              <Text style={styles.section}>
                {data.participant_count} personne{data.participant_count > 1 ? 's' : ''} y vont
              </Text>
              {data.participants.map((p) => (
                <ParticipantRow
                  key={p.id}
                  participant={p}
                  isMe={p.id === currentUser?.id}
                />
              ))}

              {/* === Discussion publique === */}
              <Text style={styles.section}>Discussion publique</Text>
              {!isJoined ? (
                <Text style={styles.discussionLocked}>
                  Rejoins ce créneau pour participer à la discussion.
                </Text>
              ) : !conversationId ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
              ) : messages.length === 0 ? (
                <Text style={styles.discussionEmpty}>
                  Pas encore de message. Lance la conversation !
                </Text>
              ) : (
                <View style={styles.messagesWrap}>
                  {messages.map((m) => (
                    <DiscussionMessage
                      key={m.id}
                      message={m}
                      isMine={m.sender?.id === currentUser?.id}
                    />
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>

        {/*
          Barre de saisie sticky bottom (visible si on est inscrit).
          Le composant MessageComposer gère photo + voix + texte.
        */}
        {isJoined && conversationId ? (
          <MessageComposer
            conversationId={conversationId}
            placeholder="Écrire dans la discussion…"
            onSent={() => {
              queryClient.invalidateQueries({
                queryKey: ['slotMessages', conversationId],
              });
            }}
          />
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface DiscussionMessageProps {
  message: MessageDTO;
  isMine: boolean;
}

function DiscussionMessage({ message, isMine }: DiscussionMessageProps) {
  if (message.type === 'system') {
    return (
      <Text style={styles.systemMessage}>{message.content}</Text>
    );
  }
  const senderName = message.sender
    ? `${message.sender.first_name}${message.sender.last_name_initial ? ' ' + message.sender.last_name_initial : ''}`
    : '';
  const initials = message.sender
    ? message.sender.first_name[0] + (message.sender.last_name_initial[0] ?? '')
    : '?';
  return (
    <View>
      {!isMine && message.sender ? (
        <Text style={styles.discussionAuthor}>{senderName}</Text>
      ) : null}
      <View
        style={[
          styles.discMsgRow,
          isMine ? styles.discMsgRowMine : styles.discMsgRowThem,
        ]}
      >
        {!isMine ? (
          <Avatar initials={initials} color={3} size={24} />
        ) : null}
        <View
          style={[
            styles.discBubble,
            isMine ? styles.bubbleMine : styles.bubbleThem,
          ]}
        >
          <Text style={isMine ? styles.bubbleTextMine : styles.bubbleTextThem}>
            {message.content}
          </Text>
        </View>
      </View>
    </View>
  );
}

interface ParticipantRowProps {
  participant: UserBriefDTO;
  isMe: boolean;
}

function ParticipantRow({ participant: p, isMe }: ParticipantRowProps) {
  const initials = p.first_name[0] + (p.last_name_initial[0] ?? '');
  const beltStyle = BELT_COLOR[p.belt];
  return (
    <View style={styles.partRow}>
      <Avatar initials={initials} color={1} size={28} />
      <View style={{ flex: 1 }}>
        <Text style={styles.partName}>
          {p.first_name} {p.last_name_initial}
          {isMe ? <Text style={styles.youTag}> (toi)</Text> : null}
        </Text>
      </View>
      {p.is_coach ? (
        <View style={[styles.beltPill, { backgroundColor: colors.primary }]}>
          <Text style={styles.beltText}>Coach</Text>
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
        </Text>
      </View>
    </View>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatFullDate(iso: string): string {
  const d = new Date(iso);
  const days = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
  const months = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
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
  scopeBanner: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: colors.gray50,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  scopeText: { fontSize: 11, color: colors.black, fontWeight: '500' },
  scroll: { padding: 14, paddingBottom: 24 },
  detailBlock: {
    backgroundColor: colors.gray50,
    borderRadius: 10,
    padding: 12,
    borderWidth: 0.5,
    borderColor: colors.border,
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 11,
    color: colors.gray600,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  detailValue: { fontSize: 16, fontWeight: '600', color: colors.black },
  detailDesc: { fontSize: 13, color: colors.gray700, lineHeight: 19 },
  cancelledBox: {
    backgroundColor: colors.alert.absent.bg,
    padding: 12,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: colors.alert.absent.border,
    marginBottom: 12,
  },
  cancelledText: { color: colors.alert.absent.text, fontSize: 13, fontWeight: '600' },
  cancelLink: { marginTop: 10, alignItems: 'center' },
  cancelLinkText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  section: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.black,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 18,
    marginBottom: 6,
  },
  partRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  partName: { fontSize: 13, fontWeight: '600', color: colors.black },
  youTag: { fontSize: 11, color: colors.gray500, fontWeight: '400' },
  beltPill: { paddingHorizontal: 9, paddingVertical: 2, borderRadius: 999 },
  beltText: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.2, color: colors.white },
  errorText: {
    fontSize: 13,
    color: colors.primary,
    textAlign: 'center',
    paddingVertical: 30,
  },

  // === Discussion ===
  discussionLocked: {
    fontSize: 12,
    color: colors.gray500,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
  discussionEmpty: {
    fontSize: 12,
    color: colors.gray500,
    textAlign: 'center',
    paddingVertical: 12,
  },
  messagesWrap: { gap: 4, marginTop: 4 },
  discussionAuthor: {
    fontSize: 10.5,
    color: colors.gray500,
    marginLeft: 32,
    marginTop: 4,
    marginBottom: 1,
  },
  discMsgRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  discMsgRowThem: { justifyContent: 'flex-start' },
  discMsgRowMine: { justifyContent: 'flex-end' },
  discBubble: {
    maxWidth: '76%',
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
  systemMessage: {
    fontSize: 11,
    color: colors.gray500,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 6,
  },

  // === Saisie sticky ===
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
