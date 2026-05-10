import { useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';

import { meApi } from '../../api/me';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../theme/colors';
import type { Belt, WeightVisibility } from '../../types/models';
import type { ProfileStackNavigation } from '../../navigation/ProfileStack';

interface EditProfileScreenProps {
  navigation: ProfileStackNavigation<'EditProfile'>;
}

const BELTS: { value: Belt; label: string }[] = [
  { value: 'white', label: 'Blanche' },
  { value: 'blue', label: 'Bleue' },
  { value: 'purple', label: 'Violette' },
  { value: 'brown', label: 'Marron' },
  { value: 'black', label: 'Noire' },
];
const VISIBILITIES: { value: WeightVisibility; label: string }[] = [
  { value: 'public', label: 'Public' },
  { value: 'members', label: 'Adhérents' },
  { value: 'private', label: 'Privé' },
];
const DISCIPLINES = ['JJB Gi', 'JJB No-Gi', 'MMA', 'Wrestling'];

export function EditProfileScreen({ navigation }: EditProfileScreenProps) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastInitial, setLastInitial] = useState(user?.last_name_initial ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [belt, setBelt] = useState<Belt>(user?.belt ?? 'white');
  const [stripes, setStripes] = useState<number>(user?.stripes ?? 0);
  const [weight, setWeight] = useState<string>(
    user?.weight_kg ? String(user.weight_kg) : '',
  );
  const [visibility, setVisibility] = useState<WeightVisibility>(
    user?.weight_visibility ?? 'members',
  );
  const [disciplines, setDisciplines] = useState<string[]>(
    user?.disciplines && user.disciplines.length > 0 ? user.disciplines : ['JJB Gi'],
  );
  // Photo de profil : on garde une URI locale en state pour l'aperçu.
  // Init = avatar_url existant si déjà présent (URL distante), sinon null.
  const [avatarUri, setAvatarUri] = useState<string | null>(
    user?.avatar_url ?? null,
  );

  if (!user) return null;

  const toggleDiscipline = (d: string) => {
    setDisciplines((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );
  };

  // ── Photo de profil : sélection caméra / galerie ────────────────

  const pickPhotoFromSource = async (source: 'camera' | 'library') => {
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permission refusée',
        source === 'camera'
          ? "L'app a besoin d'accéder à la caméra pour prendre une photo."
          : "L'app a besoin d'accéder à ta galerie pour choisir une photo.",
      );
      return;
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
          });
    if (!result.canceled && result.assets?.[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const onChangePhoto = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Annuler', 'Prendre une photo', 'Choisir dans la galerie'],
          cancelButtonIndex: 0,
        },
        (idx) => {
          if (idx === 1) pickPhotoFromSource('camera');
          else if (idx === 2) pickPhotoFromSource('library');
        },
      );
    } else {
      Alert.alert('Photo de profil', undefined, [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Prendre une photo', onPress: () => pickPhotoFromSource('camera') },
        { text: 'Galerie', onPress: () => pickPhotoFromSource('library') },
      ]);
    }
  };

  const updateMutation = useMutation({
    mutationFn: meApi.update,
    onSuccess: async (updatedUser) => {
      /*
       * On préserve l'URI de la photo choisie côté local : tant que le
       * backend n'a pas d'endpoint d'upload (POST /api/uploads), l'API
       * renvoie un user sans avatar_url. On l'écrase manuellement avec
       * notre URI locale (file://...) pour que l'aperçu reste visible
       * dans toute l'app pendant la session.
       */
      await setUser({ ...updatedUser, avatar_url: avatarUri });
      navigation.goBack();
    },
  });

  const onSave = () => {
    const trimmedBio = bio.trim();
    updateMutation.mutate({
      first_name: firstName.trim() || user.first_name,
      last_name_initial: lastInitial.trim() || user.last_name_initial,
      ...(trimmedBio ? { bio: trimmedBio } : {}),
      belt,
      stripes,
      ...(weight ? { weight_kg: Number(weight) } : {}),
      weight_visibility: visibility,
      disciplines,
    });
  };

  const initials = (firstName[0] || 'Y') + (lastInitial[0] || 'B');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Modifier mon profil</Text>
        </View>
        <Pressable onPress={onSave} style={styles.headerOK}>
          <Text style={styles.headerOKText}>OK</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Photo */}
          <View style={styles.avatarRow}>
            <Pressable onPress={onChangePhoto}>
              <Avatar
                initials={initials}
                color={1}
                size={64}
                imageUri={avatarUri}
              />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.avatarTitle}>Photo de profil</Text>
              <Pressable onPress={onChangePhoto}>
                <Text style={styles.avatarLink}>
                  {avatarUri ? 'Changer la photo' : 'Ajouter une photo'}
                </Text>
              </Pressable>
              {avatarUri ? (
                <Pressable onPress={() => setAvatarUri(null)}>
                  <Text style={styles.avatarRemove}>Retirer</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* Prénom / Initiale */}
          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Text style={styles.label}>Prénom</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholderTextColor={colors.gray400}
              />
            </View>
            <View style={styles.rowItem}>
              <Text style={styles.label}>Initiale</Text>
              <TextInput
                style={styles.input}
                value={lastInitial}
                onChangeText={setLastInitial}
                maxLength={3}
                autoCapitalize="characters"
                placeholderTextColor={colors.gray400}
              />
            </View>
          </View>

          {/* Bio */}
          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={bio}
            onChangeText={setBio}
            placeholder="Quelques mots sur toi…"
            placeholderTextColor={colors.gray400}
            multiline
          />

          {/* Ceinture */}
          <Text style={styles.label}>Ceinture</Text>
          <View style={styles.pillsRow}>
            {BELTS.map((b) => (
              <Pressable
                key={b.value}
                style={[styles.pill, belt === b.value && styles.pillSelected]}
                onPress={() => setBelt(b.value)}
              >
                <Text
                  style={[
                    styles.pillText,
                    belt === b.value && styles.pillTextSelected,
                  ]}
                >
                  {b.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Stripes */}
          <Text style={styles.label}>Stripes</Text>
          <View style={styles.stripesRow}>
            {[0, 1, 2, 3, 4].map((n) => (
              <Pressable
                key={n}
                style={[styles.stripe, stripes === n && styles.stripeSelected]}
                onPress={() => setStripes(n)}
              >
                <Text
                  style={[
                    styles.stripeText,
                    stripes === n && styles.stripeTextSelected,
                  ]}
                >
                  {n}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Poids */}
          <Text style={styles.label}>Poids (kg)</Text>
          <TextInput
            style={styles.input}
            value={weight}
            onChangeText={setWeight}
            placeholder="75"
            keyboardType="numeric"
            placeholderTextColor={colors.gray400}
          />

          {/* Visibilité poids */}
          <Text style={styles.label}>Visibilité du poids</Text>
          <View style={styles.pillsRow}>
            {VISIBILITIES.map((v) => (
              <Pressable
                key={v.value}
                style={[styles.pill, visibility === v.value && styles.pillSelected]}
                onPress={() => setVisibility(v.value)}
              >
                <Text
                  style={[
                    styles.pillText,
                    visibility === v.value && styles.pillTextSelected,
                  ]}
                >
                  {v.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Disciplines (multi) */}
          <Text style={styles.label}>Disciplines pratiquées</Text>
          <View style={styles.pillsRow}>
            {DISCIPLINES.map((d) => {
              const active = disciplines.includes(d);
              return (
                <Pressable
                  key={d}
                  style={[styles.pill, active && styles.pillMultiSelected]}
                  onPress={() => toggleDiscipline(d)}
                >
                  <Text
                    style={[styles.pillText, active && styles.pillTextSelected]}
                  >
                    {d}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.helper}>Plusieurs choix possibles.</Text>

          {updateMutation.error ? (
            <Text style={styles.errorText}>
              Échec de la sauvegarde — vérifie ta connexion.
            </Text>
          ) : null}
          <Button
            label="Enregistrer"
            onPress={onSave}
            loading={updateMutation.isPending}
            full
            style={{ marginTop: 8 }}
          />
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
  headerOK: {
    backgroundColor: colors.primary,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
  },
  headerOKText: { color: colors.white, fontWeight: '700', fontSize: 12 },

  scroll: { padding: 14 },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 18,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  avatarTitle: { fontSize: 14, fontWeight: '600', color: colors.black },
  avatarLink: { color: colors.primary, fontWeight: '600', fontSize: 13, marginTop: 4 },
  avatarRemove: { color: colors.gray500, fontSize: 12, marginTop: 4 },

  row: { flexDirection: 'row', gap: 8 },
  rowItem: { flex: 1 },

  label: {
    fontSize: 12,
    color: colors.gray600,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 5,
    marginTop: 14,
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
  textarea: { minHeight: 70, textAlignVertical: 'top' },
  helper: { fontSize: 11, color: colors.gray500, marginTop: 4, lineHeight: 16 },

  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  pill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  pillSelected: { backgroundColor: colors.black, borderColor: colors.black },
  pillMultiSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: 11.5, color: colors.black, fontWeight: '500' },
  pillTextSelected: { color: colors.white, fontWeight: '600' },

  stripesRow: { flexDirection: 'row', gap: 6 },
  stripe: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripeSelected: { backgroundColor: colors.black, borderColor: colors.black },
  stripeText: { fontWeight: '700', fontSize: 13, color: colors.black },
  stripeTextSelected: { color: colors.white },

  errorText: {
    fontSize: 12,
    color: colors.primary,
    textAlign: 'center',
    marginTop: 12,
  },
});
