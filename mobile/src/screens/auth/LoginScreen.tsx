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
import { useAuthStore } from '../../store/authStore';
import { useNotificationsStore } from '../../store/notificationsStore';
import { colors } from '../../theme/colors';
import type { AuthStackNavigation } from '../../navigation/AuthStack';

interface LoginScreenProps {
  navigation: AuthStackNavigation<'Login'>;
}

export function LoginScreen({ navigation }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const setSession = useAuthStore((s) => s.setSession);
  const syncNotifs = useNotificationsStore((s) => s.syncFromServer);

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: async (data) => {
      await setSession(data.user, data.tokens);
      // Pull les préférences notifs côté serveur, source de vérité.
      syncNotifs().catch(() => {});
      // Enregistre le device pour les push (silencieux si refus / Expo Web).
      const { registerForPushAsync } = await import('../../push/register');
      registerForPushAsync().catch(() => {});
    },
  });

  const onSubmit = () => {
    if (!email.trim() || !password) return;
    loginMutation.mutate({ email: email.trim(), password });
  };

  const errorMessage = loginMutation.error
    ? humanizeError(loginMutation.error)
    : null;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.logoWrap}>
            <BoaLogo size={64} />
          </View>
          <Text style={styles.title}>Boa Club</Text>
          <Text style={styles.subtitle}>Sorgues · Vedène</Text>

          <View style={styles.form}>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="ton@email.fr"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
            />
            <Input
              label="Mot de passe"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              textContentType="password"
              errorText={errorMessage ?? undefined}
            />
            <Button
              label="Se connecter"
              onPress={onSubmit}
              loading={loginMutation.isPending}
              full
            />

            <Pressable
              style={styles.linkWrap}
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              <Text style={styles.link}>Mot de passe oublié ?</Text>
            </Pressable>

            <View style={styles.secondaryWrap}>
              <Text style={styles.secondaryText}>Pas encore inscrit ? </Text>
              <Pressable onPress={() => navigation.navigate('Register')}>
                <Text style={styles.link}>Créer un compte</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function humanizeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'invalid_credentials') return 'Email ou mot de passe incorrect.';
    if (err.code === 'account_not_active') return 'Ton compte est suspendu.';
    if (err.code === 'too_many_requests')
      return 'Trop de tentatives, réessaie dans quelques minutes.';
  }
  return 'Connexion impossible. Vérifie que le serveur tourne.';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  scroll: { padding: 22, paddingTop: 30 },
  logoWrap: { alignItems: 'center', marginBottom: 12 },
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
  linkWrap: { alignItems: 'center', marginTop: 14 },
  link: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  secondaryWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 18,
  },
  secondaryText: { fontSize: 13, color: colors.gray600 },
});
