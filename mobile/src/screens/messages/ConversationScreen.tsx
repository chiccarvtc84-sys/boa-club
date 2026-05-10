import { useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';

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

  // ────────────────────────────────────────────────────────────────────
  // Tâche 4 : photo + message vocal.
  //
  // Photo : preview avant envoi dans une modale.
  // Vocal : appui long pour enregistrer, relâche pour envoyer.
  //
  // Note : l'API `messagesApi.send` n'accepte pour l'instant que du texte.
  // Tant que le backend ne supporte pas l'upload de média, on envoie un
  // message texte de substitution (« 📷 Photo » / « 🎤 Note vocale (Xs) »)
  // pour que l'UX soit complète. Quand l'endpoint d'upload sera prêt, il
  // suffira de remplacer la logique dans `sendPhoto` / `sendVoice` ci-dessous.
  // ────────────────────────────────────────────────────────────────────
  const [previewPhotoUri, setPreviewPhotoUri] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Hook d'enregistrement audio (expo-audio).
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const { data, isLoading, error } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => messagesApi.listMessages(conversationId),
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => messagesApi.send(conversationId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

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

  // ── PHOTOS ────────────────────────────────────────────────────────

  /**
   * Demande la permission caméra ou galerie selon la source.
   * Affiche un message clair si refusé.
   */
  const ensureMediaPermission = async (source: 'camera' | 'library'): Promise<boolean> => {
    if (source === 'camera') {
      const res = await ImagePicker.requestCameraPermissionsAsync();
      if (!res.granted) {
        Alert.alert(
          'Permission refusée',
          "L'app a besoin d'accéder à la caméra pour prendre une photo. Tu peux l'activer dans Réglages → Boa Club.",
        );
        return false;
      }
    } else {
      const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!res.granted) {
        Alert.alert(
          'Permission refusée',
          "L'app a besoin d'accéder à ta galerie pour partager une photo.",
        );
        return false;
      }
    }
    return true;
  };

  const pickFromCamera = async () => {
    const ok = await ensureMediaPermission('camera');
    if (!ok) return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPreviewPhotoUri(result.assets[0].uri);
    }
  };

  const pickFromLibrary = async () => {
    const ok = await ensureMediaPermission('library');
    if (!ok) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPreviewPhotoUri(result.assets[0].uri);
    }
  };

  /** Ouvre l'action sheet pour choisir la source. */
  const openPhotoMenu = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Annuler', 'Prendre une photo', 'Choisir dans la galerie'],
          cancelButtonIndex: 0,
        },
        (idx) => {
          if (idx === 1) pickFromCamera();
          else if (idx === 2) pickFromLibrary();
        },
      );
    } else {
      // Android : Alert avec 2 boutons (pas d'ActionSheet natif sans lib).
      Alert.alert('Envoyer une photo', undefined, [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Prendre une photo', onPress: pickFromCamera },
        { text: 'Galerie', onPress: pickFromLibrary },
      ]);
    }
  };

  const sendPhoto = () => {
    if (!previewPhotoUri) return;
    // TODO : remplacer par l'upload réel quand POST /api/uploads sera dispo.
    // Pour l'instant on envoie un message texte de substitution.
    sendMutation.mutate(`📷 Photo envoyée`);
    setPreviewPhotoUri(null);
  };

  // ── VOICE ────────────────────────────────────────────────────────

  /**
   * Démarre l'enregistrement audio. Appelé sur appui long du bouton micro.
   */
  const startRecording = async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Permission refusée',
          "L'app a besoin d'accéder au micro pour enregistrer une note vocale.",
        );
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();

      // Timer d'affichage.
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      Alert.alert("Impossible de démarrer l'enregistrement.");
    }
  };

  /**
   * Arrête l'enregistrement et envoie la note vocale.
   * Appelé quand l'utilisateur relâche le bouton micro.
   */
  const stopAndSendRecording = async () => {
    if (!audioRecorder.isRecording) return;
    try {
      await audioRecorder.stop();
      const seconds = recordingSeconds;
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setRecordingSeconds(0);

      if (seconds < 1) {
        Alert.alert(
          'Trop court',
          'Maintiens appuyé pour enregistrer une note vocale (1 sec minimum).',
        );
        return;
      }

      // TODO : remplacer par l'upload réel quand POST /api/uploads sera dispo.
      sendMutation.mutate(`🎤 Note vocale (${seconds}s)`);
    } catch {
      // ignore
    }
  };

  const cancelRecording = async () => {
    if (audioRecorder.isRecording) {
      try {
        await audioRecorder.stop();
      } catch {
        // ignore
      }
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setRecordingSeconds(0);
  };

  // Cleanup au démontage : on ne laisse pas un enregistrement orphelin.
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

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

        {/* Indicateur d'enregistrement vocal en cours */}
        {audioRecorder.isRecording ? (
          <View style={styles.recordingBar}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>
              Enregistrement… {String(Math.floor(recordingSeconds / 60)).padStart(1, '0')}:
              {String(recordingSeconds % 60).padStart(2, '0')}
            </Text>
            <Pressable onPress={cancelRecording}>
              <Text style={styles.recordingCancel}>Annuler</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.inputBar}>
          <Pressable style={styles.iconBtn} onPress={openPhotoMenu}>
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
            <Pressable
              style={[styles.iconBtn, audioRecorder.isRecording && styles.iconBtnRecording]}
              onLongPress={startRecording}
              onPressOut={stopAndSendRecording}
              delayLongPress={250}
            >
              <Text style={styles.iconText}>🎤</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Modale aperçu photo */}
      <Modal
        visible={!!previewPhotoUri}
        animationType="slide"
        onRequestClose={() => setPreviewPhotoUri(null)}
      >
        <SafeAreaView style={styles.previewSafe} edges={['top', 'bottom']}>
          <View style={styles.previewHeader}>
            <Pressable onPress={() => setPreviewPhotoUri(null)}>
              <Text style={styles.previewCancel}>Annuler</Text>
            </Pressable>
            <Text style={styles.previewTitle}>Aperçu</Text>
            <View style={{ width: 60 }} />
          </View>
          {previewPhotoUri ? (
            <Image
              source={{ uri: previewPhotoUri }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          ) : null}
          <View style={styles.previewFooter}>
            <Pressable
              style={styles.previewSendBtn}
              onPress={sendPhoto}
              disabled={sendMutation.isPending}
            >
              <Text style={styles.previewSendText}>Envoyer</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
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

  // Indicateur d'enregistrement vocal en cours.
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.alert.absent.bg,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  recordingText: {
    flex: 1,
    fontSize: 13,
    color: colors.alert.absent.text,
    fontWeight: '600',
  },
  recordingCancel: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '700',
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
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnRecording: {
    backgroundColor: colors.alert.absent.bg,
  },
  iconText: { fontSize: 19 },
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { fontSize: 17, color: colors.white, fontWeight: '700' },

  // Modale aperçu photo.
  previewSafe: { flex: 1, backgroundColor: colors.black },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  previewCancel: { fontSize: 15, color: colors.white, width: 60 },
  previewTitle: { fontSize: 15, color: colors.white, fontWeight: '600' },
  previewImage: { flex: 1, width: '100%' },
  previewFooter: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'flex-end',
  },
  previewSendBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 999,
  },
  previewSendText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});
