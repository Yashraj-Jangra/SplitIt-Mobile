# 🛡️ Crash Prevention & Defensive Coding Rules

## Core Principle

**The app must never crash in a user's hands.** Every possible failure mode — network errors, malformed data, missing permissions, corrupted cache — must be anticipated and handled gracefully. A user should see a helpful message, never a white screen or a force-close dialog.

---

## Error Boundaries

### Root Error Boundary

- The app must have an `ErrorBoundary` component wrapping the root `<Stack>` navigator in `app/_layout.tsx`.
- On catch, it renders a full-screen fallback with:
  - A clear error message (not the raw stack trace).
  - A "Restart" button that resets navigation state.
  - A "Report" button that sends crash data to the support channel.

### Screen-Level Error Boundaries

- Every screen that fetches data or performs complex operations should have its own error boundary.
- Screen-level fallback shows:
  - "Something went wrong" message.
  - A "Retry" button that re-mounts the screen.
  - A "Go Back" button that navigates to the previous screen.

---

## Async Error Handling

### Every `async` call must be wrapped in try/catch

```typescript
// ✅ Correct
const loadExpenses = async () => {
  try {
    setLoading(true);
    const data = await expenseService.getExpenses(groupId);
    setExpenses(data);
  } catch (error) {
    setError('Failed to load expenses. Please try again.');
    // Log to error reporting service
  } finally {
    setLoading(false);
  }
};

// ❌ Forbidden — unhandled promise rejection = potential crash
const loadExpenses = async () => {
  const data = await expenseService.getExpenses(groupId);
  setExpenses(data);
};
```

### No Unhandled Promise Rejections

- Never have a floating `async` call without `.catch()` or try/catch.
- Set up a global `Promise.rejection` handler in `app/_layout.tsx` as a safety net (but never rely on it).

---

## Null Safety

### Optional Chaining Everywhere

- Never access nested properties without optional chaining (`?.`).
- Never assume API responses have all fields populated.

```typescript
// ❌ Crash if expense.payer is undefined
const payerName = expense.payer.name;

// ✅ Safe
const payerName = expense?.payer?.name ?? 'Unknown';
```

### Default Values

- All array operations must guard against `undefined`/`null`:
  ```typescript
  const members = group?.members ?? [];
  const total = expenses?.reduce((sum, e) => sum + (e?.amount ?? 0), 0) ?? 0;
  ```

### Type Narrowing

- Use TypeScript discriminated unions and type guards — not type assertions (`as`).
- Never use `!` (non-null assertion) unless the value is provably non-null by construction and commented with reasoning.

---

## Offline Resilience

### Graceful Degradation

- The app must remain usable when offline.
- Show cached data when available, with a subtle "Offline" banner (`OfflineBanner.tsx`).
- Queue mutations (create expense, settle up) for retry when connectivity returns.
- Never show a blank screen or "No internet" error wall when cached data exists.

### Network Error Classification

Classify network errors and respond appropriately:

| Error Type | Response |
|-----------|----------|
| No connectivity | Show cached data + offline banner |
| 401 Unauthorized | Redirect to login, clear tokens |
| 403 Forbidden | Show "Access denied" message |
| 404 Not Found | Show "Not found" with back navigation |
| 429 Rate Limited | Retry with exponential backoff |
| 500+ Server Error | Show "Server error, try again later" |
| Timeout | Retry once, then show error with retry button |

---

## Data Validation

### API Response Validation

- Never trust API responses blindly. Validate critical fields before using them.
- Default missing fields to safe values:
  ```typescript
  const expense = {
    ...rawResponse,
    amount: rawResponse?.amount ?? 0,
    description: rawResponse?.description ?? 'Untitled expense',
    participants: rawResponse?.participants ?? [],
    createdAt: rawResponse?.createdAt ?? new Date().toISOString(),
  };
  ```

### User Input Validation

- Validate all user inputs before submission (amount > 0, description not empty, at least one participant).
- Show inline validation errors, not alert dialogs.
- Never send unvalidated data to the API.

---

## Navigation Safety

- Always check if a route parameter exists before using it:
  ```typescript
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) {
    router.back();
    return null;
  }
  ```
- Deep links must validate that the target entity exists before navigating to its screen.
- Implement a 404/not-found fallback screen.

---

## Crash Reporting (Future)

When implementing crash reporting:
1. Use Sentry or Bugsnag via their Expo plugins.
2. Capture breadcrumbs for navigation events, API calls, and user actions.
3. Attach user ID (anonymized) and app version to every report.
4. Set up alerting for crash-free rate dropping below 99.5%.
