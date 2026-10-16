This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility. This app must feel **production-grade** — hardware-accelerated, zero crashes, instant navigation, and polished down to every pixel.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx jest --passWithNoTests  # run tests
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint, typecheck, **and tests** before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils, services, constants) inside `src/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Foundational Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

---

## Production-Grade Rules System

This project enforces a comprehensive set of rules organized by category. **Read the relevant rule file before writing code in that area.** Rules live in `.agents/rules/`:

### 🎨 [Theming & Visual Design](file:///d:/Projects/SplitIt-Mobile/.agents/rules/theming.md)
- **Zero hardcoded colors** — every color comes from `THEME.colors.*` in `src/constants/theme.ts`.
- Dark-mode only (`userInterfaceStyle: 'dark'`).
- **Open editorial & "no-div" design** — abolish card soup and nested boxes; use continuous hairlines, visual connecting stem lines, nodes, and status pills instead of text clutter.
- **Consistent width parity** — standard 16px screen padding; child tab views must never add nested horizontal padding or inner scroll views.
- Consistent typography scale, spacing scale, and border radius tokens.
- All animations use `react-native-reanimated` with defined spring physics.
- Haptic feedback standards for every interaction type.
- Shimmer skeleton loading states — never blank screens or spinners.

### ⌨️ [Keyboard Compatibility](file:///d:/Projects/SplitIt-Mobile/.agents/rules/keyboard.md)
- `KeyboardAvoidingView` on every form screen.
- Correct `keyboardType` for every input (decimal-pad for amounts, etc.).
- Return key chaining between fields (`onSubmitEditing` → next input focus).
- Input accessory toolbar docked above keyboard.
- Keyboard never obscures the active input.

### 🧪 [Testing — Tests Are The Gate](file:///d:/Projects/SplitIt-Mobile/.agents/rules/testing.md)
- Pre-commit gate: `tsc --noEmit` + `expo lint` + `jest` must all pass.
- Services and utilities: ≥ 80% coverage.
- Business logic (splits, balances): ≥ 90% coverage.
- Every async screen has error/loading/empty state handling tested.

### ⚡ [Performance & Hardware Acceleration](file:///d:/Projects/SplitIt-Mobile/.agents/rules/performance.md)
- `react-native-reanimated` only — legacy `Animated` API is forbidden.
- `React.memo` on all list-rendered components.
- `useCallback` / `useMemo` on all handlers and derived values.
- `FlatList` with `getItemLayout`, `windowSize`, `maxToRenderPerBatch` tuning.
- No inline style objects on re-rendering components.
- 60fps target on mid-range Android.

### 🛡️ [Crash Prevention & Defensive Coding](file:///d:/Projects/SplitIt-Mobile/.agents/rules/crash-prevention.md)
- Every `async` call wrapped in `try/catch/finally`.
- Root and screen-level `ErrorBoundary` components.
- Optional chaining (`?.`) and nullish coalescing (`??`) everywhere.
- Graceful offline fallbacks with cached data.
- No unhandled promise rejections.

### 📦 [Dependency & SDK Hygiene](file:///d:/Projects/SplitIt-Mobile/.agents/rules/dependencies.md)
- Always `npx expo install` — never `npm install` for runtime packages.
- Run `npx expo-doctor` before committing dependency changes.
- Pin exact versions for native dependencies.
- Always ask the user before framework/library upgrades with a changelog summary.

### 🏗️ [Architecture & Code Organization](file:///d:/Projects/SplitIt-Mobile/.agents/rules/architecture.md)
- Route files in `app/` are screens only — no business logic.
- Services in `src/services/`, hooks in `src/hooks/`, constants in `src/constants/`.
- Components organized by domain in `src/components/<domain>/`.
- `@/*` path aliases — no deep relative imports.
- `strict: true` in `tsconfig.json` — no `any`, no `@ts-ignore`.

### ♿ [Accessibility](file:///d:/Projects/SplitIt-Mobile/.agents/rules/accessibility.md)
- All touchables have `accessibilityLabel`, `accessibilityRole`, `accessibilityHint`.
- Minimum 44x44 touch targets.
- Support dynamic font scaling (no `allowFontScaling={false}` on body text).
- WCAG AA contrast ratios.
- Respect "Reduce Motion" setting.

### 📐 [Responsive Design](file:///d:/Projects/SplitIt-Mobile/.agents/rules/responsive.md)
- `SafeAreaView` / `useSafeAreaInsets` on every screen.
- Flex-based layouts, no hardcoded heights for content areas.
- Content constrained with `maxWidth` on large screens.
- Portrait-only orientation lock.

### 🔄 [State Management](file:///d:/Projects/SplitIt-Mobile/.agents/rules/state-management.md)
- Service layer + in-memory cache as primary data pattern.
- No prop drilling beyond 2 levels — use Context.
- Context values must be memoized.
- Optimistic updates for instant-feel mutations.
- Every screen tracks `loading`, `error`, and `data` states.

---

## Quick Reference: Pre-Commit Checklist

```bash
# Run ALL of these before every commit:
npx tsc --noEmit              # ✅ Zero type errors
npx expo lint                 # ✅ Zero lint errors
npx jest --passWithNoTests    # ✅ All tests pass
npx expo-doctor               # ✅ No SDK incompatibilities (when deps changed)
```

If any gate fails → fix it → then commit.
