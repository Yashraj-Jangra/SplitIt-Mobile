# 🔄 State Management Rules

## Core Principle

State management in a React Native app can make or break performance and developer experience. Use the simplest pattern that works. Don't over-engineer, but don't prop-drill through 5 levels either.

---

## State Hierarchy

Use the right tool for the right scope:

| Scope | Tool | Example |
|-------|------|---------|
| Component-local | `useState`, `useReducer` | Form inputs, toggle states, modal open/close |
| Screen-scoped shared | Props (1-2 levels max) | Passing data from screen to its direct child components |
| Feature-scoped shared | React Context | Auth state, active group context, theme context |
| Global app state | React Context (or Zustand if complexity grows) | User session, offline queue, notification count |
| Server/async data | Service layer + in-memory cache | Expenses, groups, balances (current pattern) |

---

## Current Pattern: Service Layer + In-Memory Cache

The app uses a service-based data layer with in-memory caching:

```
Screen → calls service function → service fetches from API / returns cache → screen sets state
```

### Rules

- Services own the cache (`_cachedGroups`, `_cachedUser`, etc.) and expose `getInMemory*()` functions for synchronous reads.
- Screens initialize from in-memory cache (zero-latency hydration), then fetch fresh data in the background.
- Cache invalidation happens on mutation (create/update/delete) — the service clears or updates its cache after a successful API call.

---

## No Prop Drilling Beyond 2 Levels

If a piece of state needs to travel through more than 2 component levels, **extract it into a Context**.

```typescript
// ❌ Prop drilling hell
<Screen user={user}>
  <Container user={user}>
    <Card user={user}>
      <Avatar user={user} />  // 3 levels deep — forbidden
    </Card>
  </Container>
</Screen>

// ✅ Context
const UserContext = createContext<User | null>(null);
export const useUser = () => useContext(UserContext);

// In Avatar:
const user = useUser();
```

---

## Context Provider Rules

- Context providers live in `src/contexts/`.
- Each context must have a custom hook for consumption (e.g., `useAuth()`, `useGroup()`).
- Context values must be memoized to prevent unnecessary re-renders:
  ```typescript
  const value = useMemo(() => ({ user, isAuthenticated, signOut }), [user, isAuthenticated]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
  ```
- Split contexts by concern — never put unrelated state in the same context.

---

## Optimistic Updates

For mutations that affect the UI immediately (mark as read, toggle checkbox, delete expense):

1. **Update local state immediately** (optimistic).
2. **Send API request in background**.
3. **On failure**: Revert local state and show error toast.
4. **On success**: Optionally refresh from server to reconcile.

```typescript
const handleMarkAsRead = async (id: string) => {
  // Optimistic: update UI immediately
  setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));

  try {
    await notificationService.markAsRead(id);
  } catch {
    // Revert on failure
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: false } : n));
    showToast('Failed to mark as read');
  }
};
```

---

## Async State Pattern

Every screen that fetches data must track three states:

```typescript
const [data, setData] = useState<T | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
```

And render accordingly:
- `loading && !data` → Skeleton
- `error && !data` → Error state with retry
- `data` → Real content
- `loading && data` → Real content with subtle refresh indicator (pull-to-refresh spinner)

---

## Future Consideration: Zustand

If the app's global state grows beyond what Context handles cleanly (e.g., offline mutation queue, multi-step wizard state, real-time sync), consider migrating to Zustand:

- Lightweight (< 1KB), no boilerplate.
- Supports selectors for granular re-renders.
- Compatible with React Native and Reanimated.
- Does not require wrapping the app in providers.

This migration should be a deliberate decision, not a premature optimization. The current service + context pattern works for the current scale.
