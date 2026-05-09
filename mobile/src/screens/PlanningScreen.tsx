import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { broadcastsApi } from '../api/admin';
import {
  backendDayToMobile,
  coursesApi,
  type CourseDiscipline,
  type CourseInstanceOverrideDTO,
  type RecurringCourseDTO,
} from '../api/courses';
import { BoaLogo } from '../components/BoaLogo';
import { BroadcastBanner } from '../components/BroadcastBanner';
import { CourseCard } from '../components/CourseCard';
import { DayTabs } from '../components/DayTabs';
import { dayLabels, type Course, type DayOfWeek, type Discipline } from '../data/mockCourses';
import { useNotificationsStore } from '../store/notificationsStore';
import { colors } from '../theme/colors';

const DISCIPLINE_MAP: Record<CourseDiscipline, Discipline> = {
  jjb_gi: 'gi',
  jjb_nogi: 'nogi',
  mma: 'mma',
  open_mat: 'openmat',
  wrestling: 'mixed',
  mixed: 'mixed',
};

/**
 * Construit une `courseKey` stable depuis un cours (utilisée pour la sync notifs).
 * Logique : on dérive du nom du cours en kebab-case, simplifié.
 */
function courseKeyFromName(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // retire les accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  // Mapping ad-hoc pour matcher les keys utilisées par le store de notifs.
  if (slug.includes('jjb')) return 'jjb-gi';
  if (slug.includes('grappling') && slug.includes('debutant')) return 'grappling-debutant';
  if (slug.includes('grappling') && slug.includes('confirme')) return 'grappling-confirme';
  if (slug.startsWith('mma')) return 'mma';
  if (slug.includes('open-mat')) return 'open-mat';
  return slug;
}

function dtoToCourse(
  dto: RecurringCourseDTO,
  instances: CourseInstanceOverrideDTO[],
): Course {
  const mobileDay = backendDayToMobile(dto.day_of_week) as DayOfWeek;

  // Cherche un override applicable cette semaine pour ce cours.
  const override = instances.find((i) => i.recurring_course_id === dto.id);

  let alert: Course['alert'];
  if (override?.coach_late_minutes) {
    alert = {
      type: 'late',
      message: `Coach en retard de ${override.coach_late_minutes} min — démarrez l'échauffement entre vous`,
    };
  } else if (override?.status === 'free_open') {
    alert = {
      type: 'absent',
      message: override.coach_absent_message ?? 'Coach absent — cours libre maintenu',
    };
  } else if (override?.status === 'cancelled') {
    alert = { type: 'absent', message: 'Cours annulé' };
  }

  return {
    id: dto.id,
    courseKey: courseKeyFromName(dto.name),
    dayOfWeek: mobileDay,
    startTime: dto.start_time,
    endTime: dto.end_time,
    name: dto.name,
    coachName: dto.coach_name ?? null,
    location: dto.location ?? '',
    discipline: DISCIPLINE_MAP[dto.discipline] ?? 'mixed',
    alert,
  };
}

export function PlanningScreen() {
  const followedCourseKeys = useNotificationsStore((s) => s.followed);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(1);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['courses', 'week'],
    queryFn: () => coursesApi.week(),
  });

  // Broadcasts actifs (alertes coach diffusées à tous les adhérents).
  const { data: broadcastData } = useQuery({
    queryKey: ['broadcasts', 'active'],
    queryFn: () => broadcastsApi.active(),
    refetchInterval: 30000, // 30s : balance entre fraîcheur et coût
  });
  const activeBroadcast = broadcastData?.broadcasts[0] ?? null;

  const dismissMutation = useMutation({
    mutationFn: (id: string) => broadcastsApi.dismiss(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
    },
  });

  const courses = useMemo<Course[]>(() => {
    if (!data) return [];
    return data.courses.map((c) => dtoToCourse(c, data.instances));
  }, [data]);

  const daysWithAlert = useMemo(() => {
    const set = new Set<DayOfWeek>();
    for (const c of courses) {
      if (c.alert) set.add(c.dayOfWeek);
    }
    return set;
  }, [courses]);

  const coursesOfDay = useMemo(
    () => courses.filter((c) => c.dayOfWeek === selectedDay),
    [courses, selectedDay],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <BoaLogo size={38} />
        <View style={styles.headerText}>
          <Text style={styles.title}>CLUBE DESPORTIVO BOA</Text>
          <Text style={styles.subtitle}>Sorgues · Vedène</Text>
        </View>
      </View>

      <BroadcastBanner
        broadcast={
          activeBroadcast
            ? {
                author: activeBroadcast.author_display_name,
                message: activeBroadcast.message,
              }
            : null
        }
        onDismiss={() => activeBroadcast && dismissMutation.mutate(activeBroadcast.id)}
      />

      <DayTabs
        selected={selectedDay}
        onSelect={setSelectedDay}
        daysWithAlert={daysWithAlert}
      />

      <View style={styles.legend}>
        <View style={styles.legendDot} />
        <Text style={styles.legendText}>
          Le point rouge indique une info coach (retard, absence)
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>⚠</Text>
            <Text style={styles.emptyText}>
              Impossible de charger le planning. Vérifie ta connexion.
            </Text>
          </View>
        ) : coursesOfDay.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>○</Text>
            <Text style={styles.emptyText}>Aucun cours ce jour.</Text>
          </View>
        ) : (
          coursesOfDay.map((c) => (
            <CourseCard
              key={c.id}
              course={c}
              notificationOn={followedCourseKeys.has(c.courseKey)}
            />
          ))
        )}
        <Text style={styles.dayFooter}>
          {dayLabels[selectedDay].full} {dayLabels[selectedDay].date} mai
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 13, fontWeight: '700', color: colors.black },
  subtitle: { fontSize: 11, color: colors.gray500, marginTop: 1 },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 8,
    backgroundColor: colors.white,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  legendDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  legendText: { fontSize: 10, color: colors.gray500 },
  scroll: { padding: 14, paddingTop: 12 },
  loading: { paddingVertical: 50, alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 50 },
  emptyIcon: {
    fontSize: 28,
    color: colors.gray400,
    opacity: 0.3,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    color: colors.gray600,
    lineHeight: 19,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  dayFooter: {
    fontSize: 10,
    color: colors.gray400,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
});
