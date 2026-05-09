import { useState } from 'react';
import {
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
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '../../api/admin';
import { ApiError } from '../../api/client';
import { Button } from '../../components/Button';
import { colors } from '../../theme/colors';
import type {
  ProfileStackNavigation,
  ProfileStackRoute,
} from '../../navigation/ProfileStack';

interface AdminNotifyScreenProps {
  navigation: ProfileStackNavigation<'AdminNotify'>;
  route: ProfileStackRoute<'AdminNotify'>;
}

const LATE_MINUTES = [5, 10, 15, 30];

export function AdminNotifyScreen({ navigation, route }: AdminNotifyScreenProps) {
  const { courseId, courseName, defaultType, date } = route.params;

  const [type, setType] = useState<'late' | 'absent'>(defaultType ?? 'late');
  const [minutesLate, setMinutesLate] = useState<number>(10);
  const [cancelled, setCancelled] = useState(false); // false = cours libre maintenu
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const notifyMutation = useMutation({
    mutationFn: () =>
      adminApi.notifyCourse(courseId, {
        date,
        type,
        minutes_late: type === 'late' ? minutesLate : undefined,
        cancelled: type === 'absent' ? cancelled : undefined,
        message: message.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      navigation.goBack();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'not_admin_or_coach') {
        setErrorMessage("Tu n'as pas les droits pour faire cette action.");
      } else {
        setErrorMessage("Impossible d'envoyer la notification.");
      }
    },
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Notifier les adhérents</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {courseName} · {formatDate(date)}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.label}>Type de notification</Text>
          <View style={styles.pillsRow}>
            <Pressable
              style={[styles.pill, type === 'late' && styles.pillSelected]}
              onPress={() => setType('late')}
            >
              <Text style={[styles.pillText, type === 'late' && styles.pillTextSelected]}>
                Retard
              </Text>
            </Pressable>
            <Pressable
              style={[styles.pill, type === 'absent' && styles.pillSelected]}
              onPress={() => setType('absent')}
            >
              <Text
                style={[styles.pillText, type === 'absent' && styles.pillTextSelected]}
              >
                Absence
              </Text>
            </Pressable>
          </View>

          {type === 'late' ? (
            <>
              <Text style={styles.label}>Combien de minutes de retard ?</Text>
              <View style={styles.pillsRow}>
                {LATE_MINUTES.map((m) => (
                  <Pressable
                    key={m}
                    style={[styles.pill, minutesLate === m && styles.pillSelected]}
                    onPress={() => setMinutesLate(m)}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        minutesLate === m && styles.pillTextSelected,
                      ]}
                    >
                      {m} min
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.label}>Que se passe-t-il pour le cours ?</Text>
              <View style={styles.pillsRow}>
                <Pressable
                  style={[styles.pill, !cancelled && styles.pillSelected]}
                  onPress={() => setCancelled(false)}
                >
                  <Text style={[styles.pillText, !cancelled && styles.pillTextSelected]}>
                    Cours libre maintenu
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.pill, cancelled && styles.pillSelected]}
                  onPress={() => setCancelled(true)}
                >
                  <Text style={[styles.pillText, cancelled && styles.pillTextSelected]}>
                    Cours annulé
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.helper}>
                « Cours libre maintenu » ⇒ un créneau libre est généré automatiquement à
                la même heure (à venir).
              </Text>
            </>
          )}

          <Text style={styles.label}>Message aux adhérents (optionnel)</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={message}
            onChangeText={setMessage}
            placeholder="Ex : Démarrez l'échauffement entre vous, je suis sur la route."
            placeholderTextColor={colors.gray400}
            multiline
          />

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label="Envoyer la notification"
            onPress={() => notifyMutation.mutate()}
            loading={notifyMutation.isPending}
            full
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const days = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
  const months = [
    'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
    'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
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
  label: {
    fontSize: 12,
    color: colors.gray600,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 5,
    marginTop: 14,
  },
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
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  helper: { fontSize: 11, color: colors.gray500, marginTop: 4, lineHeight: 16 },

  errorText: {
    fontSize: 12,
    color: colors.primary,
    textAlign: 'center',
    marginTop: 12,
  },

  footer: { padding: 14, borderTopWidth: 0.5, borderTopColor: colors.border },
});
