import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { coursesApi, type RecurringCourseDTO } from '../../api/courses';
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../theme/colors';
import type { ProfileStackNavigation } from '../../navigation/ProfileStack';

interface AdminDashboardScreenProps {
  navigation: ProfileStackNavigation<'AdminDashboard'>;
}

export function AdminDashboardScreen({ navigation }: AdminDashboardScreenProps) {
  const user = useAuthStore((s) => s.user);

  // Cours du jour (à partir du planning hebdo).
  const { data, isLoading } = useQuery({
    queryKey: ['courses', 'week'],
    queryFn: () => coursesApi.week(),
  });

  // Backend day : 0=Dim, 1=Lun, …, 6=Sam
  const todayBackendDay = new Date().getDay();
  const todayCourses = useMemo<RecurringCourseDTO[]>(
    () => (data?.courses ?? []).filter((c) => c.day_of_week === todayBackendDay),
    [data, todayBackendDay],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Espace coach</Text>
          <Text style={styles.subtitle}>Gestion du planning</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.modeBanner}>
          <Text style={styles.modeBannerIcon}>🛡️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.modeBannerTitle}>Mode admin</Text>
            <Text style={styles.modeBannerText}>
              Annonce un retard, une absence, ou envoie une alerte. Les adhérents reçoivent
              une notif.
            </Text>
          </View>
        </View>

        <Pressable
          style={styles.cta}
          onPress={() => navigation.navigate('AdminBroadcast')}
        >
          <Text style={styles.ctaIcon}>📢</Text>
          <Text style={styles.ctaText}>Envoyer une alerte aux adhérents</Text>
          <Text style={styles.ctaArrow}>›</Text>
        </Pressable>

        <Text style={styles.sectionHeader}>
          Aujourd'hui — {formatDayHeader(new Date())}
        </Text>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
        ) : todayCourses.length === 0 ? (
          <Text style={styles.empty}>Aucun cours aujourd'hui.</Text>
        ) : (
          todayCourses.map((c) => (
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
                      date: todayISO(),
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
                      date: todayISO(),
                    })
                  }
                >
                  <Text style={styles.actionDangerText}>Absence</Text>
                </Pressable>
                <Pressable
                  style={styles.action}
                  onPress={() =>
                    navigation.navigate('AdminEditCourse', {
                      courseId: c.id,
                      courseName: c.name,
                    })
                  }
                >
                  <Text style={styles.actionDefaultText}>Modifier</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}

        <Text style={styles.sectionHeader}>Cette semaine</Text>
        <Pressable
          style={styles.kvRow}
          onPress={() => navigation.navigate('AdminPlanning')}
        >
          <Text style={styles.kvLabel}>Voir le planning complet</Text>
          <Text style={styles.kvArrow}>›</Text>
        </Pressable>

        {/* Réservé aux admins (le service vérifie le rôle au runtime). */}
        {user?.role === 'admin' ? (
          <>
            <Text style={styles.sectionHeader}>Membres</Text>
            <Pressable
              style={styles.kvRow}
              onPress={() => navigation.navigate('AdminUsers')}
            >
              <Text style={styles.kvLabel}>Gérer les comptes adhérents</Text>
              <Text style={styles.kvArrow}>›</Text>
            </Pressable>
          </>
        ) : null}

        <Text style={styles.note}>
          Connecté en tant que {user?.first_name} {user?.last_name_initial}{' '}
          ({user?.role})
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDayHeader(d: Date): string {
  const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const months = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
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
  scroll: { padding: 14 },

  modeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    backgroundColor: colors.black,
    borderRadius: 10,
    marginBottom: 12,
  },
  modeBannerIcon: { fontSize: 18 },
  modeBannerTitle: { color: colors.white, fontSize: 13, fontWeight: '700' },
  modeBannerText: { color: colors.gray300, fontSize: 12, lineHeight: 17, marginTop: 2 },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  ctaIcon: { fontSize: 18 },
  ctaText: { flex: 1, color: colors.white, fontWeight: '600', fontSize: 13 },
  ctaArrow: { color: colors.white, fontSize: 16 },

  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gray600,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 6,
    marginBottom: 8,
  },
  empty: { fontSize: 12, color: colors.gray500, textAlign: 'center', paddingVertical: 20 },

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
    alignItems: 'center',
  },
  actionWarn: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' },
  actionWarnText: { color: '#92400E', fontWeight: '600', fontSize: 11 },
  actionDanger: { backgroundColor: '#FEE2E2', borderColor: colors.primary },
  actionDangerText: { color: '#991B1B', fontWeight: '600', fontSize: 11 },
  actionDefaultText: { color: colors.black, fontWeight: '600', fontSize: 11 },

  kvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  kvLabel: { fontSize: 13, fontWeight: '500', color: colors.black },
  kvArrow: { fontSize: 14, color: colors.gray400 },

  note: {
    fontSize: 11,
    color: colors.gray400,
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
});
