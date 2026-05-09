import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';

/**
 * Décide ce qu'on affiche selon l'état d'auth :
 * - tant que le store n'est pas hydraté depuis AsyncStorage → splash loader
 * - si pas de session → AuthStack (Login / Register / Forgot)
 * - si session → MainTabs (Planning / Slots / Messages / Profil)
 */
export function RootNavigator() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const tokens = useAuthStore((s) => s.tokens);

  if (!hydrated) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  return tokens ? <MainTabs /> : <AuthStack />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
});
