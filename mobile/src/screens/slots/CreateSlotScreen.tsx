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

import { freeSlotsApi, type SlotIntensity } from '../../api/freeSlots';
import { Button } from '../../components/Button';
import { ApiError } from '../../api/client';
import { colors } from '../../theme/colors';
import type { CourseDiscipline } from '../../api/courses';
import type { SlotsStackNavigation } from '../../navigation/SlotsStack';

interface CreateSlotScreenProps {
  navigation: SlotsStackNavigation<'CreateSlot'>;
}

const DISCIPLINES: { value: CourseDiscipline; label: string }[] = [
  { value: 'jjb_gi', label: 'Gi' },
  { value: 'jjb_nogi', label: 'No-Gi' },
  { value: 'mma', label: 'MMA' },
  { value: 'mixed', label: 'Mixte' },
];

const INTENSITIES: { value: SlotIntensity; label: string }[] = [
  { value: 'drilling', label: 'Drilling' },
  { value: 'sparring_light', label: 'Sparring léger' },
  { value: 'sparring_hard', label: 'Sparring fort' },
];

const LOCATIONS: string[] = ['Dojo de Sorgues', 'Dojo de Vedène'];

/** Renvoie aujourd'hui +1 jour au format YYYY-MM-DD (par défaut : créneau pour demain). */
function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function CreateSlotScreen({ navigation }: CreateSlotScreenProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(tomorrowISO()); // YYYY-MM-DD
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('19:30');
  const [discipline, setDiscipline] = useState<CourseDiscipline>('jjb_nogi');
  const [intensity, setIntensity] = useState<SlotIntensity | undefined>('sparring_light');
  const [location, setLocation] = useState<string | undefined>('Dojo de Sorgues');
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const createMutation = useMutation({
    mutationFn: freeSlotsApi.create,
    onSuccess: (slot) => {
      queryClient.invalidateQueries({ queryKey: ['freeSlots'] });
      navigation.replace('SlotDetail', { slotId: slot.id });
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setErrorMessage(err.detail ?? err.code);
      } else {
        setErrorMessage('Impossible de créer le créneau.');
      }
    },
  });

  const onSubmit = () => {
    setErrorMessage(null);
    if (!title.trim()) {
      setErrorMessage('Le titre est requis.');
      return;
    }
    if (!isValidDate(date) || !isValidTime(startTime) || !isValidTime(endTime)) {
      setErrorMessage('Format de date ou heure invalide.');
      return;
    }
    const startISO = `${date}T${startTime}:00`;
    const endISO = `${date}T${endTime}:00`;
    if (new Date(endISO) <= new Date(startISO)) {
      setErrorMessage("L'heure de fin doit être après l'heure de début.");
      return;
    }

    createMutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      scheduled_start: new Date(startISO).toISOString(),
      scheduled_end: new Date(endISO).toISOString(),
      discipline,
      intensity,
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
          <Text style={styles.title}>Nouveau créneau</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Titre</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Ex : Sparring No-Gi"
            placeholderTextColor={colors.gray400}
          />

          <Text style={styles.label}>Date</Text>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.gray400}
          />

          <Text style={styles.label}>Horaire</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.rowItem]}
              value={startTime}
              onChangeText={setStartTime}
              placeholder="18:00"
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
                  style={[styles.pillText, discipline === d.value && styles.pillTextSelected]}
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
                  style={[styles.pillText, intensity === i.value && styles.pillTextSelected]}
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
                <Text style={[styles.pillText, location === l && styles.pillTextSelected]}>
                  {l}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Description (optionnel)</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Ajoute des précisions : ce qu'on travaille, niveau attendu, équipement…"
            placeholderTextColor={colors.gray400}
            multiline
          />

          {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : null}

          <Button
            label="Publier"
            onPress={onSubmit}
            loading={createMutation.isPending}
            full
            style={{ marginTop: 12 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + 'T00:00:00').getTime());
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
  textarea: { minHeight: 70, textAlignVertical: 'top' },
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
  errorText: {
    fontSize: 12,
    color: colors.primary,
    textAlign: 'center',
    marginTop: 12,
  },
});
