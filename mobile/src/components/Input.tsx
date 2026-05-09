import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors } from '../theme/colors';

interface InputProps extends TextInputProps {
  label?: string;
  helperText?: string;
  errorText?: string;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, helperText, errorText, style, ...rest },
  ref,
) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.gray400}
        style={[styles.input, !!errorText && styles.inputError, style]}
        {...rest}
      />
      {errorText ? (
        <Text style={styles.errorText}>{errorText}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: { marginBottom: 14 },
  label: {
    fontSize: 12,
    color: colors.gray600,
    marginBottom: 5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  input: {
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    fontSize: 13,
    color: colors.black,
  },
  inputError: { borderColor: colors.primary },
  helperText: { fontSize: 11, color: colors.gray500, marginTop: 4, lineHeight: 15 },
  errorText: { fontSize: 11, color: colors.primary, marginTop: 4, lineHeight: 15 },
});
