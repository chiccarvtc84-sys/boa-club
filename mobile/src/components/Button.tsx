import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors } from '../theme/colors';

type ButtonVariant = 'primary' | 'outline';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  full?: boolean;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  full = false,
  loading = false,
  disabled = false,
  style,
}: ButtonProps) {
  const isInactive = disabled || loading;
  const containerStyle = [
    styles.base,
    variant === 'primary' ? styles.primary : styles.outline,
    full && styles.full,
    isInactive && styles.inactive,
    style,
  ];
  const textStyle = [
    styles.text,
    variant === 'primary' ? styles.textPrimary : styles.textOutline,
  ];
  return (
    <Pressable style={containerStyle} onPress={onPress} disabled={isInactive}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.white : colors.black} />
      ) : (
        <Text style={textStyle}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  full: { width: '100%' },
  primary: { backgroundColor: colors.primary },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.black,
  },
  inactive: { opacity: 0.6 },
  text: { fontSize: 14, fontWeight: '600' },
  textPrimary: { color: colors.white },
  textOutline: { color: colors.black },
});
