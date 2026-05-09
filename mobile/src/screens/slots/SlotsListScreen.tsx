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

import { freeSlotsApi, type FreeSlotSummaryDTO } from '../../api/freeSlots';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { colors } from '../../theme/colors';
import type { Discipline } from '../../data/mockCourses';
import type { CourseDiscipline } from '../../api/courses';
import type { SlotsStackNavigation } from '../../navigation/SlotsStack';

const DISCIPLINE_MAP: Record<CourseDiscipline, Discipline> = {
  jjb_gi: 'gi',
  jjb_nogi: 'nogi',
  mma: 'mma',
  open_mat: 'openmat',
  wrestling: 'mixed',
  mixed: 'mixed',
};

const INTENSITY_LABEL: Record<string, string> = {
  technique: 'Technique',
  drilling: 'Drilling',
  sparring_light: 'Sparring léger',
  sparring_hard: 'Sparring fort',
  all_levels: 'Tous niveaux',
};

interface SlotsListScreenProps {
  navigation: SlotsStackNavigation<'SlotsList'>;
}

export function SlotsListScreen({ navigation }: SlotsListScreenProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['freeSlots', 'list'],
    queryFn: () => freeSlotsApi.list(),
  });

  // Groupe les créneaux par date (YYYY-MM-DD).
  const grouped = useMemo(() => {
    const slots = data?.slots ?? [];
    const map = new Map<string, FreeSlotSummaryDTO[]>();
    for (const s of slots) {
      const key = s.scheduled_start.slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Créneaux libres</Text>
          <Text style={styles.subtitle}>Demande des adhérents</Text>
        </View>
        <Pressable style={styles.cta} onPress={() => navigation.navigate('CreateSlot')}>
          <Text style={styles.ctaText}>+ Créneau</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>
            Impossible de charger les créneaux. Vérifie ta connexion.
          </Text>
        ) : grouped.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>○</Text>
            <Text style={styles.emptyText}>
              Aucun créneau à venir.{'\n'}Sois le premier à en publier un !
            </Text>
          </View>
        ) : (
          grouped.map(([dateKey, slots]) => (
            <View key={dateKey}>
              <Text style={styles.dayHeader}>{formatDayHeader(dateKey)}</Text>
              {slots.map((slot) => (
                <Pressable
                  key={slot.id}
                  style={styles.card}
                  onPress={() => navigation.navigate('SlotDetail', { slotId: slot.id })}
                >
                  <Text style={styles.time}>
                    {formatTime(slot.scheduled_start)} — {formatTime(slot.scheduled_end)}
                  </Text>
                  <Text style={styles.name}>{slot.title}</Text>
                  <View style={styles.metaRow}>
                    <Badge discipline={DISCIPLINE_MAP[slot.discipline]} />
                    {slot.intensity ? (
                      <View style={styles.intensityPill}>
                        <Text style={styles.intensityText}>
                          {INTENSITY_LABEL[slot.intensity] ?? slot.intensity}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.footer}>
                    <Text style={styles.creator}>par {slot.creator.first_name}</Text>
                    <View style={styles.avatars}>
                      <Avatar
                        initials={creatorInitials(slot)}
                        color={1}
                        size={24}
                      />
                      <Text style={styles.count}>
                        {slot.participant_count} pers
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function creatorInitials(slot: FreeSlotSummaryDTO): string {
  return slot.creator.first_name[0] + (slot.creator.last_name_initial[0] ?? '');
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDayHeader(dateKey: string): string {
  const d = new Date(dateKey + 'T00:00:00');
  const days = ['DIMANCHE', 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI'];
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
  title: { fontSize: 16, fontWeight: '600', color: colors.black },
  subtitle: { fontSize: 11, color: colors.gray500, marginTop: 1 },
  cta: {
    backgroundColor: colors.primary,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  ctaText: { color: colors.white, fontWeight: '600', fontSize: 12 },
  scroll: { padding: 14, paddingTop: 12 },
  loading: { paddingVertical: 50, alignItems: 'center' },
  errorText: {
    fontSize: 13,
    color: colors.primary,
    textAlign: 'center',
    paddingVertical: 30,
  },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 28, color: colors.gray400, opacity: 0.3, marginBottom: 8 },
  emptyText: { fontSize: 13, color: colors.gray600, lineHeight: 19, textAlign: 'center' },
  dayHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gray600,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 6,
    marginBottom: 6,
  },
  card: {
    backgroundColor: colors.white,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  time: { fontSize: 11, color: colors.gray600, fontWeight: '600', letterSpacing: 0.3 },
  name: { fontSize: 14, fontWeight: '600', color: colors.black, marginTop: 2 },
  metaRow: { flexDirection: 'row', gap: 4, marginTop: 6, flexWrap: 'wrap' },
  intensityPill: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  intensityText: { fontSize: 10, fontWeight: '600', color: '#3730A3', textTransform: 'uppercase' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
  },
  creator: { fontSize: 11, color: colors.gray600 },
  avatars: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  count: { fontSize: 11, color: colors.gray600, fontWeight: '600' },
});
