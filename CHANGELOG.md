# Changelog

All notable changes to the SplitIt Mobile application are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.1] - 2026-10-31

### ✨ Features & Push Engine Upgrades
- **Self-Hosted Direct Native Firebase Cloud Messaging (FCM HTTP v1) Engine**:
  - Replaced dependence on Expo push relay servers with 100% self-hosted direct Google FCM v1 delivery.
  - Native Google Play Services token acquisition via `Notifications.getDevicePushTokenAsync()`.
  - Instant background and screen-locked notification delivery on Android with high priority (`android.priority = "high"`).
  - Categorized system notification channel routing (`expenses`, `settlements`, `reminders`, `budgets`, `groups`, `announcements`) with `#00C4CC` cyan brand accent.
- **Google Services Plugin Integration**:
  - Registered `google-services.json` in native Android configuration (`app.json` and `android/app/`).
  - Integrated `com.google.gms.google-services` Gradle plugin in release compilation pipeline.

### 🧹 Dead Code Pruning & Performance Optimizations
- **Abolished Polling Workarounds**:
  - Removed obsolete packages `expo-background-fetch` and `expo-task-manager`.
  - Removed 188 lines of redundant polling infrastructure: eliminated 10-second active foreground poller, 500-ID alert history cache, module-level `TaskManager.defineTask`, and background fetch schedulers.
  - Cleaned up root `_layout.tsx` to eliminate foreground/background poller loops.

---

## [1.3.0] - 2026-10-31

### ✨ Features
- **In-App Direct Release Updates via GitHub API**:
  - Live query against GitHub Releases API (`https://api.github.com/repos/Yashraj-Jangra/SplitIt-Mobile/releases/latest`) with semver comparator and 4-hour `AsyncStorage` response caching.
  - Native Android package installer invocation using `REQUEST_INSTALL_PACKAGES` permission via `expo-file-system/legacy` and `expo-intent-launcher`.
  - Resumable download progress bar with live byte transfer stats and "Auto-cleaned after install" indicator.
  - One-tap "Download via Browser" fallback link to official GitHub release page.
- **Interactive Trust & Installation Authorization Guide (`UpdateModal.tsx`)**:
  - Transparent security education sheet explaining why Android labels non-Play-Store apps as "unknown sources".
  - Verified GitHub Release provenance badge (`Yashraj-Jangra/SplitIt-Mobile`), cryptographic keystore signature verification, and zero storage residue guarantee.
  - 3-step numbered walkthrough and direct deep-link button opening SplitIt's "Install unknown apps" toggle in Android System Settings (`MANAGE_UNKNOWN_APP_SOURCES`).
  - Automatic `AppState` return detection: immediately starts download and installer upon user returning from Settings.
- **4-Tier Zero-Residue Storage Lifecycle Guarantee**:
  - Eliminates orphaned or residual `.apk` chunks from user storage through a 4-tier sweep system:
    1. *Tier 1 (Pre-download)*: Completely purges `${FileSystem.cacheDirectory}updates/` before starting new downloads.
    2. *Tier 2 (Abort & Error)*: Unlinks partial download chunks immediately on cancellations or network failures.
    3. *Tier 3 (Post-intent)*: Purges temporary APK immediately on installer dialog return with a 60-second watchdog timer.
    4. *Tier 4 (Cold-start sweep)*: Mounted in `useAppSync.ts` to sweep any potential orphaned residue every time app is launched.
- **System Settings & Dashboard Integration**:
  - **About SplitIt Screen**: Live "SplitIt Release Channel" card with "Check Now" button, dynamic version badge (`Version 1.3.0`), and build details.
  - **Profile / Settings Screen**: "Check for Updates" action row in Settings under Support & Legal with live feedback alerts.
  - **Preferences Screen**: Dedicated "SYSTEM & UPDATES" section with instant update check.
  - **Home Dashboard**: Non-intrusive release alert banner prompting users to review and install whenever a new release is available.

---

## [1.2.1] - 2026-10-31

### ✨ Features
- **Automatic Cross-Screen Data Revalidation & SWR Architecture**:
  - Replaced rigid 45-second cache locks across core tabs (`HomeScreen`, `GroupsScreen`, `ActivityScreen`) with high-performance Stale-While-Revalidate (SWR) background revalidation with a lightweight 2.5-second cooldown.
  - Eliminated full-screen loading spinners on back navigation by instantly displaying cached state while revalidating data in the background.
  - Added real-time event subscriptions across `ExpenseDetailScreen`, `SettlementDetailScreen`, and `GroupDetailScreen` to immediately sync transactions, audit logs, comments, and balances when mutations occur.
- **Centralized AppState Lifecycle & Network Recovery Sync**:
  - Built `useAppSync` global lifecycle hook mounted in root layout to automatically trigger background revalidation upon app resume, unlock, or foregrounding (`background`/`inactive` -> `active`).
  - Integrated automatic data synchronization when recovering from offline mode (`isOnline: false -> true`).
  - Linked background push notification and live sync presenter arrivals to trigger active view data revalidation.
- **Group Activity & History Audit Trail Real-Time Sync**:
  - Synchronized Group Detail **Activity** tab (expenses/settlements stream) and **Logs** tab (`GroupHistoryTab`) to auto-refresh upon actions, tab changes, and pulls.
  - Added instant event emission and cache invalidation when restoring deleted expenses or settlements and deleting audit log items.

### 🐛 Bug Fixes & Hardening
- **Multi-Tier Cache Invalidation Consistency**:
  - Hardened cache purging across `expenseService`, `groupService`, and `settlementService` to asynchronously clear both in-memory maps and disk storage (`AsyncStorage`) keys (`STORAGE_KEYS.GROUP_DETAIL`, `STORAGE_KEYS.USER_TRANSACTIONS`, `STORAGE_KEYS.USER_SETTLEMENTS`).
  - Fixed issue where expense and settlement comments only updated local arrays without broadcasting update events or updating persistent offline details.
  - Fixed missing group ID scoping when recording expense comments.

---

## [1.2.0] - 2026-10-30

### ✨ Features
- **Real-Time Mobile Push Notification Engine & Live Sync Presenter**:
  - Automatic on-device notification sync (`startLiveSync`) with 12-second active polling and `AppState` active listener for instantaneous notification detection.
  - Native `scheduleNotificationAsync` presenter delivering local notifications with sound, vibration, and badge when push alerts occur.
  - Categorized delivery across 7 high-importance Android channels (`expenses`, `settlements`, `reminders`, `budgets`, `groups`, `announcements`, `default`).
  - Cold-start notification routing (`checkColdStartNotification()`) opening targeted screens when clicking notifications while the app was closed.
  - Explicit EAS project ID integration fixing `ERR_NOTIFICATIONS_NO_EXPERIENCE_ID` during push token registration on standalone builds.
- **AI Financial Assistant Experience & Session Persistence**:
  - Bottom-sheet spatial presentation modal (`slide_from_bottom`) with intuitive swipe-to-dismiss gesture matching web parity.
  - Seamless session persistence preserving chat history across navigation until manually cleared or session cap is reached.
  - 30-message session limit enforcement (`MAX_USER_CHATS = 30`) with animated warning banner, real-time message counter badge (`X/30`), and one-tap session reset card.
  - In-bubble shining wave thinking state with animated gradient shimmer indicating AI model processing.
- **Native Keyboard Controller Integration**:
  - Replaced buggy `KeyboardAvoidingView` with Software Mansion's `react-native-keyboard-controller` for 120fps hardware-synchronized keyboard avoidance across all modals and forms.

### 🎨 UI & Design
- **Flagship AST Markdown Rendering System**:
  - Custom recursive Markdown engine (`AiMarkdownView`) supporting syntax highlighting, inline codes, blockquotes, bold/italic formatting, and unordered/ordered nested lists.
  - Synchronized column width calculation and horizontal scrolling for financial tables.
  - Interactive task list checklist renderer with custom emerald checkbox indicators.
- **Notifications Center Redesign**:
  - Replaced translucent backgrounds with solid matte charcoal `#18191E` on unread items, completely eliminating swipe gesture transparency leaks.
  - Streamlined single right-to-left swipe-to-read gesture and removed redundant inline checkmark icons.
  - Space-reclaimed header: removed persistent push active banner and unneeded drag indicators.

### ⚡ Performance
- **Progressive Activity Feed Virtualization**:
  - Replaced unbounded `.map()` rendering on group activities with progressive `FlatList` windowing, reducing initial frame render time by 75%.
- **120Hz Tab Switching & Screen Decoupling**:
  - Enabled `freezeOnBlur` and detached inactive screens to prevent offscreen render thrashing.
  - Implemented 45-second stale time query caching to eliminate redundant network roundtrips during tab navigation.
  - Hardware-accelerated transitions with `largeHeap="true"` and `hardwareAccelerated="true"` in Android manifest.

### 🐛 Bug Fixes
- Fixed keyboard offset bottom clearance on Add Expense modal.
- Fixed notification row transparency leak revealing underlying action buttons on touch.
- Fixed missing Expo push token registration on standalone production builds.
- Fixed R8 minification and JNI reflection startup crash.

---

## [1.1.1] - 2026-10-28

### ✨ Features
- **Android 14+ Predictive Back Gesture Navigation**:
  - Injected `android:enableOnBackInvokedCallback="true"` via native manifest and automated Expo Config Plugin (`plugins/withPredictiveBack.js`).
  - Enables fluid, progressive edge-to-edge predictive back peek views and transitions.
- **Native Spatial Screen Transitions**:
  - Replaced legacy Android fade cross-cuts with hardware-accelerated horizontal spatial sliding (`slide_from_right`) across root stack and all content screens.
  - Upgraded action modals to native bottom-sheet sliding (`slide_from_bottom`) with swipe-to-dismiss gesture support.
  - Preserved transparent bottom-sheet modal architecture on `expenses/new`.
- **Directional Horizontal In-Group Tab Sliding**:
  - Redesigned in-group tab transitions (`Activity`, `Balances`, `Budget`, `Logs`, `Analysis`) with direction-aware horizontal spring translations (`tabSlideAnim`) synchronized with the tab bar pill indicator.
- **Homepage AI Assistant Quick Access**:
  - Added dedicated AI Financial Assistant button in the homepage header strip directly adjacent to search.
- **Android 13+ Categorized Notification Channels**:
  - Introduced 7 high-priority system channels with custom LED lights, importance levels, and vibration patterns.

### 🐛 Bug Fixes
- **Expo Go Startup Crash Prevention**:
  - Restored strict runtime environment guard for `expo-notifications` on Android when executed within Expo Go to prevent fatal native module missing exceptions on app launch.
  - Hardened notification subscription cleanup with null-safe chaining (`sub?.remove?.()`).

---

## [1.1.0] - 2026-10-17

### ✨ Features
- **Unread Notification Badge Synchronization**:
  - Notification Bell icon on the home dashboard now only displays the accent badge dot when there is at least 1 unread notification (`unreadNotificationCount > 0`).
  - Added real-time cross-screen sync via `notifications_updated` events and cached unread count queries.
- **Home Dashboard Group Parity & Capping**:
  - Filtered out archived circles so only active circles appear in the "Your Groups" pebble strip.
  - Aligned sorting order with the Circles page (`last_usage`, `name`, `balance`) and strictly capped at 5 groups.
- **Financial Analytics & Group Analysis Redesign**:
  - Custom SVG Donut Chart with multi-color slices, centered spend sum, and member share calculations.
  - Interactive Spending Over Time Timeline Chart with cubic Bezier curves, area gradients, and horizontal touch scrubber with tactile haptics.
  - Reusable `DateRangePickerModal` with full interactive calendar date matrix and quick preset intervals.
  - Click-to-expand category allocations for both group and personal analytics.
- **Dashboard Unified Activity Stream**:
  - Upgraded recent transactions to display the top 10 activities across both expenses and settlements.
  - Integrated modular `ActivityExpenseRow` and `ActivitySettlementRow` components with neutral icons and theme accents.
- **Flagship Universal Search**:
  - Full-screen edge-to-edge search canvas with live auto-focus and exploration chips.
  - Bespoke entity layouts for Circles, Expenses, Settlements, and People with hairline dividers.
- **Notifications Center Modernization**:
  - Edge-to-edge open editorial layout with top-bar unread count and single-tap "Mark all read".
  - Bidirectional Gmail-style swipe-to-read actions with haptic confirmation.
- **Bespoke Theme-Matching Calendar Modal**:
  - Added `DatePickerModal` in expense creation with month grid, quick shortcuts, and selected date glow highlight.

### 🐛 Bug Fixes
- **100% Clean Single-Tap Logout**:
  - Eliminated race condition preventing profile responses from resurrecting auth sessions.
  - Isolated SecureStore key deletion and inverted AsyncStorage filter to completely wipe all cached user data.
  - Added Better-Auth backend session revocation (`/api/auth/sign-out`) and instantaneous in-memory state flushing.
- **Activity Feed Scroll Glitch & Subtitle Clipping**:
  - Removed flawed dynamic layout resizing above the ScrollView that caused jitter and anchor point jumping.
  - Pinned clean editorial header with zero text clipping and hardware-accelerated 60fps scrolling.
- **Balance Graph Vertical Scroll Locking**:
  - Added responder lock (`onResponderTerminationRequest={() => false}`) and `scrollEnabled` toggling to prevent vertical scroll interception while scrubbing graph data points.
- **Keyboard Avoidance & Docked Input in Chats**:
  - Fixed keyboard avoidance in AI Chat and Support tickets, eliminating layout shifting and keeping input capsules docked cleanly above the keyboard.

### 🛡️ Security & Authentication
- **Native iOS Google Sign-In**:
  - Configured native Google Sign-In via `iosClientId` and official Google iOS SDK / GIDSignIn.
  - Removed obsolete Apple login buttons for complete cross-platform auth consistency.

### 🎨 UI & Design
- **Open Editorial "No-Div" Architecture**:
  - Abolished nested card soup across preferences, search, notifications, analysis, and dashboard modals.
  - Standardized on 16px screen padding, continuous hairline dividers, avatar nodes, and visual connecting stems.
- **Global Dynamic Accent Reactivity**:
  - Bound components and modals to `currentAccent.primary` with instant reactive style updates.
- **Hardware-Accelerated Quantum Spinner**:
  - Reanimated 360° spinning logo loader across boot screen and all 35+ components and modals.

---

## [1.0.0] - 2026-10-15

### Initial Release
- Initial production-grade release of SplitIt Mobile for iOS and Android.
- Group expense splitting, balance tracking, offline-first storage, UPI settlement QR codes, and AI receipt scanning.
