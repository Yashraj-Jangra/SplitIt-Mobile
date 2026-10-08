# ⚡ Performance & Hardware Acceleration Rules

## Core Principle

This is a finance app that users open daily. It must feel **instant**. Every interaction — scrolling, navigating, typing, animating — must run at 60fps on mid-range Android devices. No jank, no dropped frames, no loading spinners.

---

## Animation Engine

### Mandatory: Reanimated Only

- **All animations must use `react-native-reanimated`** (v4+).
- The legacy `Animated` API from `react-native` is **forbidden** for new code.
- `react-native-reanimated` runs animations on the **UI thread**, not the JS thread. This is the difference between 60fps and jank.

### Forbidden Patterns

```typescript
// ❌ NEVER use these
import { Animated } from 'react-native';
new Animated.Value(0);
Animated.timing(...);
Animated.spring(...);
Animated.parallel(...);

// ✅ ALWAYS use these
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
```

### useNativeDriver

- When using `react-native-gesture-handler` + `Animated` (legacy interop), always set `useNativeDriver: true`.
- However, prefer pure Reanimated worklets over legacy Animated + native driver.

---

## Component Memoization

### React.memo

- **Every component that renders inside a list or receives stable props must be wrapped in `React.memo`**.
- Components that re-render on every parent render without changed props waste CPU cycles and cause frame drops.

```typescript
// ✅ Memoized list item
export const ExpenseRow = React.memo(function ExpenseRow({ expense, onPress }: Props) {
  // ...
});
```

### useCallback / useMemo

- **All event handlers passed as props** must be wrapped in `useCallback`.
- **All derived/computed values** must be wrapped in `useMemo`.
- Never create inline arrow functions in JSX that are passed to child components:

```typescript
// ❌ Creates a new function on every render — breaks React.memo
<ExpenseRow onPress={() => handlePress(expense.id)} />

// ✅ Stable reference
const handlePress = useCallback((id: string) => { ... }, []);
<ExpenseRow onPress={handlePress} />
```

---

## FlatList Optimization

Every `FlatList` and `SectionList` must use these performance props:

```tsx
<FlatList
  data={items}
  renderItem={renderItem}           // Must be a stable callback (useCallback)
  keyExtractor={keyExtractor}       // Must be a stable callback
  getItemLayout={getItemLayout}     // REQUIRED for fixed-height rows — skips measurement
  windowSize={5}                    // Render 5 viewport heights of content
  maxToRenderPerBatch={10}          // Render 10 items per batch
  initialNumToRender={15}           // Initial render count
  removeClippedSubviews={true}      // Reclaim memory for off-screen items
  updateCellsBatchingPeriod={50}    // Batch update period in ms
/>
```

### Rules

- **Never use `ScrollView` for lists of dynamic length.** Always use `FlatList` or `SectionList`.
- If `getItemLayout` cannot be computed (variable height rows), use `estimatedItemSize` patterns or measure on first render.
- Always extract `renderItem` into a `useCallback` — never inline it.
- Use `keyExtractor` with stable unique IDs (never array indices).

---

## Inline Styles

- **Inline style objects are forbidden** for any component that re-renders. They create new object references on every render.
- Use `StyleSheet.create()` for all static styles.
- For dynamic styles (e.g., color based on state), use `useMemo` or Reanimated `useAnimatedStyle`.

```typescript
// ❌ New object every render
<View style={{ backgroundColor: isActive ? THEME.colors.primary : THEME.colors.surface }}>

// ✅ Memoized dynamic style
const dynamicStyle = useMemo(
  () => ({ backgroundColor: isActive ? THEME.colors.primary : THEME.colors.surface }),
  [isActive]
);
<View style={[styles.container, dynamicStyle]}>
```

---

## Image Optimization

- Use `expo-image` (or `react-native-fast-image` if needed) instead of the built-in `<Image>` component for network images.
- Always specify `width` and `height` to avoid layout shifts.
- Use `contentFit="cover"` (not `resizeMode`).
- Enable caching: `cachePolicy="memory-disk"`.
- For avatar lists, use small thumbnail URLs — never load full-resolution photos in list views.

---

## Memory Management

- **Clean up subscriptions** in `useEffect` return functions (keyboard listeners, network listeners, realtime channels).
- **Cancel pending async operations** when components unmount — use `AbortController` or mounted flags.
- **Avoid storing large datasets in state** — paginate, virtualize, or stream.
- **Use `removeClippedSubviews`** on long lists to reclaim off-screen memory.

---

## Bundle Size

- Never import entire libraries when a specific import is available:
  ```typescript
  // ❌ Imports the entire library
  import * as Haptics from 'expo-haptics';

  // ✅ Tree-shakeable (if supported by the library)
  import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
  ```
- Audit bundle size periodically with `npx expo export` and review the output.
- Lazy-load heavy screens using React's `lazy()` + `Suspense` when appropriate.

---

## Profiling Checklist

Before shipping any new screen or major feature:
- [ ] JS thread frame rate stays ≥ 55fps during normal interaction (Flipper/Perf Monitor).
- [ ] UI thread frame rate stays at 60fps during animations.
- [ ] No "VirtualizedList: You have a large list" warnings.
- [ ] No unnecessary re-renders visible in React DevTools Profiler.
- [ ] Memory usage stays stable during navigation (no leaks).
- [ ] Cold start time ≤ 2 seconds on a mid-range Android device.
