export const THEME = {
  colors: {
    background: '#000000', // Pure OLED Pitch Black
    surface: '#0A0A0C', // Ultra-dark subtle elevation
    surfaceElevated: '#141417', // High-contrast interactive layer
    surfaceSubtle: '#0E0E11', // Inset / recessed element backdrop
    surfacePill: '#1A1A1F', // Pill selector backdrop
    border: 'rgba(255, 255, 255, 0.07)', // Ultra-subtle hairline
    borderFocus: 'rgba(255, 255, 255, 0.22)',
    hairline: 'rgba(255, 255, 255, 0.06)',
    hairlineLight: 'rgba(255, 255, 255, 0.12)',
    primary: '#10B981', // Clean Emerald
    primaryLight: '#34D399',
    primaryMuted: 'rgba(16, 185, 129, 0.12)',
    negative: '#F43F5E', // Clean Rose
    negativeLight: '#FB7185',
    negativeMuted: 'rgba(244, 63, 94, 0.12)',
    warning: '#F59E0B',
    ai: '#8B5CF6', // Electric Violet
    aiLight: '#A78BFA',
    aiMuted: 'rgba(139, 92, 246, 0.14)',
    text: '#FFFFFF', // High-contrast crisp white
    textSecondary: '#A1A1AA', // Zinc 400
    textMuted: '#52525B', // Zinc 600
    glassDark: 'rgba(0, 0, 0, 0.65)',
    glassCard: 'rgba(10, 10, 12, 0.85)',
    glassBorder: 'rgba(255, 255, 255, 0.10)',
  },
  radius: {
    xs: 6,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    full: 9999,
  },
  typography: {
    fontFamily: {
      sans: 'System',
      mono: 'Courier',
    },
  },
} as const;
