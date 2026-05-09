import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminApi, type UpdateCoursePayload } from '../../api/admin';
import { coursesApi, type CourseDiscipline } from '../../api/courses';
import { ApiError } from '../../api/client';
import { Button } from '../../components/Button';
import { colors } from '../../theme/colors';
import type {
  ProfileStackNavigation,
  ProfileStackRoute,
} from '../../navigation/ProfileStack';

interface AdminEditCourseScreenProps {
  navigation: ProfileStackNavigation<'AdminEditCourse'>;
  route: ProfileStackRoute<'AdminEditCourse'>;
}

const DISCIPLINES: { value: CourseDiscipline; label: string }[] = [
  { value: 'jjb_gi', label: 'Gi' },
  { value: 'jjb_nogi', label: 'No-Gi' },
  { value: 'mma', label: 'MMA' },
  { value: 'mixed', label: 'Mixte' },
];
const INTENSITIES = [
  { value: 'technique', label: 'Technique' },
  { value: 'drilling', label: 'Drilling' },
  { value: 'all_levels', label: 'Tous niveaux' },
  { value: 'sparring_light', label: 'Sparring léger' },
  { value: 'sparring_hard', label: 'Sparring fort' },
];
const LOCATIONS = ['Dojo de Sorgues', 'Dojo de Vedène'];

export function AdminEditCourseScreen({ navigation, route }: AdminEditCourseScreenProps) {
  const { courseId, courseName } = route.params;

  // Charge le planning hebdo pour retrouver le cours et ses valeurs courantes.
  const { data: weekData, isLoading } = useQuery({
    queryKey: ['courses', 'week'],
    queryFn: () => coursesApi.week(),
  });
  const { data: coachesData } = useQuery({
    queryKey: ['admin', 'coaches'],
    queryFn: () => adminApi.listCoaches(),
  });

  const course = weekData?.courses.find((c) => c.id === courseId);

  const [coachId, setCoachId] = useState<string | undefined>();
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [discipline, setDiscipline] = useState<CourseDiscipline>('jjb_nogi');
  const [intensity, setIntensity] = useState<string>('all_levels');
  const [location, setLocation] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialise depuis la donnée chargée.
  useEffect(() => {
    if (!course) return;
    setCoachId(course.coach_id);
    setStartTime(course.start_time);
    setEndTime(course.end_time);
    setDiscipline(course.discipline);
    if (course.intensity) setIntensity(course.intensity);
    if (course.location) setLocation(course.location);
  }, [course]);

  const queryClient = useQueryClient();
  const updateMutation = useMutation({
    mutationFn: (payload: UpdateCoursePayload) => adminApi.updateCourse(courseId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      navigation.goBack();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'not_admin_or_coach') {
        setErrorMessage("Tu n'as pas les droits pour modifier ce cours.");
      } else {
        setErrorMessage('Impossible de sauvegarder.');
      }
    },
  });

  const onSave = () => {
    setErrorMessage(null);
    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      setErrorMessage('Format horaire invalide (HH:MM).');
      return;
    }
    updateMutation.mutate({
      default_coach_id: coachId,
      start_time: startTime,
      end_time: endTime,
      discipline,
      intensity: intensity as UpdateCoursePayload['intensity'],
      location,
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Modifier le cours</Text>
        </View>
        <Pressable onPress={onSave} style={styles.headerOK}>
          <Text style={styles.headerOKText}>OK</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          {isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
          ) : (
            <>
              <Text style={styles.label}>Nom du cours</Text>
              <View style={styles.readonlyBox}>
                <Text style={styles.readonlyValue}>{courseName}</Text>
              </View>
              <Text style={styles.helper}>Le nom du cours n'est pas modifiable.</Text>

              <Text style={styles.label}>Coach</Text>
              <View style={styles.pillsRow}>
                {(coachesData?.coaches ?? []).map((c) => (
                  <Pressable
                    key={c.id}
                    style={[styles.pill, coachId === c.id && styles.pillSelected]}
                    onPress={() => setCoachId(c.id)}
                  >
                    <Text
                      style={[styles.pillText, coachId === c.id && styles.pillTextSelected]}
                    >
                      {c.first_name}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.helper}>
                Choisis le coach qui assurera ce cours.
              </Text>

              <Text style={styles.label}>Horaire</Text>
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.rowItem]}
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="18:30"
                  placeholderTextColor={colors.gray400}
                />
                <TextInput
                  style={[styles.input, styles.rowItem]}
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="19:30"
                  placeholderTextColor={colors.gray400}
                />
              </View>

              <Text style={styles.label}>Type</Text>
              <View style={styles.pillsRow}>
                {DISCIPLINES.map((d) => (
                  <Pressable
                    key={d.value}
                    style={[styles.pill, discipline === d.value && styles.pillSelected]}
                    onPress={() => setDiscipline(d.value)}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        discipline === d.value && styles.pillTextSelected,
                      ]}
                    >
                      {d.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>Intensité</Text>
              <View style={styles.pillsRow}>
                {INTENSITIES.map((i) => (
                  <Pressable
                    key={i.value}
                    style={[styles.pill, intensity === i.value && styles.pillSelected]}
                    onPress={() => setIntensity(i.value)}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        intensity === i.value && styles.pillTextSelected,
                      ]}
                    >
                      {i.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>Lieu</Text>
              <View style={styles.pillsRow}>
                {LOCATIONS.map((l) => (
                  <Pressable
                    key={l}
                    style={[styles.pill, location === l && styles.pillSelected]}
                    onPress={() => setLocation(l)}
                  >
                    <Text
                      style={[styles.pillText, location === l && styles.pillTextSelected]}
                    >
                      {l}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

              <Button
                label="Enregistrer"
                onPress={onSave}
                loading={updateMutation.isPending}
                full
                style={{ marginTop: 14 }}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function isValidTime(s: string): boolean {
  return /^\d{1,2}:\d{2}$/.test(s);
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
  headerOK: {
    backgroundColor: colors.primary,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
  },
  headerOKText: { color: colors.white, fontWeight: '700', fontSize: 12 },

  scroll: { padding: 14 },
  label: {
    fontSize: 12,
    color: colors.gray600,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 5,
    marginTop: 14,
  },
  helper: { fontSize: 11, color: colors.gray500, marginTop: 4, lineHeight: 16 },
  readonlyBox: {
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: colors.border,
    backgroundColor: colors.gray50,
  },
  readonlyValue: { fontSize: 14, fontWeight: '600', color: colors.black },

  input: {
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    fontSize: 13,
    color: colors.black,
  },
  row: { flexDirection: 'row', gap: 8 },
  rowItem: { flex: 1 },

  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  pill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  pillSelected: { backgroundColor: colors.black, borderColor: colors.black },
  pillText: { fontSize: 11.5, color: colors.black, fontWeight: '500' },
  pillTextSelected: { color: colors.white, fontWeight: '600' },

  errorText: { fontSize: 12, color: colors.primary, textAlign: 'center', marginTop: 12 },
});
