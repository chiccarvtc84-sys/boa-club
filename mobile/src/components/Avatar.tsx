import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '../theme/colors';

type AvatarColor = 1 | 2 | 3 | 4 | 5;

interface AvatarProps {
  initials: string;
  color?: AvatarColor;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

const PALETTE: Record<AvatarColor, string> = {
  1: colors.black,
  2: colors.primary,
  3: colors.belt.purple,
  4: colors.belt.blue,
  5: colors.belt.brown,
};

export function Avatar({ initials, color = 1, size = 40, style }: AvatarProps) {
  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: PALETTE[color],
        },
        style,
      ]}
    >
      <Text style={[styles.text, { fontSize: size * 0.36 }]}>
        {initials.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.white, fontWeight: '600' },
});
