# Changelog

All notable changes to the SplitIt Mobile application are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
