# SplitIt Mobile Releases

Official release documentation and binaries for the SplitIt Mobile app.

---

## [v1.2.1] - 2026-10-31

> **Target OS**: Android 10+ (API 29+) & iOS 15+  
> **Build Number**: `5`  
> **Package**: `com.splitit.app`

### 📦 Artifacts & Downloads

| File | Type | Size | SHA256 Checksum |
| :--- | :--- | :--- | :--- |
| **`SplitIt-v1.2.1.apk`** | Android Release APK | `129.4 MB` (`135,676,597 bytes`) | `8dbd00fcd52f1aa150472598767c026d496848cd39b030eef9cd20e2d82fabd8` |

```bash
# Verify checksum on Windows (PowerShell)
Get-FileHash -Algorithm SHA256 .\SplitIt-v1.2.1.apk

# Verify checksum on Linux / macOS
sha256sum SplitIt-v1.2.1.apk
```

---

### 🚀 Highlights & Changelog

#### 🔄 Automatic Cross-Screen Data Revalidation & SWR Architecture
- **Stale-While-Revalidate (SWR) Engine**: Replaced rigid 45-second cache locks across core tabs (`HomeScreen`, `GroupsScreen`, `ActivityScreen`) with high-performance Stale-While-Revalidate (SWR) background revalidation with a lightweight 2.5-second cooldown.
- **Zero-Flicker Screen Navigation**: Instant 0ms cached rendering on back navigation and tab switching without blank screens or full-screen skeleton spinners, seamlessly updating UI when fresh server data arrives.
- **Real-Time Cross-Screen Event Bus**: Subscribed `ExpenseDetailScreen`, `SettlementDetailScreen`, and `GroupDetailScreen` to real-time data events, immediately updating transaction breakdown trees, audit logs, and balances upon any user mutation.

#### ⚡ Centralized AppState Lifecycle & Network Recovery Sync
- **App Foreground / Unlock Revalidation (`useAppSync`)**: Automatically catches up and refreshes active view data whenever the application is resumed, brought to foreground, or unlocked from sleep (`AppState: 'active'`).
- **Offline-to-Online Recovery Catch-up**: Listens to `NetInfo` connectivity transitions and triggers silent background synchronization the moment network connectivity is restored.
- **Live Sync & Push Dispatch Reactivity**: Paired incoming push notification catches with active screen revalidation.

#### 📋 Group Activity Stream & Audit Logs Synchronization
- **Real-Time Feed & Logs Alignment**: Synchronized Group Detail **Activity** tab (expenses/settlements stream) and **Logs** tab (`GroupHistoryTab`) to auto-refresh upon actions, tab changes, and pull-to-refresh.
- **Audit Restoration & Deletion Events**: Dispatches typed events when restoring deleted expenses or settlements and deleting audit events.

#### 🛡️ Multi-Tier Cache Invalidation Consistency
- **Unified Cache Eviction**: Purges both in-memory maps and disk storage (`AsyncStorage`) keys (`STORAGE_KEYS.GROUP_DETAIL`, `STORAGE_KEYS.USER_TRANSACTIONS`, `STORAGE_KEYS.USER_SETTLEMENTS`) across `expenseService`, `groupService`, and `settlementService`.
- **Comment Persistence & Scoping**: Fixed local comment updates to persist offline details and emit cross-screen events.

---

## [v1.2.0] - 2026-10-30

> **Target OS**: Android 10+ (API 29+) & iOS 15+  
> **Build Number**: `4`  
> **Package**: `com.splitit.app`

### 📦 Artifacts & Downloads

| File | Type | Size | SHA256 Checksum |
| :--- | :--- | :--- | :--- |
| **`SplitIt-v1.2.0.apk`** | Android Release APK | `129.4 MB` (`135,671,901 bytes`) | `7cd7a6bc36c2a3fe1994afe6f2380e5c64db8279b1142d98e59f91b92fc3f0aa` |

```bash
# Verify checksum on Windows (PowerShell)
Get-FileHash -Algorithm SHA256 .\SplitIt-v1.2.0.apk

# Verify checksum on Linux / macOS
sha256sum SplitIt-v1.2.0.apk
```

---

### 🚀 Highlights & Changelog

#### 🛡️ Background Push Notification Architecture & WorkManager Integration
- **Native WorkManager Background Fetch**: Integrated `expo-background-fetch` and `expo-task-manager` (`SPLITIT_BACKGROUND_NOTIFICATION_SYNC`) configured with `stopOnTerminate: false` and `startOnBoot: true`, enabling the Android OS Job Scheduler to periodically poll for and present unread notification alerts even when the application is completely killed or after device reboots.
- **Persistent Storage Alert Deduplication**: Backed alerted notification IDs in persistent `AsyncStorage` (`@splitit:alerted_notification_ids`, rolling 500-ID window), eliminating duplicate alert sounds while ensuring notifications arriving while closed or sleeping are never swallowed or lost.
- **Multi-Trigger Instant Catch-up**: Paired background fetch with immediate `AppState: 'active'` resume listener and `NetInfo` network reconnection hooks, guaranteeing zero delay when unlocking the phone or regaining cellular/Wi-Fi coverage.
- **High-Priority Expo Dispatch & Auto-Pruning**: Configured backend Expo dispatch with `priority: 'high'` and `ttl: 86400` to penetrate Android Doze mode, paired with automatic pruning of obsolete tokens on `DeviceNotRegistered` responses.

#### ✨ Real-Time Push Notification Engine & Live Sync Presenter
- **Live On-Device Poller & Presenter**: Implemented continuous background sync (`startLiveSync`) with 12s polling and immediate `AppState` active listener for instantaneous notification detection.
- **Categorized Android Channels**: Routed system alerts across 7 high-importance Android system channels (`expenses`, `settlements`, `reminders`, `budgets`, `groups`, `announcements`, `default`) with custom vibration, sound, and notification badge dots.
- **Cold-Start Routing**: Seamlessly deep-links directly into targeted circular groups, expenses, and settlements when clicking notifications while the app was closed.
- **Standalone Expo Token Fix**: Resolved `ERR_NOTIFICATIONS_NO_EXPERIENCE_ID` by binding explicit EAS project ID and registering push tokens directly with the remote backend.

#### 🎨 Flagship AST Markdown Rendering System
- **Structured Financial Markdown**: Custom recursive AST Markdown renderer (`AiMarkdownView`) engineered for financial breakdown cards, bold highlights, blockquotes, and nested ordered/unordered lists.
- **Synchronized Column Financial Tables**: Responsive horizontally scrollable tables with dynamic column width alignment across debts and split breakdowns.
- **Interactive Checklist Blocks**: Native emerald task checklist format for group budget items and pending settlements.

#### 🤖 AI Financial Assistant Experience & Session Persistence
- **Spatial Bottom-Sheet Modal**: Upgraded animation from horizontal sliding to native vertical bottom-to-top presentation (`slide_from_bottom`) with intuitive drag-to-dismiss gesture matching web parity.
- **Cross-Navigation Session Memory**: Preserves user conversation history across screens and back-navigation until manually reset or reaching the cap.
- **30-Message Session Limit**: Enforced hard 30-message user chat limit (`MAX_USER_CHATS = 30`) with live counter pill (`X/30`), contextual limit warning card, and one-tap session reset.
- **In-Bubble Shining Thinking State**: Animated gradient wave shimmer directly inside the AI response bubble reflecting reasoning progress without layout shifts.

#### ⌨️ Native Hardware-Synchronized Keyboard Handling
- **React Native Keyboard Controller**: Integrated Software Mansion's `react-native-keyboard-controller`, completely eliminating Android keyboard flicker, modal jumps, and input obscuring at 120fps.
- **Zero Bottom Clearance Collisions**: Adjusted safe area offsets and scroll padding in `Add Expense` modal for effortless input focusing.

#### 🔔 Notifications Center Polish
- **Zero Transparency Gesture Leaks**: Replaced translucent row backgrounds with solid matte charcoal `#18191E`, preventing underlying "Mark Read" triggers from bleeding through during touch or swipe.
- **Unified Single Swipe**: Clean right-to-left swipe-to-read gesture; removed redundant inline checkmark icons and bypassed gesture listeners on read items.
- **Reclaimed Header Space**: Removed unnecessary push banners and clutter for an edge-to-edge minimalist dark aesthetic.

#### ⚡ 120Hz Hardware Acceleration & Tab Performance
- **Progressive Activity Feed Virtualization**: Migrated group activity streams to progressive `FlatList` windowing, reducing initial group load time by 75%.
- **Screen Decoupling & Query Caching**: Enabled `freezeOnBlur` on non-active tabs with 45-second stale time query deduplication to prevent redundant re-renders and network fetches.
- **Manifest Hardware Acceleration**: Enabled `hardwareAccelerated="true"` and `largeHeap="true"` in Android Manifest for butter-smooth 120Hz rendering on high-refresh-rate displays.

---

### 📲 Installation Guide

1. Download **`SplitIt-v1.2.0.apk`** from repository root or GitHub Releases.
2. If prompted on Android, allow *“Install from unknown sources”* for your browser or file manager.
3. Tap the file to install or update from previous versions (`v1.1.1` or `v1.1.0`). All local data and sessions will be preserved.

