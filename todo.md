# SplitIt-Mobile Tracking Tracker (`todo.md`)

## Recent Work Done
- **Prevent Undefined Participant Owes & Add Loading Split State**:
  - Gated split breakdown rendering with `areParticipantsValid`, preventing premature display of unpopulated participant debt rows.
  - Replaced notice text with clear "Loading split..." indicator alongside animated skeleton breakdown.
  - Guarded participant name resolution via `resolveParticipantName` and `formatParticipantOwedText`, ensuring `'undefined owes ₹...'` can never be generated even with missing/corrupted data.
  - Added dedicated error state view with retry and navigation fallback if expense fails to load.
  - Added 18 unit tests in `src/__tests__/split-utils.test.ts` covering split validation, name resolution, and text formatting.
- **Default Category Set to Other/Uncategorized**:
  - Replaced hardcoded `'Dining Out'` / `'Food and Drink'` initial state in `app/expenses/new.tsx` with `'Other'` / `'Uncategorized'`, matching the web application default.
  - Normalized `'Others'` alias to `'Other'` across `@splitit/core` and web/mobile helper functions.
  - Added keywords (`'other'`, `'others'`, `'misc'`, `'miscellaneous'`, `'general'`) to `'Other'` category so search and description classification seamlessly match.
  - Reset category back to default when description input is completely cleared and not overridden by user.
- **Fixed Back Navigation Previous Screen Blanking (Commit `ed2555a`)**:
  - **Native Window Background**: Configured `"backgroundColor": "#09090B"` in `app.json` (both `expo` root and `expo.android`) so native Android Activity canvas never defaults to white during Fragment reattachment.
  - **Global Freeze Disarmed**: Invoked `enableFreeze(false)` at module scope in `app/_layout.tsx` to prevent `react-freeze` / `DelayedFreeze` from wrapping background screens in suspended `null` fallbacks.
  - **Detached Inactive Tabs Prevented**: Added `detachInactiveScreens={false}` to `<Tabs>` in `app/(tabs)/_layout.tsx`, keeping all bottom-tab scenes permanently attached and measured in the native view hierarchy.
  - **Synchronous In-Memory Hydration**:
    - `app/(tabs)/index.tsx`: Initialized `groups`, `recentTransactions`, `balanceSummary`, and `currentUser` from synchronous in-memory services with `loading` set to false when memory cache is present. Skeletons never re-render during back transitions.
    - `src/services/balance.service.ts`: Added `_cachedBalanceSummary` and `getInMemoryUserBalanceSummary()`.
    - `src/services/auth.service.ts`: Added `_cachedUser` and `getInMemoryUser()`.
    - `src/services/notification.service.ts`: Added `_cachedNotifications` and `getInMemoryNotifications()`.
    - `src/services/support.service.ts`: Added `_cachedTickets` and `getInMemoryTickets()`.
  - **Stack Animation**: Standardized `animation: 'slide_from_right'` with `freezeOnBlur: false` in `app/_layout.tsx`.
- **Add Expense FAB App Morph Animation (Commit `350990a`)**:
  - Implemented smooth circular-reveal / sheet-morph animation expanding directly from the group FAB into the add expense screen.

## Next Steps & Planned Work
- [ ] Test transition smoothness across high-refresh-rate physical Android & iOS devices.
- [ ] Evaluate offline mutations queue sync resilience on intermittent network reconnections.
- [ ] Verify receipt scanner camera permission handling in development builds.
