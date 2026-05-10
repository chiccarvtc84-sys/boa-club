import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import type { Discipline } from '../data/mockCourses';

interface BadgeProps {
  discipline: Discipline;
}

export function Badge({ discipline }: BadgeProps) {
  const { bg, fg, border, label } = STYLES[discipline];
  return (
    <View style={[styles.pill, { backgroundColor: bg, borderColor: border, borderWidth: border ? 0.5 : 0 }]}>
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </View>
  );
}

const STYLES: Record<Discipline, { bg: string; fg: string; border?: string; label: string }> = {
  gi: { bg: colors.black, fg: colors.white, label: 'Gi' },
  nogi: { bg: colors.primary, fg: colors.white, label: 'No-Gi' },
  mma: { bg: '#FEE2E2', fg: '#991B1B', border: colors.primary, label: 'MMA' },
  openmat: { bg: '#ECFDF5', fg: '#065F46', label: 'Open Mat' },
  mixed: { bg: colors.gray100, fg: colors.black, label: 'Mixte' },
};

// Tâche 5 : badges légèrement plus grands pour la lisibilité dans Planning.
const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 999,
  },
  text: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
