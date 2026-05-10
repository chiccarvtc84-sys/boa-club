import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  SHORT_DAY_LABELS,
  dateToDayOfWeek,
  isSameLocalDay,
} from '../utils/dates';
import { colors } from '../theme/colors';

interface DayTabsProps {
  /** Tous les jours navigables (typiquement le mois en cours). */
  days: Date[];
  /** Date actuellement sélectionnée. */
  selected: Date;
  /** Callback de sélection. */
  onSelect: (day: Date) => void;
  /**
   * Set de keys "YYYY-MM-DD" en heure locale, pour les jours qui ont une
   * info coach (retard, absence). On reçoit des strings et pas des Date pour
   * pouvoir les utiliser comme membre de Set facilement.
   */
  daysWithAlertKeys: Set<string>;
}

/** Clé locale "YYYY-MM-DD" pour comparer 2 jours. */
function localKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const TAB_WIDTH = 56; // largeur approximative d'un tab + gap, pour scrollTo()

export function DayTabs({ days, selected, onSelect, daysWithAlertKeys }: DayTabsProps) {
  const scrollRef = useRef<ScrollView>(null);

  // Quand le jour sélectionné change (ou au montage), on auto-scroll pour le
  // garder visible et centré tant que possible.
  useEffect(() => {
    const idx = days.findIndex((d) => isSameLocalDay(d, selected));
    if (idx < 0 || !scrollRef.current) return;
    // Centre approximatif du tab dans la viewport.
    const offset = Math.max(0, idx * TAB_WIDTH - 100);
    scrollRef.current.scrollTo({ x: offset, animated: true });
  }, [days, selected]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.container}
    >
      {days.map((day) => {
        const isActive = isSameLocalDay(day, selected);
        const dow = dateToDayOfWeek(day);
        const hasAlert = daysWithAlertKeys.has(localKey(day));
        return (
          <Pressable
            key={day.toISOString()}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onSelect(day)}
          >
            <Text style={styles.label}>{SHORT_DAY_LABELS[dow]}</Text>
            <Text style={styles.num}>{day.getDate()}</Text>
            <View style={[styles.dot, !hasAlert && styles.dotHidden]} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// Tâche 5 : tabs un tout petit peu plus grands pour la lisibilité.
const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
    backgroundColor: colors.white,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  container: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 6,
    alignItems: 'center',
  },
  tab: {
    minWidth: 48,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.gray200,
    borderColor: colors.primary,
    borderWidth: 2,
    paddingVertical: 5.5,
    paddingHorizontal: 11.5,
  },
  label: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.primary,
  },
  num: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.black,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.primary,
    marginTop: 2,
  },
  dotHidden: { opacity: 0 },
});
