import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import type { Course } from '../data/mockCourses';
import { Badge } from './Badge';

interface CourseCardProps {
  course: Course;
  notificationOn: boolean;
}

export function CourseCard({ course, notificationOn }: CourseCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.body}>
          <Text style={styles.time}>
            {course.startTime} — {course.endTime}
          </Text>
          <Text style={styles.name}>{course.name}</Text>
          {course.coachName ? (
            <Text style={styles.coach}>avec {course.coachName} ›</Text>
          ) : null}
          <Text style={styles.location}>{course.location}</Text>
          <View style={styles.metaRow}>
            <Badge discipline={course.discipline} />
          </View>
        </View>
        {/*
          Tâche 3 : la cloche n'est rendue que si l'utilisateur a activé les
          notifications pour ce cours. Quand `notificationOn` est false, on ne
          rend RIEN — pas de cloche grisée, pas d'espace réservé.
        */}
        {notificationOn ? (
          <View style={styles.bell}>
            <Text style={styles.bellIconOn}>🔔</Text>
          </View>
        ) : null}
      </View>
      {course.alert ? (
        <View
          style={[
            styles.alertBox,
            course.alert.type === 'late' ? styles.alertLate : styles.alertAbsent,
          ]}
        >
          <Text
            style={[
              styles.alertText,
              course.alert.type === 'late'
                ? { color: colors.alert.late.text }
                : { color: colors.alert.absent.text },
            ]}
          >
            {course.alert.message}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// Tâche 5 : tailles augmentées légèrement pour améliorer la lisibilité,
// sans casser l'allure compacte des cartes (cf. cahier des charges).
const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  body: { flex: 1, minWidth: 0 },
  time: {
    fontSize: 13,
    color: colors.gray700,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.black,
    marginTop: 4,
  },
  coach: {
    fontSize: 13,
    color: colors.gray600,
    marginTop: 4,
  },
  location: {
    fontSize: 12.5,
    color: colors.gray500,
    marginTop: 3,
    fontStyle: 'italic',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 9,
    flexWrap: 'wrap',
  },
  bell: { paddingTop: 2 },
  bellIconOn: {
    fontSize: 20,
    color: colors.primary,
    opacity: 1,
  },
  alertBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
  },
  alertLate: {
    backgroundColor: colors.alert.late.bg,
    borderLeftColor: colors.alert.late.border,
  },
  alertAbsent: {
    backgroundColor: colors.alert.absent.bg,
    borderLeftColor: colors.alert.absent.border,
  },
  alertText: {
    fontSize: 12.5,
    fontWeight: '500',
    lineHeight: 17,
  },
});
