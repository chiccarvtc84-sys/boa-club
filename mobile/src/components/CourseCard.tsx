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
        <View style={styles.bell}>
          <Text style={[styles.bellIcon, notificationOn && styles.bellIconOn]}>
            🔔
          </Text>
        </View>
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  body: { flex: 1, minWidth: 0 },
  time: {
    fontSize: 11,
    color: colors.gray600,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.black,
    marginTop: 2,
  },
  coach: {
    fontSize: 12,
    color: colors.gray600,
    marginTop: 3,
  },
  location: {
    fontSize: 11,
    color: colors.gray500,
    marginTop: 2,
    fontStyle: 'italic',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  bell: { paddingTop: 2 },
  bellIcon: {
    fontSize: 16,
    color: colors.gray400,
    opacity: 0.5,
  },
  bellIconOn: {
    color: colors.primary,
    opacity: 1,
  },
  alertBox: {
    marginTop: 8,
    padding: 8,
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
    fontSize: 11.5,
    fontWeight: '500',
    lineHeight: 16,
  },
});
