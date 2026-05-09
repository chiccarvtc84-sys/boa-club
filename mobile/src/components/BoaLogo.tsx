import { Image, StyleSheet } from 'react-native';

import { BOA_LOGO_URI } from '../theme/logo';

interface BoaLogoProps {
  size?: number;
}

/**
 * Logo officiel du Clube Desportivo Boa.
 * Source : `src/theme/logo.ts` (data URI base64).
 */
export function BoaLogo({ size = 64 }: BoaLogoProps) {
  return (
    <Image
      source={{ uri: BOA_LOGO_URI }}
      style={[styles.logo, { width: size, height: size }]}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  logo: { borderRadius: 4 },
});
