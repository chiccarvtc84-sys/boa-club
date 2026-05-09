import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../components/Button';
import { useNotificationsStore } from '../../store/notificationsStore';
import { colors } from '../../theme/colors';
import type { ProfileStackNavigation } from '../../navigation/ProfileStack';

interface NotificationsSettingsScreenProps {
  navigation: ProfileStackNavigation<'NotificationsSettings'>;
}

interface NotifRow {
  key: string;
  name: string;
  schedule: string;
}

const COURSE_NOTIFS: NotifRow[] = [
  { key: 'jjb-gi', name: 'JJB (Gi)', schedule: 'Mar & Jeu · 18:30 — 19:30 · Sorgues' },
  {
    key: 'grappling-debutant',
    name: 'Grappling No-Gi débutant',
    schedule: 'Lun, Mer, Ven · 18:30 — 19:30 · Sorgues',
  },
  {
    key: 'grappling-confirme',
    name: 'Grappling No-Gi Confirmé',
    schedule: 'Lun, Mer, Ven · 19:30 — 20:30 · Sorgues',
  },
  { key: 'mma', name: 'MMA cours à thèmes', schedule: 'Lun, Mar, Mer · 20:30 — 21:30 · Vedène' },
  { key: 'open-mat', name: 'Open Mat', schedule: 'Mar & Jeu · 19:30 — 20:30 · Sorgues' },
  {
    key: 'free-slot-joined',
    name: 'Créneau libre que je rejoins',
    schedule: 'Notifs message dans la discussion publique',
  },
];

export function NotificationsSettingsScreen({ navigation }: NotificationsSettingsScreenProps) {
  const followed = useNotificationsStore((s) => s.followed);
  const toggle = useNotificationsStore((s) => s.toggle);
  const save = useNotificationsStore((s) => s.save);

  const onSave = async () => {
    await save();
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>Cours suivis</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.help}>
          Active les cours pour lesquels tu veux recevoir un rappel 1h avant + une alerte si le coach
          est en retard ou absent. Les cours décochés n'apparaîtront plus avec une cloche rouge dans
          le planning.
        </Text>
        {COURSE_NOTIFS.map((row) => {
          const value = followed.has(row.key);
          return (
            <View key={row.key} style={styles.row}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name}>{row.name}</Text>
                <Text style={styles.time}>{row.schedule}</Text>
              </View>
              <Switch
                value={value}
                onValueChange={() => toggle(row.key)}
                trackColor={{ false: colors.gray200, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Enregistrer mes choix" onPress={onSave} full />
      </View>
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
  help: { fontSize: 12, color: colors.gray600, lineHeight: 18, marginBottom: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    gap: 12,
  },
  name: { fontSize: 13.5, fontWeight: '600', color: colors.black },
  time: { fontSize: 11.5, color: colors.gray500, marginTop: 2 },
  footer: { padding: 14, borderTopWidth: 0.5, borderTopColor: colors.border },
});
