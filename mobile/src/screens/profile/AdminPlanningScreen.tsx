import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { coursesApi, type RecurringCourseDTO } from '../../api/courses';
import { colors } from '../../theme/colors';
import type { ProfileStackNavigation } from '../../navigation/ProfileStack';

interface AdminPlanningScreenProps {
  navigation: ProfileStackNavigation<'AdminPlanning'>;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dayOfWeekBackend(iso: string): number {
  // Postgres convention : 0=Dim, 1=Lun, ..., 6=Sam
  return new Date(iso + 'T00:00:00').getDay();
}
function formatHumanDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const months = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function AdminPlanningScreen({ navigation }: AdminPlanningScreenProps) {
  const [date, setDate] = useState<string>(todayISO());

  // On récupère le planning de la semaine contenant la date sélectionnée.
  const { data, isLoading } = useQuery({
    queryKey: ['courses', 'week', date],
    queryFn: () => coursesApi.week(date),
  });

  const dayBackend = dayOfWeekBackend(date);
  const coursesOfDay = useMemo<RecurringCourseDTO[]>(
    () => (data?.courses ?? []).filter((c) => c.day_of_week === dayBackend),
    [data, dayBackend],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Planning complet</Text>
          <Text style={styles.subtitle}>Choisis une date</Text>
        </View>
      </View>

      <View style={styles.datePickerBar}>
        <Pressable
          style={styles.arrow}
          onPress={() => setDate(shiftDate(date, -1))}
        >
          <Text style={styles.arrowText}>‹</Text>
        </Pressable>
        <Text style={styles.dateLabel} numberOfLines={1}>
          {formatHumanDate(date)}
        </Text>
        <TextInput
          style={styles.dateInput}
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.gray400}
        />
        <Pressable
          style={styles.arrow}
          onPress={() => setDate(shiftDate(date, 1))}
        >
          <Text style={styles.arrowText}>›</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
        ) : coursesOfDay.length === 0 ? (
          <Text style={styles.empty}>Aucun cours ce jour.</Text>
        ) : (
          coursesOfDay.map((c) => (
            <View key={c.id} style={styles.courseCard}>
              <Text style={styles.courseTime}>
                {c.start_time} — {c.end_time}
              </Text>
              <Text style={styles.courseName}>{c.name}</Text>
              {c.coach_name ? (
                <Text style={styles.courseCoach}>avec {c.coach_name}</Text>
              ) : null}
              {c.location ? (
                <Text style={styles.courseLoc}>{c.location}</Text>
              ) : null}
              <View style={styles.actions}>
                <Pressable
                  style={[styles.action, styles.actionWarn]}
                  onPress={() =>
                    navigation.navigate('AdminNotify', {
                      courseId: c.id,
                      courseName: c.name,
                      defaultType: 'late',
                      date,
                    })
                  }
                >
                  <Text style={styles.actionWarnText}>Retard</Text>
                </Pressable>
                <Pressable
                  style={[styles.action, styles.actionDanger]}
                  onPress={() =>
                    navigation.navigate('AdminNotify', {
                      courseId: c.id,
                      courseName: c.name,
                      defaultType: 'absent',
                      date,
                    })
                  }
                >
                  <Text style={styles.actionDangerText}>Absence</Text>
                </Pressable>
                <Pressable
                  style={[styles.action]}
                  onPress={() =>
                    navigation.navigate('AdminEditCourse', {
                      courseId: c.id,
                      courseName: c.name,
                    })
                  }
                >
                  <Text style={styles.actionText}>Modifier</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
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

  datePickerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.gray50,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  arrow: {
    width: 30,
    height: 30,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: { fontSize: 16, fontWeight: '700', color: colors.black },
  dateLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: colors.black },
  dateInput: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 11,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    color: colors.black,
    minWidth: 100,
  },

  scroll: { padding: 14 },
  empty: { fontSize: 12, color: colors.gray500, textAlign: 'center', paddingVertical: 30 },

  courseCard: {
    backgroundColor: colors.white,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  courseTime: { fontSize: 11, color: colors.gray600, fontWeight: '600' },
  courseName: { fontSize: 14, fontWeight: '600', color: colors.black, marginTop: 2 },
  courseCoach: { fontSize: 12, color: colors.gray600, marginTop: 3 },
  courseLoc: { fontSize: 11, color: colors.gray500, marginTop: 2, fontStyle: 'italic' },

  actions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: colors.gray100,
  },
  action: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 7,
    borderWidth: 0.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  actionText: { color: colors.black, fontWeight: '600', fontSize: 11 },
  actionWarn: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' },
  actionWarnText: { color: '#92400E', fontWeight: '600', fontSize: 11 },
  actionDanger: { backgroundColor: '#FEE2E2', borderColor: colors.primary },
  actionDangerText: { color: '#991B1B', fontWeight: '600', fontSize: 11 },
});
