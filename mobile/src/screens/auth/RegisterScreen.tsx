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

interface RegisterScreenProps {
  navigation: AuthStackNavigation<'Register'>;
}

export function RegisterScreen({ navigation }: RegisterScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastInitial, setLastInitial] = useState('');
  const setSession = useAuthStore((s) => s.setSession);
  const syncNotifs = useNotificationsStore((s) => s.syncFromServer);

  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: async (data) => {
      await setSession(data.user, data.tokens);
      // Initialise les notifs avec les valeurs par défaut côté serveur.
      syncNotifs().catch(() => {});
      // Enregistre le device pour les push (demande la permission OS).
      const { registerForPushAsync } = await import('../../push/register');
      registerForPushAsync().catch(() => {});
    },
  });

  const onSubmit = () => {
    if (!email.trim() || !password || !firstName.trim() || !lastInitial.trim()) return;
    registerMutation.mutate({
      email: email.trim(),
      password,
      first_name: firstName.trim(),
      last_name_initial: lastInitial.trim(),
    });
  };

  const errorMessage = registerMutation.error
    ? humanizeError(registerMutation.error)
    : null;

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
          <Text style={styles.title}>Créer un compte</Text>
          <Text style={styles.subtitle}>Rejoins le Boa Club</Text>

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
              placeholder="8 caractères minimum"
              secureTextEntry
              textContentType="newPassword"
            />
            <View style={styles.row}>
              <View style={styles.rowItem}>
                <Input
                  label="Prénom"
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="Jean"
                  autoCapitalize="words"
                />
              </View>
              <View style={styles.rowItem}>
                <Input
                  label="Initiale"
                  value={lastInitial}
                  onChangeText={setLastInitial}
                  placeholder="D."
                  autoCapitalize="characters"
                  maxLength={3}
                />
              </View>
            </View>

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            <Button
              label="Créer mon compte"
              onPress={onSubmit}
              loading={registerMutation.isPending}
              full
            />

            <View style={styles.secondaryWrap}>
              <Text style={styles.secondaryText}>Déjà inscrit ? </Text>
              <Pressable onPress={() => navigation.navigate('Login')}>
                <Text style={styles.link}>Se connecter</Text>
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
    if (err.code === 'email_already_taken') return 'Cet email est déjà utilisé.';
    if (err.code === 'validation_failed') return 'Données invalides — vérifie tes saisies.';
    if (err.code === 'too_many_requests')
      return 'Trop de tentatives, réessaie dans quelques minutes.';
  }
  return 'Inscription impossible. Vérifie que le serveur tourne.';
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
  row: { flexDirection: 'row', gap: 8 },
  rowItem: { flex: 1 },
  errorText: {
    color: colors.primary,
    fontSize: 12,
    marginBottom: 10,
    textAlign: 'center',
  },
  secondaryWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 18,
  },
  secondaryText: { fontSize: 13, color: colors.gray600 },
  link: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
});
