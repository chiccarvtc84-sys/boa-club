import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';

import { meApi } from '../../api/me';
import { ApiError } from '../../api/client';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../theme/colors';
import type { ProfileStackNavigation } from '../../navigation/ProfileStack';

interface DeleteAccountScreenProps {
  navigation: ProfileStackNavigation<'DeleteAccount'>;
}

export function DeleteAccountScreen({ navigation }: DeleteAccountScreenProps) {
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const clearSession = useAuthStore((s) => s.clearSession);

  const deleteMutation = useMutation({
    mutationFn: (pwd: string) => meApi.deleteAccount(pwd),
    onSuccess: async () => {
      // Compte supprimé côté serveur → on vide la session locale.
      await clearSession();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'invalid_password') {
        setErrorMessage('Mot de passe incorrect.');
      } else {
        setErrorMessage('Suppression impossible. Réessaie plus tard.');
      }
    },
  });

  const canSubmit =
    password.length >= 1 && confirmText.trim().toUpperCase() === 'SUPPRIMER';

  const onSubmit = () => {
    setErrorMessage(null);
    if (!canSubmit) return;
    deleteMutation.mutate(password);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Supprimer mon compte</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>⚠ Cette action est définitive</Text>
            <Text style={styles.warningText}>
              En supprimant ton compte :
              {'\n'}• Ton profil et ton historique seront effacés
              {'\n'}• Tu seras désinscrit de tous les créneaux libres
              {'\n'}• Tes conversations privées resteront visibles pour les autres adhérents,
              mais ton nom y apparaîtra anonymisé
              {'\n'}• Tu pourras te réinscrire plus tard avec le même email, mais sans
              récupérer tes données
            </Text>
          </View>

          <Input
            label="Confirme avec ton mot de passe"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            textContentType="password"
          />
          <Input
            label="Tape SUPPRIMER en majuscules pour confirmer"
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder="SUPPRIMER"
            autoCapitalize="characters"
            autoCorrect={false}
            errorText={errorMessage ?? undefined}
          />

          <Button
            label="Supprimer définitivement mon compte"
            onPress={onSubmit}
            loading={deleteMutation.isPending}
            disabled={!canSubmit}
            full
            style={[styles.deleteBtn, !canSubmit && styles.deleteBtnDisabled]}
          />

          <Text style={styles.help}>
            Conformément au RGPD, la suppression est traitée dans les 24h. Pour toute
            question, contacte-nous à contact@clubedesportivoboa.fr.
          </Text>
        </ScrollView>
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

  scroll: { padding: 14 },
  warningBox: {
    backgroundColor: '#FEE2E2',
    padding: 14,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: '#DC2626',
    marginBottom: 18,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 6,
  },
  warningText: {
    fontSize: 12.5,
    color: '#991B1B',
    lineHeight: 19,
  },
  deleteBtn: { backgroundColor: colors.primary, marginTop: 8 },
  deleteBtnDisabled: { opacity: 0.5 },
  help: {
    fontSize: 11,
    color: colors.gray500,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 16,
  },
});
