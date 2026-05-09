import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';

import { meApi } from '../../api/me';
import { Button } from '../../components/Button';
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../theme/colors';
import type { WeightVisibility } from '../../types/models';
import type { ProfileStackNavigation } from '../../navigation/ProfileStack';

interface WeightVisibilityScreenProps {
  navigation: ProfileStackNavigation<'WeightVisibility'>;
}

const OPTIONS: { value: WeightVisibility; label: string; desc: string }[] = [
  {
    value: 'public',
    label: 'Public',
    desc: 'Tout le monde peut voir ton poids, y compris les visiteurs non inscrits.',
  },
  {
    value: 'members',
    label: 'Adhérents seulement',
    desc: 'Seuls les autres adhérents du Boa Club voient ton poids.',
  },
  {
    value: 'private',
    label: 'Privé',
    desc: 'Personne ne voit ton poids, même les autres adhérents.',
  },
];

export function WeightVisibilityScreen({ navigation }: WeightVisibilityScreenProps) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [selected, setSelected] = useState<WeightVisibility>(
    user?.weight_visibility ?? 'members',
  );

  const updateMutation = useMutation({
    mutationFn: (visibility: WeightVisibility) =>
      meApi.update({ weight_visibility: visibility }),
    onSuccess: async (updatedUser) => {
      await setUser(updatedUser);
      navigation.goBack();
    },
  });

  const onSave = () => {
    updateMutation.mutate(selected);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Visibilité du poids</Text>
          <Text style={styles.subtitle}>Qui peut voir ton poids ?</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.help}>
          Choisis qui peut voir ton poids dans ton profil. Tu peux changer à tout moment.
        </Text>
        {OPTIONS.map((opt) => {
          const isSelected = selected === opt.value;
          return (
            <Pressable
              key={opt.value}
              style={styles.row}
              onPress={() => setSelected(opt.value)}
            >
              <View
                style={[styles.radio, isSelected && styles.radioSelected]}
              >
                {isSelected ? <View style={styles.radioInner} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optName}>{opt.label}</Text>
                <Text style={styles.optDesc}>{opt.desc}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Enregistrer"
          onPress={onSave}
          loading={updateMutation.isPending}
          full
        />
        {updateMutation.error ? (
          <Text style={styles.errorText}>
            Échec de la sauvegarde — vérifie ta connexion.
          </Text>
        ) : null}
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
  help: { fontSize: 12, color: colors.gray600, lineHeight: 18, marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    gap: 12,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.gray300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.primary },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  optName: { fontSize: 14, fontWeight: '600', color: colors.black },
  optDesc: { fontSize: 12, color: colors.gray500, marginTop: 2, lineHeight: 17 },
  footer: {
    padding: 14,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
  },
  errorText: {
    fontSize: 12,
    color: colors.primary,
    textAlign: 'center',
    marginTop: 8,
  },
});
