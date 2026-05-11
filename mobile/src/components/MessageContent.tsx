/**
 * Rend le contenu d'un message (texte / photo / note vocale) dans une bulle
 * de chat. Utilisé par ConversationScreen (DM) et SlotDetailScreen (créneau).
 *
 * - Texte    → simple Text
 * - Photo    → Image cliquable (zoom plein écran via callback)
 * - Voix     → mini-player avec play/pause + durée
 *
 * Pour la lecture audio, on utilise un sous-composant `VoiceBubble` qui
 * instancie son propre useAudioPlayer (un par message visible). C'est
 * acceptable tant qu'on n'affiche pas des centaines de messages d'un coup.
 */
import { useEffect } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { colors } from '../theme/colors';
import type { MessageDTO } from '../api/messages';

interface MessageContentProps {
  message: MessageDTO;
  isMine: boolean;
  /** Callback quand on tap sur une photo → ouvre la zoom modal côté parent. */
  onImagePress?: (uri: string) => void;
}

export function MessageContent({ message, isMine, onImagePress }: MessageContentProps) {
  // === Photo ===
  if (message.type === 'photo' && message.media_url) {
    return (
      <Pressable onPress={() => onImagePress?.(message.media_url!)}>
        <Image
          source={{ uri: message.media_url }}
          style={photoStyles.image}
          resizeMode="cover"
        />
        {message.content ? (
          <Text style={[photoStyles.caption, isMine ? styles.mineText : styles.themText]}>
            {message.content}
          </Text>
        ) : null}
      </Pressable>
    );
  }

  // === Note vocale ===
  if (message.type === 'voice' && message.media_url) {
    return (
      <VoiceBubble
        uri={message.media_url}
        durationSeconds={message.media_duration_seconds ?? 0}
        isMine={isMine}
      />
    );
  }

  // === Texte par défaut ===
  return (
    <Text style={isMine ? styles.mineText : styles.themText}>
      {message.content ?? ''}
    </Text>
  );
}

interface VoiceBubbleProps {
  uri: string;
  durationSeconds: number;
  isMine: boolean;
}

function VoiceBubble({ uri, durationSeconds, isMine }: VoiceBubbleProps) {
  /*
   * useAudioPlayer crée un player lazy. On le pause systématiquement au
   * démontage pour éviter qu'il continue de jouer si l'user quitte l'écran.
   */
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {
        // ignore (player peut être déjà libéré)
      }
    };
  }, [player]);

  const onToggle = () => {
    if (status.playing) {
      player.pause();
    } else {
      // Si on est en fin de piste, on revient au début avant de relancer.
      if (status.currentTime >= status.duration - 0.05) {
        player.seekTo(0);
      }
      player.play();
    }
  };

  // Affiche la durée totale (immutable) plutôt que le compteur live —
  // évite les re-renders fréquents pour chaque tick d'horloge.
  const label = formatVoiceDuration(durationSeconds || status.duration || 0);
  const isLoading = !status.isLoaded;

  return (
    <Pressable onPress={onToggle} style={voiceStyles.row}>
      <View
        style={[
          voiceStyles.playBtn,
          { backgroundColor: isMine ? 'rgba(255,255,255,0.25)' : colors.gray200 },
        ]}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={isMine ? colors.white : colors.black} />
        ) : (
          <Text style={[voiceStyles.playIcon, { color: isMine ? colors.white : colors.black }]}>
            {status.playing ? '⏸' : '▶'}
          </Text>
        )}
      </View>
      {/* "Waveform" stylisée — barres factices, pas vraiment de l'audio analysé */}
      <View style={voiceStyles.waveform}>
        {Array.from({ length: 18 }).map((_, i) => (
          <View
            key={i}
            style={[
              voiceStyles.bar,
              {
                height: 4 + Math.abs(Math.sin(i * 1.3)) * 14,
                backgroundColor: isMine ? 'rgba(255,255,255,0.7)' : colors.gray500,
              },
            ]}
          />
        ))}
      </View>
      <Text style={[voiceStyles.duration, { color: isMine ? colors.white : colors.gray600 }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function formatVoiceDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  mineText: { fontSize: 13.5, color: colors.chat.mineText, lineHeight: 18 },
  themText: { fontSize: 13.5, color: colors.chat.themText, lineHeight: 18 },
});

const photoStyles = StyleSheet.create({
  image: {
    width: 220,
    height: 220,
    borderRadius: 14,
    backgroundColor: colors.gray200,
  },
  caption: { fontSize: 13, marginTop: 6 },
});

const voiceStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 200,
    paddingVertical: 4,
  },
  playBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: { fontSize: 14, lineHeight: 16 },
  waveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 22,
    gap: 2,
  },
  bar: {
    width: 2.5,
    borderRadius: 1,
  },
  duration: { fontSize: 11, fontWeight: '600', minWidth: 32, textAlign: 'right' },
});
