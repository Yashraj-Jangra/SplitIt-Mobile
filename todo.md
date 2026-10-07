# SplitIt-Mobile Tracking Tracker (`todo.md`)

## Recent Work Done
- **Group Activity & Expense History Minimal Sleek Redesign Matching Website**:
  - **Group Activity Tab Redesign (`src/components/groups/GroupHistoryTab.tsx` & `app/groups/[id]/index.tsx`)**:
    - Replaced heavy boxed card layout with minimal hairline-divided list rows (`borderBottomWidth: StyleSheet.hairlineWidth`) matching the website.
    - Implemented exact icon and color scheme: Emerald for additions/creations (`#10B981`, `Plus`, `Handshake`, `UserPlus`), Blue for updates (`#3B82F6`, `Pencil`), Red for deletions (`#EF4444`, `Trash2`, `UserMinus`), Purple for restorations (`#A855F7`, `RotateCcw`), and Electric Purple for SplitIt AI (`Bot`).
    - Added deleted expense tracking with strikethrough text formatting on descriptions and `(for MMM d)` date annotation.
    - Added "Take there" view button (`ArrowRight`) navigating directly to `/expenses/[id]`.
    - Added Restore button (`RotateCcw`) calling backend restore endpoint with optimistic offline fallback, haptics, and automatic refresh.
    - Added Admin-only Delete button strictly visible to `role === 'admin'`; completely hidden and guarded against non-admin execution.
    - Added expandable accordion for granular field changes with complex split/payer parsing via `@splitit/core`'s `parseComplexChange`.
  - **Expense Info History Section Redesign (`app/expenses/[id].tsx`)**:
    - Removed bulky div/card styling (`logCard`), replacing with clean hairline divider rows (`borderBottomWidth: StyleSheet.hairlineWidth`, `borderBottomColor: 'rgba(255, 255, 255, 0.08)'`).
    - Added clean "History" section divider and header, matching website styling.
    - Aligned status badge pills, actor attribution, and granular strikethrough diffs (`#EF4444` to `#10B981`) with website color codes.
  - **Service & Backend Integration (`src/services/group.service.ts` & `src/services/auth.service.ts`)**:
    - Added `role` to `AuthUser` and mapped role across sign-in providers.
    - Added `HistoryEventItem` interface and history mapping in `getGroupDetails`.
    - Added `getGroupHistory`, `restoreExpense`, `restoreSettlement`, and `deleteHistoryEvent` methods with role checks.
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
