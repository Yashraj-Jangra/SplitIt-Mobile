# 🎨 Theming & Visual Design Rules

## Zero Hardcoded Colors

**This is the single most important rule in this file.** No hex value, `rgb()`, `rgba()`, or named CSS color may appear outside of [`src/constants/theme.ts`](file:///d:/Projects/SplitIt-Mobile/src/constants/theme.ts).

### Enforcement

- Every color reference in any `.tsx` or `.ts` file **must** use `THEME.colors.*` from `@/constants/theme`.
- Inline `'#XXXXXX'` or `'rgba(...)'` in `StyleSheet.create()`, inline styles, or component props is **forbidden**.
- If a new color is needed, add it to `THEME.colors` first, then reference it.
- The only exception: `app.json` native config values (splash background, adaptive icon background) which must be manually synchronized with `THEME.colors.background`.

### Semantic Color Aliases

The theme object must include semantic aliases that map to the base palette:

```typescript
// Required semantic aliases in THEME.colors
success: '#10B981',       // Emerald — confirmations, balanced states, positive deltas
danger: '#F43F5E',        // Rose — errors, destructive actions, debts
warning: '#F59E0B',       // Amber — caution states, budget alerts
info: '#3B82F6',          // Blue — informational, updates, edits
```

### Notification & Category Colors

All notification accent colors must live in a `THEME.colors.notification` namespace or equivalent semantic grouping — never scattered across component files:

```typescript
notification: {
  expense: '#3B82F6',      // Blue
  payment: '#10B981',      // Emerald
  member: '#F97316',       // Orange
  budget: '#F59E0B',       // Amber
  budgetExceeded: '#F43F5E', // Rose
  support: '#06B6D4',      // Cyan
  announcement: '#A855F7', // Purple
  critical: '#EF4444',     // Red
}
```

---

## Dark Mode Only

- `app.json` must have `"userInterfaceStyle": "dark"`. No light mode support.
- Never use `useColorScheme()` to conditionally theme. The app is permanently dark.
- All design decisions assume a dark canvas (`#131417`). Never design for light backgrounds.

---

## Typography Scale

Define and use a consistent type scale in `THEME.typography`. Never use arbitrary `fontSize` values inline.

```typescript
typography: {
  fontFamily: {
    sans: 'System',
    mono: 'Courier',
  },
  size: {
    caption: 12,     // Timestamps, footnotes, helper text
    body: 14,        // Default body text, list items, descriptions
    subtitle: 16,    // Section headers, form labels, tab labels
    title: 18,       // Screen titles, card headers
    headline: 24,    // Hero stats, prominent values
    hero: 32,        // Amount inputs, feature hero text
  },
  weight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
}
```

### Enforcement

- Use `THEME.typography.size.*` for all `fontSize` values.
- Use `THEME.typography.weight.*` for all `fontWeight` values.
- Exception: one-off decorative elements where the design doc explicitly specifies a custom size (must be commented with reasoning).

---

## Spacing Scale

Define and use a consistent spacing scale in `THEME.spacing`. Never use arbitrary numeric padding/margin values.

```typescript
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
}
```

### Enforcement

- All `padding`, `margin`, `gap`, and positional offsets (`top`, `bottom`, `left`, `right`) must use `THEME.spacing.*`.
- Exception: `StyleSheet.hairlineWidth` for borders, and precise pixel offsets for alignment corrections (must be commented).

---

## Animation Standards

### Engine

- **All animations must use `react-native-reanimated`** (v4+). The legacy `Animated` API from `react-native` is forbidden.
- Use `useSharedValue`, `useAnimatedStyle`, `withSpring`, `withTiming`, `withSequence`, `withDelay`.
- Never use `Animated.Value`, `Animated.timing`, `Animated.spring` from `react-native`.

### Spring Physics Constants

Define standard spring configs in `THEME` or a shared animation constants file:

```typescript
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
}
```

### Rules

- No jarring cuts. Every state transition must animate.
- Tab switches use spring-based sliding underline indicators.
- Modal presentations use spring-based sheet animations.
- List item appearances use staggered fade-in with `withDelay`.
- Screen transitions use platform-adaptive animations (fade on Android, native slide on iOS).

---

## Haptic Feedback Standards

Use `expo-haptics` consistently. Never trigger haptics arbitrarily.

| Event | Haptic Type | Function |
|-------|-------------|----------|
| Button tap / checkbox toggle | Light | `Haptics.impactAsync(ImpactFeedbackStyle.Light)` |
| Successful action (save, settle) | Medium | `Haptics.impactAsync(ImpactFeedbackStyle.Medium)` |
| Error / validation failure | Heavy | `Haptics.notificationAsync(NotificationFeedbackType.Error)` |
| Long press / drag start | Medium | `Haptics.impactAsync(ImpactFeedbackStyle.Medium)` |
| Destructive confirmation | Warning | `Haptics.notificationAsync(NotificationFeedbackType.Warning)` |
| Success confirmation | Success | `Haptics.notificationAsync(NotificationFeedbackType.Success)` |

---

## Loading States

- **Every async screen must show shimmer skeletons**, never blank screens, "No data" messages, or spinner wheels during initial load.
- Skeleton components live in `src/components/skeletons/` and must visually match the layout they replace.
- After data loads, skeletons cross-fade to real content (never a hard cut).
- Pull-to-refresh uses inline skeleton overlays, not full-screen replacements.
