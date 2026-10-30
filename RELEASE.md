# SplitIt Mobile Releases

Official release documentation and binaries for the SplitIt Mobile app.

---

## [v1.2.0] - 2026-10-30

> **Target OS**: Android 10+ (API 29+) & iOS 15+  
> **Build Number**: `4`  
> **Package**: `com.splitit.app`

### 📦 Artifacts & Downloads

| File | Type | Size | SHA256 Checksum |
| :--- | :--- | :--- | :--- |
| **`SplitIt-v1.2.0.apk`** | Android Release APK | `129.3 MB` (`135,617,649 bytes`) | `587c375af2e5723f8159f3755a762d94591683cb859943b9128fc1f1542ecb2e` |

```bash
# Verify checksum on Windows (PowerShell)
Get-FileHash -Algorithm SHA256 .\SplitIt-v1.2.0.apk

# Verify checksum on Linux / macOS
sha256sum SplitIt-v1.2.0.apk
```

---

### 🚀 Highlights & Changelog

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
