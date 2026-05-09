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

import { authApi } from '../../api/auth';
import { ApiError } from '../../api/client';
import { BoaLogo } from '../../components/BoaLogo';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { colors } from '../../theme/colors';
import type {
  AuthStackNavigation,
  AuthStackRoute,
} from '../../navigation/AuthStack';

interface ResetPasswordScreenProps {
  navigation: AuthStackNavigation<'ResetPassword'>;
  route: AuthStackRoute<'ResetPassword'>;
}

export function ResetPasswordScreen({ navigation, route }: ResetPasswordScreenProps) {
  const initialEmail = route.params?.email ?? '';
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [success, setSuccess] = useState(false);

  const resetMutation = useMutation({
    mutationFn: ({ code, password }: { code: string; password: string }) =>
      authApi.resetPassword(code, password),
    onSuccess: () => setSuccess(true),
  });

  const onSubmit = () => {
    if (!code.trim() || !password) return;
    if (password !== confirm) return;
    resetMutation.mutate({ code: code.trim().toUpperCase(), password });
  };

  const errorText = resetMutation.error
    ? humanizeError(resetMutation.error)
    : password && confirm && password !== confirm
      ? 'Les mots de passe ne correspondent pas.'
      : null;

  if (success) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successWrap}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.successTitle}>Mot de passe réinitialisé</Text>
          <Text style={styles.successDesc}>
            Tu peux maintenant te connecter avec ton nouveau mot de passe.
          </Text>
          <Button
            label="Se connecter"
            onPress={() => navigation.navigate('Login')}
            full
            style={{ marginTop: 24 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable style={styles.back} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View style={styles.logoWrap}>
            <BoaLogo size={64} />
          </View>
          <Text style={styles.title}>Nouveau mot de passe</Text>
          {initialEmail ? (
            <Text style={styles.subtitle}>pour {initialEmail}</Text>
          ) : null}

          <View style={styles.form}>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Saisis le code reçu par email puis choisis un nouveau mot de passe.
              </Text>
            </View>
            <Input
              label="Code de réinitialisation"
              value={code}
              onChangeText={setCode}
              placeholder="EX : ABC123XYZ"
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <Input
              label="Nouveau mot de passe"
              value={password}
              onChangeText={setPassword}
              placeholder="8 caractères minimum"
              secureTextEntry
              textContentType="newPassword"
            />
            <Input
              label="Confirmer le mot de passe"
              value={confirm}
              onChangeText={setConfirm}
              placeholder="••••••••"
              secureTextEntry
              errorText={errorText ?? undefined}
            />
            <Button
              label="Réinitialiser"
              onPress={onSubmit}
              loading={resetMutation.isPending}
              full
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function humanizeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'invalid_reset_token')
      return 'Code invalide ou expiré. Demande un nouveau code.';
    if (err.code === 'validation_failed')
      return 'Le mot de passe doit faire au moins 8 caractères.';
  }
  return 'Réinitialisation impossible.';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  scroll: { padding: 22, paddingTop: 16 },
  back: { paddingVertical: 4, alignSelf: 'flex-start' },
  backText: { fontSize: 28, color: colors.black, lineHeight: 28 },
  logoWrap: { alignItems: 'center', marginTop: 4, marginBottom: 12 },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.black,
  },
  subtitle: {
    fontSize: 12,
    color: colors.gray500,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 28,
  },
  form: {},
  infoBox: {
    backgroundColor: colors.gray50,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  infoText: { fontSize: 12, color: colors.gray600, lineHeight: 18 },

  successWrap: {
    flex: 1,
    padding: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successIcon: {
    fontSize: 48,
    color: colors.primary,
    fontWeight: '700',
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.black,
    textAlign: 'center',
  },
  successDesc: {
    fontSize: 13,
    color: colors.gray600,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
    lineHeight: 19,
  },
});
