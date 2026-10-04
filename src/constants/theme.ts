export const THEME = {
  colors: {
    background: '#131417', // Refined obsidian charcoal canvas
    surface: '#1A1B1F', // Matte charcoal elevation
    surfaceElevated: '#222429', // Elevated interactive layer
    surfaceSubtle: '#16171B', // Inset / recessed element backdrop
    surfacePill: '#26282E', // Pill selector backdrop
    border: 'rgba(255, 255, 255, 0.08)', // Ultra-subtle hairline
    borderFocus: 'rgba(28, 194, 159, 0.45)',
    hairline: 'rgba(255, 255, 255, 0.06)',
    hairlineLight: 'rgba(255, 255, 255, 0.12)',
    primary: '#1CC29F', // Iconic Splitwise Teal / Mint
    primaryLight: '#3FE3BF',
    primaryMuted: 'rgba(28, 194, 159, 0.14)',
    negative: '#F43F5E', // Clean Rose
    negativeLight: '#FB7185',
    negativeMuted: 'rgba(244, 63, 94, 0.14)',
    warning: '#F59E0B',
    ai: '#8B5CF6', // Electric Violet
    aiLight: '#A78BFA',
    aiMuted: 'rgba(139, 92, 246, 0.14)',
    text: '#FFFFFF', // High-contrast crisp white
    textSecondary: '#9CA3AF', // Zinc 400
    textMuted: '#6B7280', // Zinc 500
    glassDark: 'rgba(19, 20, 23, 0.85)',
    glassCard: 'rgba(26, 27, 31, 0.85)',
    glassBorder: 'rgba(255, 255, 255, 0.08)',
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
