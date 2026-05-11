/**
 * Modale plein-écran pour afficher une image en grand.
 *
 * UX :
 * - Fond noir
 * - Image centrée à pleine taille (resizeMode="contain")
 * - Tap n'importe où sur le fond pour fermer
 * - Swipe-down natif (presentationStyle pageSheet) sur iOS
 * - Croix ✕ ronde en haut-droite (zone tactile généreuse)
 *
 * NB : pas de pinch-to-zoom dans cette V1 (nécessiterait gesture-handler +
 * reanimated, gros effort). L'image est juste affichée à pleine taille,
 * suffisant pour voir une photo de profil clairement.
 */
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';

interface ImageZoomModalProps {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
}

export function ImageZoomModal({ visible, uri, onClose }: ImageZoomModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="overFullScreen"
      transparent
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Fond cliquable pour fermer */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        {/* Image centrée */}
        {uri ? (
          <View style={styles.imageWrap} pointerEvents="none">
            <Image source={{ uri }} style={styles.image} resizeMode="contain" />
          </View>
        ) : null}

        {/* Croix de fermeture en haut-droite */}
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={16}
          >
            <Text style={styles.closeIcon}>✕</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  header: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 10,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  closeIcon: {
    fontSize: 18,
    color: colors.white,
    fontWeight: '700',
    lineHeight: 18,
  },
  imageWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
});
