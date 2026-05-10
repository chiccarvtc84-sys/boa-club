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
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../theme/colors';
import type { ProfileStackNavigation } from '../../navigation/ProfileStack';

interface AdminBroadcastScreenProps {
  navigation: ProfileStackNavigation<'AdminBroadcast'>;
}

const DURATIONS = [
  { hours: 1, label: '1 h' },
  { hours: 6, label: '6 h' },
  { hours: 24, label: '24 h' },
  { hours: 72, label: '3 jours' },
  { hours: 168, label: '1 semaine' },
];

export function AdminBroadcastScreen({ navigation }: AdminBroadcastScreenProps) {
  const user = useAuthStore((s) => s.user);

  // Le nom de l'expéditeur est figé sur le compte connecté : pas de choix
  // possible, pour assurer la traçabilité (cf. cahier des charges).
  const senderName = user
    ? `${user.first_name} ${user.last_name_initial}`.trim()
    : '';

  const [message, setMessage] = useState('');
  const [durationHours, setDurationHours] = useState(24);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const sendMutation = useMutation({
    mutationFn: adminApi.createBroadcast,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      navigation.goBack();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'not_admin_or_coach') {
        setErrorMessage("Tu n'as pas les droits pour envoyer une alerte.");
      } else {
        setErrorMessage("Impossible d'envoyer l'alerte.");
      }
    },
  });

  const onSubmit = () => {
    setErrorMessage(null);
    if (!message.trim()) {
      setErrorMessage('Le message est requis.');
      return;
    }
    sendMutation.mutate({
      display_name: senderName,
      message: message.trim(),
      duration_hours: durationHours,
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Envoyer une alerte</Text>
          <Text style={styles.subtitle}>À tous les adhérents</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              L'alerte apparaîtra en haut du planning de tous les adhérents et leur enverra
              une notification push.
            </Text>
          </View>

          <Text style={styles.label}>De la part de</Text>
          <View style={styles.senderBox}>
            <Text style={styles.senderName}>{senderName || '—'}</Text>
            <Text style={styles.senderHint}>
              Ton compte connecté · non modifiable
            </Text>
          </View>

          <Text style={styles.label}>Message</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={message}
            onChangeText={setMessage}
            placeholder="Ex : Le tatami sera nettoyé exceptionnellement à 19h ce soir, retardez votre arrivée si possible."
            placeholderTextColor={colors.gray400}
            multiline
          />
          <Text style={styles.helper}>
            Sois concis et clair — les adhérents le voient en priorité dans l'app.
          </Text>

          <Text style={styles.label}>Durée d'affichage</Text>
          <View style={styles.pillsRow}>
            {DURATIONS.map((d) => (
              <Pressable
                key={d.hours}
                style={[styles.pill, durationHours === d.hours && styles.pillSelected]}
                onPress={() => setDurationHours(d.hours)}
              >
                <Text
                  style={[
                    styles.pillText,
                    durationHours === d.hours && styles.pillTextSelected,
                  ]}
                >
                  {d.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.helper}>
            L'alerte disparaît automatiquement après cette durée. Les adhérents peuvent aussi
            la fermer manuellement avant.
          </Text>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label="Envoyer à tous les adhérents"
            onPress={onSubmit}
            loading={sendMutation.isPending}
            full
          />
        </View>
      </KeyboardAvoidingView>
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

  scroll: { padding: 14 },
  infoBox: {
    backgroundColor: colors.gray50,
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  infoText: { fontSize: 12, color: colors.gray600, lineHeight: 18 },

  label: {
    fontSize: 12,
    color: colors.gray600,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 5,
    marginTop: 14,
  },
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
  textarea: { minHeight: 100, textAlignVertical: 'top' },
  helper: { fontSize: 11, color: colors.gray500, marginTop: 4, lineHeight: 16 },

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

  // Bloc lecture seule pour l'expéditeur (lié au compte connecté).
  senderBox: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: colors.border,
    backgroundColor: colors.gray50,
  },
  senderName: { fontSize: 14, fontWeight: '700', color: colors.black },
  senderHint: { fontSize: 11, color: colors.gray500, marginTop: 2 },

  errorText: {
    fontSize: 12,
    color: colors.primary,
    textAlign: 'center',
    marginTop: 12,
  },

  footer: {
    padding: 14,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
  },
});
