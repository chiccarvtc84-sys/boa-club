import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { dayLabels, type DayOfWeek } from '../data/mockCourses';

interface DayTabsProps {
  selected: DayOfWeek;
  onSelect: (day: DayOfWeek) => void;
  /** courseKeys par jour qui ont une alerte coach (point rouge sous le numéro). */
  daysWithAlert: Set<DayOfWeek>;
}

export function DayTabs({ selected, onSelect, daysWithAlert }: DayTabsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.container}
    >
      {dayLabels.map((day, idx) => {
        const dayIdx = idx as DayOfWeek;
        const isActive = selected === dayIdx;
        const hasAlert = daysWithAlert.has(dayIdx);
        return (
          <Pressable
            key={day.short}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onSelect(dayIdx)}
          >
            <Text style={styles.label}>{day.short}</Text>
            <Text style={styles.num}>{day.date}</Text>
            <View style={[styles.dot, !hasAlert && styles.dotHidden]} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0, // Empêche le ScrollView horizontal d'étirer le parent en hauteur.
    backgroundColor: colors.white,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  container: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    alignItems: 'center',
  },
  tab: {
    minWidth: 44,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.gray200,
    borderColor: colors.primary,
    borderWidth: 2,
    paddingVertical: 4.5,
    paddingHorizontal: 11.5,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.primary,
  },
  num: {
    fontSize: 17,
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
