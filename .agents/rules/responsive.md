# 📐 Responsive Design Rules

## Core Principle

The app must look and feel native on every device — from a 5" budget Android phone to a 6.7" iPhone Pro Max to an iPad. Layouts must adapt, never break.

---

## Safe Areas

- **Every screen must use `SafeAreaView` or `useSafeAreaInsets`** from `react-native-safe-area-context`.
- Never hardcode status bar height or bottom insets — they vary across devices (notch, Dynamic Island, gesture bar, Android navigation modes).
- Apply safe area padding to:
  - Top: Screen headers and status bar clearance.
  - Bottom: Tab bars, floating action buttons, keyboard-anchored toolbars.
  - Left/Right: On tablets or landscape mode (if supported).

```tsx
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const insets = useSafeAreaInsets();
<View style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
```

---

## Layout Strategy

### Percentage-Based Widths

- Use `Dimensions.get('window')` or `useWindowDimensions()` for responsive calculations.
- Prefer flex-based layouts over absolute pixel widths.
- Card widths, modals, and overlays should use percentage-based widths or `maxWidth` constraints.

### Avoid Hardcoded Heights

- Content areas should grow with their content (use `flex: 1`, not `height: 500`).
- Exception: Fixed-height elements (tab bars, input accessory toolbars, navigation headers) where the height is defined by design spec — use `THEME.spacing` constants.

---

## Screen Dimensions

### Compact Screens (< 375px width)

- Reduce horizontal padding from `THEME.spacing.lg` to `THEME.spacing.md`.
- Stack horizontal layouts vertically if they overflow.
- Ensure amount inputs and action buttons remain fully visible.

### Standard Screens (375-428px width)

- Primary design target. All specs in `design.md` are designed for this range.

### Large Screens (> 428px width)

- Content should still be centered/constrained — never stretch edge-to-edge on wide displays.
- Use `maxWidth: 480` on main content containers for tablets.

---

## Orientation

- The app is locked to **portrait only** (`"orientation": "portrait"` in `app.json`).
- Never design for landscape unless explicitly requested.
- If landscape support is added in the future, every screen must be tested in both orientations.

---

## Keyboard-Aware Layouts

- See [keyboard.md](file:///d:/Projects/SplitIt-Mobile/.agents/rules/keyboard.md) for comprehensive keyboard handling rules.
- Forms must be usable on the smallest supported screen (5" / 320px width) with the keyboard deployed.

---

## Testing

- [ ] Test on a 5" screen (small Android, e.g., Pixel 4a).
- [ ] Test on a 6.7" screen (iPhone Pro Max / large Android).
- [ ] Test with system font at 200% (no overflow, no clipping).
- [ ] Verify safe area padding on devices with notch, Dynamic Island, and gesture navigation.
- [ ] Verify bottom toolbar / FAB doesn't overlap the system gesture bar.
