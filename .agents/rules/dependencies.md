# 📦 Dependency & SDK Hygiene Rules

## Core Principle

Expo SDK compatibility is **fragile**. One wrong package version can crash the build, break native modules, or cause runtime errors on specific devices. Every dependency decision must be deliberate.

---

## Installation

### Always Use `npx expo install`

```bash
# ✅ Correct — resolves SDK-compatible version
npx expo install <package>

# ❌ NEVER use these — they ignore SDK compatibility
npm install <package>
yarn add <package>
pnpm add <package>
bun add <package>
```

The only exception: dev-only packages that don't touch native modules (e.g., `@types/*`, prettier plugins). These can use `npm install --save-dev`.

---

## Pre-Commit Hygiene

Before every commit involving dependency changes:

```bash
npx expo-doctor              # Diagnose SDK incompatibilities
npx expo install --fix        # Auto-fix version mismatches
npx tsc --noEmit              # Ensure types are clean
```

If `expo-doctor` reports issues, fix them before committing.

---

## Version Pinning

- **Pin exact versions** in `package.json` for critical native dependencies (react-native, expo-*, react-native-reanimated, react-native-screens).
- Use tilde (`~`) ranges for Expo SDK packages (e.g., `"expo": "~57.0.26"`) — Expo manages minor/patch versions within SDK releases.
- Use caret (`^`) ranges only for pure JavaScript libraries with no native code.
- **Lock files**: `package-lock.json` must always be committed. Never `.gitignore` it.

---

## Adding New Dependencies

Before adding any new package:

1. **Check if Expo has a built-in equivalent**: `expo-*` packages are always preferred over third-party alternatives.
2. **Check SDK compatibility**: Visit `https://docs.expo.dev/versions/v<SDK_VERSION>.0.0/` and search for the package.
3. **Check maintenance status**: No packages with 0 updates in the last 12 months, or with open critical CVEs.
4. **Check bundle size impact**: Use `bundlephobia.com` or equivalent to verify the package isn't bloated.
5. **Check native module requirements**: If the package has native code, it requires a development build — document this.

### Decision Tree

```
Need a capability?
  └─ Does Expo have a built-in module? → Use it
  └─ Does React Native ship it? → Use it
  └─ Is there a community package with >10k weekly downloads? → Evaluate
  └─ Otherwise → Build it yourself or ask the team
```

---

## Updating Dependencies

### SDK Upgrades

Expo SDK upgrades are **major events**. Never upgrade casually.

1. Read the full migration guide: `https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/`
2. Run `npx expo install --fix` after upgrading.
3. Run `npx expo-doctor` to catch incompatibilities.
4. Test on both iOS and Android before committing.
5. Commit the upgrade as a standalone commit: `📦 upgrade expo sdk to <version>`.

### Routine Updates

- Run `npx expo install --fix` weekly to catch drift.
- Never batch dependency updates with feature work — keep them in separate commits.
- After any update, run the full test suite and verify the app launches on both platforms.

---

## Forbidden Packages

Never install these — they conflict with Expo or have superior alternatives:

| Forbidden | Use Instead |
|-----------|-------------|
| `react-native-cli` | Expo CLI (`npx expo`) |
| `react-native-vector-icons` | `lucide-react-native` (already in use) or `@expo/vector-icons` |
| `react-navigation` (standalone) | `expo-router` (already in use) |
| `react-native-fast-image` | `expo-image` |
| `react-native-firebase` | `expo-notifications`, Expo push notifications |
| `react-native-push-notification` | `expo-notifications` |
| `moment` | `date-fns` or native `Intl.DateTimeFormat` |
| `lodash` (full) | Individual `lodash/*` imports or native JS equivalents |

---

## Native Module Safety

- If a package requires native code and `ios/` / `android/` directories don't exist (Continuous Native Generation), the package **must** have an Expo config plugin or be compatible with `npx expo prebuild`.
- After adding a native module, test with a development build — it will NOT work in Expo Go.
- Document native module additions in `todo.md` with the rationale and development build requirement.

---

## Always Use Latest Tech — With Caution

- Stay on the **latest stable** Expo SDK within 2 weeks of release (after reading migration notes).
- Adopt React Native New Architecture features as they stabilize.
- Use modern JavaScript/TypeScript features (optional chaining, nullish coalescing, `satisfies`, `using`).
- **But always ask the user before making framework/library upgrades** that could have breaking changes. Provide:
  - What changed in the new version.
  - What breaking changes exist.
  - What needs to be migrated.
  - Estimated effort.
