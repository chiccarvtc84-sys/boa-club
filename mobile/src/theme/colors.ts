/**
 * Palette Boa Club — extraite du prototype HTML.
 * Toujours importer depuis ici, jamais de couleur hex en dur dans un écran.
 */
export const colors = {
  // Identité
  primary: '#DC2626', // Rouge Bōa
  black: '#1a1a1a',
  white: '#FFFFFF',

  // Niveaux de gris
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  border: '#E5E5E5',

  // Ceintures JJB (couleurs natives)
  belt: {
    white: { bg: '#FFFFFF', border: '#1a1a1a', text: '#1a1a1a' },
    blue: '#1E3A8A',
    purple: '#6D28D9',
    brown: '#7C2D12',
    black: '#1a1a1a',
    coach: '#DC2626',
  },

  // Alertes coach
  alert: {
    late: { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' },
    absent: { bg: '#FEE2E2', text: '#991B1B', border: '#DC2626' },
  },

  // Chat
  chat: {
    mineBg: '#DC2626',
    mineText: '#FFFFFF',
    themBg: '#F1F1F2',
    themText: '#1a1a1a',
  },
} as const;
