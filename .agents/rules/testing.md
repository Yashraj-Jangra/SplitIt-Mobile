# 🧪 Testing Rules — Tests Are The Gate

## Core Philosophy

**No code ships without passing tests.** Tests are not optional documentation — they are the quality gate that prevents regressions, catches edge cases, and proves correctness. Every commit must pass the full test suite.

---

## Pre-Commit Gate (Mandatory)

Before every commit, the following must pass with **zero errors**:

```bash
npx tsc --noEmit            # TypeScript type check — zero errors
npx expo lint               # Lint check — zero errors, zero warnings
npx jest --passWithNoTests  # Test suite — all tests pass
```

If any of these fail, **do not commit**. Fix the issue first.

---

## Test Infrastructure

### Stack

- **Test Runner**: Jest (via `jest-expo` preset for Expo compatibility)
- **Component Testing**: `@testing-library/react-native`
- **Mocking**: Jest built-in mocks + `jest.mock()` for services and native modules

### Directory Structure

```
src/
  __tests__/              # Unit tests for services, utils, hooks
    split-utils.test.ts
    balance.service.test.ts
    ...
  components/
    __tests__/            # Component-level tests co-located with components
      SplitOptionsModal.test.tsx
      ...
```

### Naming Convention

- Test files: `*.test.ts` or `*.test.tsx`
- Test descriptions: `describe('<ModuleName>', () => { it('should <expected behavior>', ...) })`
- Use concrete, readable assertions — not `toBeTruthy()` when `toBe(42)` is possible.

---

## What Must Be Tested

### Tier 1: Mandatory (Block commit if missing)

| Layer | What to test | Example |
|-------|-------------|---------|
| **Services** | All public methods, error paths, edge cases | `expense.service.ts` — creating, updating, deleting expenses |
| **Utilities** | Pure functions, formatters, parsers | `category-icons.tsx` — icon resolution, `upi.ts` — URI generation |
| **Business Logic** | Split calculations, balance resolution, settlement | Split amounts, percentage rounding, share distribution |
| **Data Transformations** | API response mapping, normalization | Notification payload normalization, history event parsing |

### Tier 2: Strongly Recommended

| Layer | What to test | Example |
|-------|-------------|---------|
| **Hooks** | Custom hooks with `renderHook` | `useOfflineQueue`, `useGroupDetails` |
| **Key Components** | Render tests, user interaction | `SplitOptionsModal` — tab switching, input validation |
| **Error Boundaries** | Fallback rendering on throw | Root error boundary catches and renders fallback UI |

### Tier 3: Nice to Have

| Layer | What to test |
|-------|-------------|
| **Screens** | Smoke tests — screen renders without crash |
| **Navigation** | Deep link resolution, back navigation |
| **Integration** | Full flows (add expense → verify in group) — use Detox or Maestro |

---

## Test Quality Standards

### Do

- Test **behavior**, not implementation. Assert what the user sees, not internal state.
- Test **edge cases**: empty arrays, null values, zero amounts, very large numbers, special characters in names.
- Test **error paths**: network failures, malformed API responses, expired tokens.
- Use `beforeEach` / `afterEach` for clean state isolation.
- Mock external dependencies (API calls, AsyncStorage, native modules) — never hit real endpoints in unit tests.

### Don't

- Don't test React Native internals or third-party library behavior.
- Don't write tests that pass by coincidence (e.g., `expect(result).toBeTruthy()` when `result` could be `[]`).
- Don't skip tests with `xit` or `test.skip` — fix or delete them.
- Don't test private functions directly — test through the public API.

---

## Coverage Expectations

- **Services and utilities**: ≥ 80% line coverage
- **Business logic (splits, balances, settlements)**: ≥ 90% line coverage
- **Components**: ≥ 60% line coverage (focus on critical user paths)
- **Overall project**: ≥ 70% line coverage target

Run coverage with:
```bash
npx jest --coverage
```

---

## Continuous Integration (Future)

When CI is set up:
1. All three gates (`tsc`, `lint`, `jest`) run on every PR.
2. Coverage report is posted as a PR comment.
3. PRs with coverage regression > 2% are flagged for review.
4. E2E tests (Detox/Maestro) run on a nightly schedule against development builds.
