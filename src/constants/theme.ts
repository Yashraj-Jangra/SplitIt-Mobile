export const THEME = {
  colors: {
    background: '#09090B',
    surface: '#18181B',
    surfaceElevated: '#27272A',
    surfaceSubtle: '#121214',
    border: 'rgba(255, 255, 255, 0.08)',
    borderFocus: 'rgba(255, 255, 255, 0.20)',
    primary: '#10B981', // Emerald 500
    primaryLight: '#34D399',
    negative: '#F43F5E', // Rose 500
    negativeLight: '#FB7185',
    warning: '#F59E0B', // Amber 500
    ai: '#8B5CF6', // Violet 500
    aiLight: '#A78BFA',
    text: '#FAFAFA',
    textSecondary: '#A1A1AA',
    textMuted: '#71717A',
    glassDark: 'rgba(0, 0, 0, 0.70)',
    glassCard: 'rgba(24, 24, 27, 0.85)',
    glassBorder: 'rgba(255, 255, 255, 0.12)',
  },
  radius: {
    xs: 6,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },
  typography: {
    fontFamily: {
      sans: 'System',
      mono: 'Courier',
    },
  },
} as const;
