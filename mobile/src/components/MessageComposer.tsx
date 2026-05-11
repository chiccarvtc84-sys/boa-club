/**
 * Barre de saisie unifiée pour les conversations (DM + threads de créneaux).
 *
 * Fonctions :
 *  - Saisie texte multi-ligne
 *  - 📷 Bouton photo : action sheet (caméra / galerie) → preview modal →
 *    upload R2 → envoi en tant que message photo (type='photo', media_url).
 *  - 🎤 Bouton voix : appui long pour enregistrer, relâche pour upload R2 +
 *    envoi en tant que note vocale (type='voice', media_url, duration).
 *
 * Le composant gère lui-même les mutations d'envoi (texte + média). Le parent
 * fournit `conversationId` + `onSent` pour invalider ses propres caches
 * react-query.
 */
import { useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';

import { messagesApi } from '../api/messages';
import { uploadFile, UploadError } from '../api/uploads';
import { colors } from '../theme/colors';

interface MessageComposerProps {
  conversationId: string;
  onSent?: () => void;
  placeholder?: string;
}

export function MessageComposer({
  conversationId,
  onSent,
  placeholder = 'Aa',
}: MessageComposerProps) {
  const [draft, setDraft] = useState('');
  const [previewPhotoUri, setPreviewPhotoUri] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // État d'upload séparé du sendMutation pour afficher 2 phases :
  //   1. "Upload en cours" pendant que R2 reçoit le binaire
  //   2. "Envoi du message" pendant que /api/conversations/:id/messages tourne
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // ── Mutations ────────────────────────────────────────────────────

  const sendTextMutation = useMutation({
    mutationFn: (content: string) => messagesApi.send(conversationId, content),
    onSuccess: () => onSent?.(),
  });

  const sendPhotoMutation = useMutation({
    mutationFn: (mediaUrl: string) => messagesApi.sendPhoto(conversationId, mediaUrl),
    onSuccess: () => onSent?.(),
  });

  const sendVoiceMutation = useMutation({
    mutationFn: (params: { mediaUrl: string; durationSec: number }) =>
      messagesApi.sendVoice(conversationId, params.mediaUrl, params.durationSec),
    onSuccess: () => onSent?.(),
  });

  // ── Texte ────────────────────────────────────────────────────────

  const onSendText = () => {
    const text = draft.trim();
    if (!text) return;
    sendTextMutation.mutate(text);
    setDraft('');
  };

  // ── Photos ───────────────────────────────────────────────────────

  const ensureMediaPermission = async (
    source: 'camera' | 'library',
  ): Promise<boolean> => {
    if (source === 'camera') {
      const res = await ImagePicker.requestCameraPermissionsAsync();
      if (!res.granted) {
        Alert.alert(
          'Permission refusée',
          "L'app a besoin d'accéder à la caméra pour prendre une photo.",
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
    if (!(await ensureMediaPermission('camera'))) return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPreviewPhotoUri(result.assets[0].uri);
    }
  };

  const pickFromLibrary = async () => {
    if (!(await ensureMediaPermission('library'))) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPreviewPhotoUri(result.assets[0].uri);
    }
  };

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
      Alert.alert('Envoyer une photo', undefined, [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Prendre une photo', onPress: pickFromCamera },
        { text: 'Galerie', onPress: pickFromLibrary },
      ]);
    }
  };

  /**
   * Upload R2 puis envoi du message photo. Si l'upload échoue (R2 down,
   * timeout, fichier trop gros), on prévient l'utilisateur sans rien envoyer.
   */
  const sendPhoto = async () => {
    if (!previewPhotoUri) return;
    setIsUploadingMedia(true);
    try {
      const publicUrl = await uploadFile(previewPhotoUri, { prefix: 'messages' });
      setPreviewPhotoUri(null);
      sendPhotoMutation.mutate(publicUrl);
    } catch (err) {
      const detail =
        err instanceof UploadError
          ? err.message
          : 'Impossible d\'envoyer la photo.';
      Alert.alert('Échec', detail);
    } finally {
      setIsUploadingMedia(false);
    }
  };

  // ── Voix ─────────────────────────────────────────────────────────

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

      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      Alert.alert("Impossible de démarrer l'enregistrement.");
    }
  };

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

      // expo-audio expose l'URI du fichier enregistré via `audioRecorder.uri`.
      const uri = audioRecorder.uri;
      if (!uri) {
        Alert.alert('Erreur', "Enregistrement introuvable.");
        return;
      }

      setIsUploadingMedia(true);
      try {
        const publicUrl = await uploadFile(uri, {
          prefix: 'messages',
          contentType: 'audio/mp4', // expo-audio HIGH_QUALITY produit du AAC dans un container MP4
          fileName: `voice-${Date.now()}.m4a`,
        });
        sendVoiceMutation.mutate({ mediaUrl: publicUrl, durationSec: seconds });
      } catch (err) {
        const detail =
          err instanceof UploadError
            ? err.message
            : "Impossible d'envoyer la note vocale.";
        Alert.alert('Échec', detail);
      } finally {
        setIsUploadingMedia(false);
      }
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

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  const isBusy =
    isUploadingMedia ||
    sendTextMutation.isPending ||
    sendPhotoMutation.isPending ||
    sendVoiceMutation.isPending;

  return (
    <>
      {/* Bandeau "envoi en cours" si on uploade un média */}
      {isUploadingMedia ? (
        <View style={styles.uploadBar}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.uploadText}>Envoi du média en cours…</Text>
        </View>
      ) : null}

      {/* Indicateur d'enregistrement vocal en cours */}
      {audioRecorder.isRecording ? (
        <View style={styles.recordingBar}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>
            Enregistrement…{' '}
            {String(Math.floor(recordingSeconds / 60)).padStart(1, '0')}:
            {String(recordingSeconds % 60).padStart(2, '0')}
          </Text>
          <Pressable onPress={cancelRecording}>
            <Text style={styles.recordingCancel}>Annuler</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.inputBar}>
        <Pressable
          style={styles.iconBtn}
          onPress={openPhotoMenu}
          disabled={isBusy}
        >
          <Text style={[styles.iconText, isBusy && styles.iconTextDisabled]}>
            📷
          </Text>
        </Pressable>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={placeholder}
            placeholderTextColor={colors.gray400}
            multiline
            onSubmitEditing={onSendText}
            blurOnSubmit
            editable={!isBusy}
          />
        </View>
        {draft.trim() ? (
          <Pressable
            style={styles.sendBtn}
            onPress={onSendText}
            disabled={isBusy}
          >
            <Text style={styles.sendText}>→</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[
              styles.iconBtn,
              audioRecorder.isRecording && styles.iconBtnRecording,
            ]}
            onLongPress={startRecording}
            onPressOut={stopAndSendRecording}
            delayLongPress={250}
            disabled={isBusy && !audioRecorder.isRecording}
          >
            <Text style={[styles.iconText, isBusy && !audioRecorder.isRecording && styles.iconTextDisabled]}>
              🎤
            </Text>
          </Pressable>
        )}
      </View>

      {/*
        Modale aperçu photo.
        UX accessibilité :
        - presentationStyle="pageSheet" → swipe-down natif iOS pour fermer
        - Croix ✕ en haut-droite avec hitSlop 16 (zone tactile généreuse,
          fonctionne même sous Dynamic Island)
        - 2 boutons en bas dans la zone du pouce : "Annuler" + "Envoyer"
          → l'utilisateur n'a JAMAIS à atteindre le haut de l'écran
      */}
      <Modal
        visible={!!previewPhotoUri}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPreviewPhotoUri(null)}
      >
        <SafeAreaView style={styles.previewSafe} edges={['top', 'bottom']}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle}>Aperçu</Text>
            <Pressable
              onPress={() => setPreviewPhotoUri(null)}
              disabled={isUploadingMedia}
              hitSlop={16}
              style={styles.previewCloseBtn}
            >
              <Text style={styles.previewCloseIcon}>✕</Text>
            </Pressable>
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
              onPress={() => setPreviewPhotoUri(null)}
              disabled={isUploadingMedia}
              style={styles.previewCancelBtn}
              hitSlop={8}
            >
              <Text style={styles.previewCancelText}>Annuler</Text>
            </Pressable>
            <Pressable
              style={[styles.previewSendBtn, isUploadingMedia && styles.previewSendBtnDisabled]}
              onPress={sendPhoto}
              disabled={isUploadingMedia}
            >
              {isUploadingMedia ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.previewSendText}>Envoyer</Text>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  uploadBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.gray50,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
  },
  uploadText: {
    flex: 1,
    fontSize: 12.5,
    color: colors.gray700,
    fontWeight: '500',
  },

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
  iconTextDisabled: { opacity: 0.4 },
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

  previewSafe: { flex: 1, backgroundColor: colors.black },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  previewTitle: { fontSize: 16, color: colors.white, fontWeight: '600' },
  // Croix ✕ ronde en haut-droite, grosse zone tactile.
  previewCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  previewCloseIcon: {
    fontSize: 18,
    color: colors.white,
    fontWeight: '700',
    lineHeight: 18,
  },
  previewImage: { flex: 1, width: '100%' },
  // Footer : 2 boutons côte-à-côte, full-width, dans la zone du pouce.
  previewFooter: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
    alignItems: 'center',
  },
  previewCancelBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
  },
  previewCancelText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  previewSendBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
  },
  previewSendBtnDisabled: { opacity: 0.6 },
  previewSendText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});
