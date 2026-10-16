export const THEME = {
  colors: {
    background: '#131417', // Refined obsidian charcoal canvas
    surface: '#1A1B1F', // Matte charcoal elevation
    surfaceElevated: '#222429', // Elevated interactive layer
    surfaceSubtle: '#16171B', // Inset / recessed element backdrop
    surfacePill: '#26282E', // Pill selector backdrop
    border: 'rgba(255, 255, 255, 0.08)', // Ultra-subtle hairline
    borderFocus: 'rgba(0, 196, 204, 0.45)',
    borderSubtle: '#374151',
    hairline: 'rgba(255, 255, 255, 0.06)',
    hairlineLight: 'rgba(255, 255, 255, 0.12)',
    primary: '#00C4CC', // Canonical SplitIt Teal/Cyan (matching web hsl(180, 100%, 40%))
    primaryForeground: '#09090B', // Dark contrast text/icon on top of primary
    primaryLight: '#33D6DC',
    primaryMuted: 'rgba(0, 196, 204, 0.14)',
    negative: '#F43F5E', // Clean Rose
    negativeLight: '#FB7185',
    negativeMuted: 'rgba(244, 63, 94, 0.14)',

    // Semantic aliases
    success: '#10B981', // Emerald — confirmations, settlements, positive balances
    successLight: '#34D399',
    successMuted: 'rgba(16, 185, 129, 0.14)',
    successSubtle: '#12251D',
    successBorder: 'rgba(16, 185, 129, 0.4)',
    danger: '#F43F5E', // Rose — errors, deletions, negative debts
    dangerLight: '#FB7185',
    dangerMuted: 'rgba(244, 63, 94, 0.14)',
    warning: '#F59E0B', // Amber — warnings, caution, pending states
    warningLight: '#FCD34D',
    warningMuted: 'rgba(245, 158, 11, 0.14)',
    info: '#3B82F6', // Blue — updates, edits, informational notes
    infoLight: '#60A5FA',
    infoMuted: 'rgba(59, 130, 246, 0.14)',
    critical: '#EF4444', // Red — destructive actions, system errors

    ai: '#8B5CF6', // Electric Violet
    aiLight: '#A78BFA',
    aiMuted: 'rgba(139, 92, 246, 0.14)',
    aiSurface: '#0D0A14',
    aiBorder: 'rgba(139, 92, 246, 0.22)',
    text: '#FFFFFF', // High-contrast crisp white
    textSecondary: '#9CA3AF', // Zinc 400
    textMuted: '#6B7280', // Zinc 500
    glassDark: 'rgba(19, 20, 23, 0.85)',
    glassCard: 'rgba(26, 27, 31, 0.85)',
    glassBorder: 'rgba(255, 255, 255, 0.08)',

    // Notification accent colors
    notification: {
      expense: '#3B82F6', // Blue
      payment: '#10B981', // Emerald
      member: '#F97316', // Orange
      budget: '#F59E0B', // Amber
      budgetExceeded: '#F43F5E', // Rose
      support: '#06B6D4', // Cyan
      announcement: '#A855F7', // Purple
      critical: '#EF4444', // Red
    },

    // Category colors
    categories: {
      food: '#3B82F6',
      transportation: '#8B5CF6',
      housing: '#10B981',
      utilities: '#F59E0B',
      entertainment: '#EC4899',
      shopping: '#06B6D4',
      health: '#EF4444',
      personal: '#A855F7',
      education: '#6366F1',
      gifts: '#EAB308',
      travel: '#14B8A6',
      uncategorized: '#64748B',
      other: '#64748B',
    },

    // Skeleton shimmer tokens
    skeleton: {
      base: '#2D3748',
      highlight: '#374151',
      card: '#1E232B',
      surface: 'rgba(255, 255, 255, 0.03)',
    },

    // Brand tokens
    brand: {
      googleRed: '#EA4335',
      googleBlue: '#4285F4',
      googleYellow: '#FBBC05',
      googleGreen: '#34A853',
    },

    // Base color palette
    palette: {
      white: '#FFFFFF',
      black: '#000000',
      emerald: '#10B981',
      rose: '#F43F5E',
      amber: '#F59E0B',
      blue: '#3B82F6',
      purple: '#A855F7',
      orange: '#F97316',
      cyan: '#06B6D4',
      pink: '#EC4899',
      indigo: '#6366F1',
      teal: '#14B8A6',
      slate: '#64748B',
    },
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
    size: {
      caption: 12, // Timestamps, footnotes, helper text
      body: 14, // Default body text, list items, descriptions
      subtitle: 16, // Section headers, form labels, tab labels
      title: 18, // Screen titles, card headers
      headline: 24, // Hero stats, prominent values
      hero: 32, // Amount inputs, feature hero text
    },
    weight: {
      normal: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
    '5xl': 48,
  },
  animation: {
    spring: {
      default: { damping: 15, stiffness: 150 },
      snappy: { damping: 20, stiffness: 200 },
      gentle: { damping: 12, stiffness: 100 },
    },
    timing: {
      fast: 150,
      normal: 250,
      slow: 400,
    },
  },
} as const;
