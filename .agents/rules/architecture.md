# 🏗️ Architecture & Code Organization Rules

## Core Principle

The codebase must be organized so that any developer (or AI agent) can find, understand, and modify code without reading the entire project. Separation of concerns is non-negotiable.

---

## Directory Structure

```
app/                          # Expo Router — ONLY route/screen files & layouts
  (auth)/                     # Auth screens (login, signup)
  (tabs)/                     # Bottom tab navigator screens
  expenses/                   # Expense-related screens
  groups/                     # Group-related screens
  ...
  _layout.tsx                 # Root navigator

src/                          # All non-route code
  components/                 # Reusable UI components
    brand/                    # Logo, branding assets
    budget/                   # Budget-specific components
    common/                   # Shared components (OfflineBanner, etc.)
    dashboard/                # Dashboard widgets
    expenses/                 # Expense-specific components
    groups/                   # Group-specific components
    skeletons/                # Loading skeleton components
  constants/                  # Static configuration & tokens
    theme.ts                  # Master theme (colors, spacing, typography, radius)
  contexts/                   # React Context providers
  hooks/                      # Custom React hooks
  services/                   # API & data access layer
  utils/                      # Pure utility functions
  types/                      # Shared TypeScript type definitions (if needed)
  __tests__/                  # Unit tests for services & utils
```

---

## The Route File Rule

**Route files in `app/` are screens, not business logic containers.**

A route file (e.g., `app/expenses/new.tsx`) should:
- Import and compose components from `src/components/`.
- Call hooks from `src/hooks/` for data and state.
- Handle navigation events (params, back, push).
- Define the screen's `StyleSheet` for layout composition.

A route file **must NOT**:
- Contain API calls directly (use services).
- Define reusable sub-components inline (extract to `src/components/`).
- Contain business logic (split calculations, balance resolution, etc.).
- Exceed ~400 lines. If it does, extract components or logic.

---

## Service Layer

### Structure

Each domain has its own service file in `src/services/`:

```
services/
  auth.service.ts           # Authentication, user session
  expense.service.ts        # CRUD for expenses
  group.service.ts          # CRUD for groups, members
  balance.service.ts        # Balance calculations, summaries
  settlement.service.ts     # Settle-up operations
  notification.service.ts   # Push/in-app notifications
  support.service.ts        # Support tickets
```

### Rules

- Services are **stateless function modules** (not classes) that export named functions.
- Services handle: API calls, response normalization, caching, error classification.
- Services must **never** import React or use hooks. They are pure TypeScript.
- Every service function must have a JSDoc comment describing what it does, its parameters, and return type.

---

## Component Organization

### Domain Grouping

Components are grouped by the domain they serve:

```
components/
  expenses/
    SplitOptionsModal.tsx     # Split options sheet
    PayerSelectModal.tsx      # Payer selection sheet
    ExpenseAbstractHeader.tsx # Generative header
    ExpenseImpactCol.tsx      # Impact column
  groups/
    GroupHistoryTab.tsx        # Activity/history tab
  common/
    OfflineBanner.tsx          # Shared offline indicator
  skeletons/
    TransactionRowSkeleton.tsx # Shimmer placeholders
```

### Rules

- Components must be **focused** — one component, one responsibility.
- Components must be **self-contained** — they import their own styles, not global style objects.
- Complex components (>200 lines) should extract sub-components into the same domain folder.
- Co-locate component tests: `components/expenses/__tests__/SplitOptionsModal.test.tsx`.

---

## Hooks

Custom hooks live in `src/hooks/` and encapsulate reusable stateful logic:

```
hooks/
  useKeyboardHeight.ts      # Track keyboard height for input docking
  useOfflineQueue.ts        # Queue mutations when offline
  useGroupDetails.ts        # Fetch & cache group data
  useDebounce.ts            # Debounced values
```

### Rules

- Hooks must start with `use` prefix.
- Hooks should return a well-typed object or tuple — not expose internal implementation details.
- Hooks should not contain UI rendering logic — that belongs in components.

---

## Constants & Configuration

All static values live in `src/constants/`:

```
constants/
  theme.ts          # Colors, spacing, typography, radius, animation
  api.ts            # API base URL, endpoints (read from env)
  app.ts            # App-wide constants (version, feature flags)
```

### Rules

- No magic numbers anywhere in the codebase (see global rule 11 in `.gemini/config`).
- API URLs must read from environment variables, never hardcoded.
- Feature flags must be centralized, not scattered across files.

---

## Imports & Path Aliases

- Use the `@/*` path alias for all imports from `src/`:
  ```typescript
  import { THEME } from '@/constants/theme';
  import { ExpenseRow } from '@/components/expenses/ExpenseRow';
  import { getExpenses } from '@/services/expense.service';
  ```
- Never use relative paths that traverse up more than one level (no `../../..`).
- Group imports in this order (with blank line separators):
  1. React / React Native
  2. Third-party libraries
  3. `@/` project imports
  4. Relative imports (same directory only)

---

## TypeScript Strictness

- `strict: true` is enabled in `tsconfig.json` — never disable it.
- No `any` types unless absolutely unavoidable (and must be commented with justification).
- No `@ts-ignore` or `@ts-expect-error` without a linked issue or TODO.
- Prefer `unknown` over `any` for untyped external data, then narrow with type guards.
- Use `satisfies` for type validation without widening:
  ```typescript
  const config = { ... } satisfies AppConfig;
  ```
