import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

export interface BroadcastInfo {
  author: string;
  message: string;
}

interface BroadcastBannerProps {
  broadcast: BroadcastInfo | null;
  onDismiss: () => void;
}

export function BroadcastBanner({ broadcast, onDismiss }: BroadcastBannerProps) {
  if (!broadcast) return null;
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>📢</Text>
      <View style={styles.content}>
        <Text style={styles.author}>De {broadcast.author}</Text>
        <Text style={styles.message}>{broadcast.message}</Text>
      </View>
      <Pressable style={styles.close} onPress={onDismiss} accessibilityLabel="Fermer">
        <Text style={styles.closeText}>×</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  icon: { fontSize: 16, color: colors.white, paddingTop: 2 },
  content: { flex: 1, minWidth: 0 },
  author: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.white,
    opacity: 0.9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  message: {
    fontSize: 12.5,
    color: colors.white,
    lineHeight: 17,
    marginTop: 2,
  },
  close: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 18,
    color: colors.white,
    opacity: 0.85,
    lineHeight: 18,
  },
});
