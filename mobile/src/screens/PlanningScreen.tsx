import { useEffect, useMemo, useState } from 'react';
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
import { type Course, type DayOfWeek, type Discipline } from '../data/mockCourses';
import { useNotificationsStore } from '../store/notificationsStore';
import { colors } from '../theme/colors';
import {
  dateToDayOfWeek,
  formatLongDate,
  getMonthDays,
  isSameMonth,
} from '../utils/dates';

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
 */
function courseKeyFromName(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
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

/** Clé locale "YYYY-MM-DD" pour les sets de jours alertés. */
function localKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function PlanningScreen() {
  const followedCourseKeys = useNotificationsStore((s) => s.followed);
  const queryClient = useQueryClient();

  /*
   * Tâche 1 : on travaille avec des Date réelles (heure locale du téléphone)
   * et plus avec un index `DayOfWeek` figé. La sélection part d'aujourd'hui,
   * les onglets affichent tous les jours du mois en cours, et on bloque la
   * navigation hors du mois (pas de précédent/suivant manuel).
   */
  const [now, setNow] = useState(() => new Date());

  // Resync quotidien : si l'app reste ouverte au passage de minuit, on
  // recharge la "date du jour" pour basculer sur le bon mois et le bon jour.
  // Vérification tous les 60 sec, peu coûteux.
  useEffect(() => {
    const interval = setInterval(() => {
      const fresh = new Date();
      setNow((prev) => (prev.toDateString() !== fresh.toDateString() ? fresh : prev));
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const monthDays = useMemo(
    () => getMonthDays(now.getFullYear(), now.getMonth()),
    [now],
  );

  // Le jour sélectionné démarre sur "aujourd'hui" et reste dans le mois courant.
  const [selectedDate, setSelectedDate] = useState<Date>(now);

  // Clamp : si la sélection sort du mois courant (basculement mensuel pendant
  // que l'app est ouverte), on remet sur aujourd'hui.
  useEffect(() => {
    if (!isSameMonth(selectedDate, now)) {
      setSelectedDate(now);
    }
  }, [now, selectedDate]);

  const selectedDow = dateToDayOfWeek(selectedDate);

  const { data, isLoading, error } = useQuery({
    queryKey: ['courses', 'week'],
    queryFn: () => coursesApi.week(),
  });

  const { data: broadcastData } = useQuery({
    queryKey: ['broadcasts', 'active'],
    queryFn: () => broadcastsApi.active(),
    refetchInterval: 30000,
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

  /*
   * Mapping "weekday alerté" → "dates concrètes du mois où cette alerte
   * apparaît". On marque uniquement la PROCHAINE occurrence à partir
   * d'aujourd'hui (l'API ne nous donne que la semaine en cours, donc on
   * ne triche pas en marquant des Mondays futurs sans donnée).
   */
  const daysWithAlertKeys = useMemo(() => {
    const alertedWeekdays = new Set<DayOfWeek>();
    for (const c of courses) {
      if (c.alert) alertedWeekdays.add(c.dayOfWeek);
    }
    const keys = new Set<string>();
    for (const day of monthDays) {
      if (day < new Date(now.getFullYear(), now.getMonth(), now.getDate())) continue;
      if (alertedWeekdays.has(dateToDayOfWeek(day))) {
        keys.add(localKey(day));
        // Une seule occurrence par weekday (la plus proche).
        alertedWeekdays.delete(dateToDayOfWeek(day));
      }
    }
    return keys;
  }, [courses, monthDays, now]);

  const coursesOfDay = useMemo(
    () => courses.filter((c) => c.dayOfWeek === selectedDow),
    [courses, selectedDow],
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
        days={monthDays}
        selected={selectedDate}
        onSelect={setSelectedDate}
        daysWithAlertKeys={daysWithAlertKeys}
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
        <Text style={styles.dayFooter}>{formatLongDate(selectedDate)}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// Tâche 5 : header un peu plus aéré pour la lisibilité.
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: '800', color: colors.black, letterSpacing: 0.3 },
  subtitle: { fontSize: 11.5, color: colors.gray500, marginTop: 1.5 },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 9,
    paddingTop: 2,
    backgroundColor: colors.white,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  legendText: { fontSize: 10.5, color: colors.gray500 },
  scroll: { padding: 14, paddingTop: 14 },
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
    fontSize: 11,
    color: colors.gray500,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 6,
    fontStyle: 'italic',
  },
});
