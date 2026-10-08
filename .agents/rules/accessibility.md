# ♿ Accessibility (a11y) Rules

## Core Principle

An accessible app is a well-built app. Accessibility isn't a nice-to-have — it directly improves usability for all users (one-handed use, bright sunlight, motor impairments, screen readers).

---

## Touch Targets

- **Minimum touch target size: 44x44 points** (Apple HIG / Material Design guideline).
- If a visual element is smaller than 44x44 (e.g., a small icon button), expand the touchable area using `hitSlop` or padding:
  ```tsx
  <Pressable hitSlop={12} style={styles.iconButton}>
    <Trash2 size={20} />
  </Pressable>
  ```

---

## Accessibility Props

### Every Interactive Element Must Have:

```tsx
<Pressable
  accessibilityLabel="Delete expense"         // What it is (read by screen reader)
  accessibilityRole="button"                  // What type of element
  accessibilityHint="Permanently removes this expense" // What happens when activated
  accessibilityState={{ disabled: isLoading }} // Current state
>
```

### Required `accessibilityRole` Values

| Element | Role |
|---------|------|
| Buttons, pressables | `"button"` |
| Links/navigation | `"link"` |
| Text inputs | `"text"` (auto on TextInput) |
| Checkboxes | `"checkbox"` |
| Switches/toggles | `"switch"` |
| Tab buttons | `"tab"` |
| Images with meaning | `"image"` |
| Headers/titles | `"header"` |

### Decorative Elements

Images and icons that are purely decorative (not informational) must be hidden from screen readers:

```tsx
<View accessibilityElementsHidden={true} importantForAccessibility="no">
  <DecorativeIcon />
</View>
```

---

## Dynamic Font Scaling

- **Support system font size preferences.** Never use `allowFontScaling={false}` on body text.
- Exception: Amount displays and hero values can cap scaling with `maxFontSizeMultiplier={1.5}` to prevent layout breakage.
- Test the app with system font scaled to "Largest" on both iOS and Android.
- Layouts must accommodate 200% font scaling without overlapping or clipping.

---

## Color Contrast

- All text must meet **WCAG AA contrast ratio** (≥ 4.5:1 for body text, ≥ 3:1 for large text).
- On dark background (`#131417`):
  - `#FFFFFF` (primary text) = 16.8:1 ✅
  - `#9CA3AF` (secondary text) = 6.1:1 ✅
  - `#6B7280` (muted text) = 4.0:1 ⚠️ — use only for non-essential decorative text.
- Never convey information through color alone. Use icons, labels, or patterns alongside color.

---

## Screen Reader Navigation

- Group related elements using `accessible={true}` on container views to combine them into single focusable units.
- Order tab/focus sequence logically (top-to-bottom, left-to-right).
- Announce dynamic content changes with `AccessibilityInfo.announceForAccessibility()`.
- Loading states must announce "Loading" and completion must announce "Content loaded".

---

## Reduced Motion

- Respect the user's "Reduce Motion" accessibility setting:
  ```typescript
  import { AccessibilityInfo } from 'react-native';
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);
  ```
- When reduce motion is enabled, replace spring animations with instant transitions or simple fades.

---

## Testing

- [ ] Run VoiceOver (iOS) / TalkBack (Android) on every new screen.
- [ ] All interactive elements are reachable and labeled.
- [ ] Dynamic content changes are announced.
- [ ] App is usable with system font at 200%.
- [ ] No information is conveyed through color alone.
