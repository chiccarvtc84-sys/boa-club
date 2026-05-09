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
import { BoaLogo } from '../../components/BoaLogo';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { colors } from '../../theme/colors';
import type { AuthStackNavigation } from '../../navigation/AuthStack';

interface ForgotPasswordScreenProps {
  navigation: AuthStackNavigation<'ForgotPassword'>;
}

export function ForgotPasswordScreen({ navigation }: ForgotPasswordScreenProps) {
  const [email, setEmail] = useState('');

  const sendMutation = useMutation({
    mutationFn: (e: string) => authApi.forgotPassword(e),
  });

  const onSubmit = () => {
    if (!email.trim()) return;
    sendMutation.mutate(email.trim().toLowerCase(), {
      onSuccess: () => {
        navigation.navigate('ResetPassword', { email: email.trim().toLowerCase() });
      },
    });
  };

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
          <Text style={styles.title}>Mot de passe oublié</Text>
          <Text style={styles.subtitle}>On t'envoie un code par email</Text>

          <View style={styles.form}>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Saisis l'email avec lequel tu t'es inscrit. Tu recevras un code de
                réinitialisation valable 30 minutes.
              </Text>
            </View>
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
            <Button
              label="Recevoir le code"
              onPress={onSubmit}
              loading={sendMutation.isPending}
              full
            />

            <Pressable
              style={styles.secondaryWrap}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.link}>‹ Retour à la connexion</Text>
            </Pressable>

            <Pressable
              style={styles.secondaryWrap}
              onPress={() => navigation.navigate('ResetPassword', { email: email.trim().toLowerCase() })}
            >
              <Text style={styles.linkSecondary}>J'ai déjà un code</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
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
  secondaryWrap: { alignItems: 'center', marginTop: 14 },
  link: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  linkSecondary: {
    color: colors.gray600,
    fontWeight: '500',
    fontSize: 12,
  },
});
