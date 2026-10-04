# SplitIt Mobile Design System & UX Architecture

A user-focused, phone-optimized, authentic mobile design system inspired directly by Splitwise's native dark interface. This specification eliminates generic "AI-generated" visual noise (excessive pills, nested card-in-card containers, garish drop shadows) in favor of crisp typography, clean baseline underlines, phone-first keyboard accessibility, and fluid animated transitions.

---

## 1. Visual Language & Theming Tokens

### 1.1 Color Palette
- **Background (`canvas`)**: `#18191B` (Authentic Splitwise deep charcoal black, soft on eyes, avoids harsh OLED glare)
- **Surface Elevation**: `#222427` (Used for icon boxes, subtle chips)
- **Primary Accent (`mint`)**: `#1CC29F` / `#10B981` (Signature Splitwise teal/mint green for active states, checkmarks, amount underlines)
- **Text Primary**: `#FFFFFF` (High-contrast crisp white for titles, values, names)
- **Text Secondary**: `#9CA3AF` (Zinc 400 for hints, subtitles, unselected tabs)
- **Text Muted**: `#6B7280` (Zinc 500 for inactive metadata)
- **Hairline Border**: `rgba(255, 255, 255, 0.08)` (Ultra-subtle structure)
- **Active Underline**: `#FFFFFF` or `#1CC29F` (Crisp 3px bottom indicator)
- **Negative / Owe**: `#F43F5E` (Rose/Red for debts)

### 1.2 Anti-"AI-Generated" Principles
1. **No Div Soup**: Never wrap an input inside 3 nested rounded boxes. Use direct inputs with clean bottom baseline rules (`borderBottomWidth: 1`).
2. **Text Tabs with Animated Underlines**: Split options tabs are clean text labels (`fontSize: 14`, `fontWeight: '600'`) sitting directly on the header canvas, accompanied by a single fluid sliding underline. No segmented bubble buttons or symbol badges.
3. **Square Checkboxes**: Splitwise uses recognizable square checkboxes with rounded corners (`borderRadius: 4`, green fill with white check when selected, dark outline when unselected) rather than circular radio dots.
4. **Phone Keyboard First**: Key financial inputs must never be covered by the soft numeric keypad. Form components are compact and vertically efficient. Toolbars dock flush above the keyboard.

---

## 2. Component Specifications

### 2.1 "Adjust Split" Screen (`SplitOptionsModal.tsx`)

#### Top Navigation Bar
- **Left**: `←` Arrow icon (instant back/dismiss).
- **Center**: Title `Adjust split` (`fontSize: 18`, `fontWeight: '700'`, white).
- **Right**: `✓` Checkmark icon (validates and commits the split).

#### Sleek Underline Tab Bar
- **Tabs**: `Equally` | `Unequally` | `By percentages` | `By shares`
- **Indicator**: A 3px tall sliding underline positioned directly beneath the active text tab.
- **Transition**: Smooth position transition when swiping horizontally or tapping tabs.
- **Unselected Style**: Text in `#9CA3AF`, no background pills.

#### Horizontal Paging Content (One Page per Mode)
1. **Equally (`Split equally`)**:
   - Header note: `Split equally` (bold white) / `Select which people owe an equal share.` (muted).
   - Rows: Circular avatar, Member name, and a clean square checkbox `[✓]` aligned to the right.
   - Bottom Dock:
     - Left: `₹X.XX/person (N people)`
     - Center: Vertical hairline divider.
     - Right: `All [✓]` quick toggle checkbox.
2. **Unequally (`Exact amounts`)**:
   - Header note: `Split by exact amounts` / `Specify exactly how much each person owes.`
   - Rows: Avatar, Member name, currency input with underline (`₹` prefix), plus live `{pct}% of total` subtext.
   - Bottom Dock: `₹{totalOwed} of ₹{totalAmount}` | `₹{remaining} left` or `Balanced ✓`.
3. **By Percentages (`By percentages`)**:
   - Header note: `Split by percentages` / `Enter percentage shares for each person.`
   - Rows: Avatar, Member name, percentage input with `.2f` limit (`%` suffix), plus live calculated amount `= ₹{price}` in mint.
   - Bottom Dock: `{sumPct}% of 100%` | `{pctRemaining}% left` or `100% Allocated ✓`.
4. **By Shares (`By shares`)**:
   - Header note: `Split by shares` / `Assign weighted shares to each member.`
   - Rows: Avatar, Member name, stepper `-` `count` `+`, plus live share price `= ₹{price} ({pct}%)`.
   - Bottom Dock: `{totalShares} total shares` | `₹{perShare}/share`.

---

### 2.2 "Add Expense" Screen (`app/expenses/new.tsx`)

#### Top Navigation Bar
- **Left**: `←` Back Arrow.
- **Center**: `Add expense`.
- **Right**: `✓` Save/Confirm Button.

#### Recipient Pill
- `With you and: [ 💚 All of <Group> ]`
- Tap to switch group or direct split partner.

#### Input Area (Splitwise Signature Baseline Layout)
1. **Description**:
   - Left: Rounded icon container `[ 📄 ]` (`42x42`, `#222427`).
   - Right: Clean text input `Enter a description` with a subtle white/grey bottom baseline.
2. **Amount**:
   - Left: Matching rounded currency container `[ ₹ ]` (`42x42`, `#222427`).
   - Right: Bold amount input `0.00` (`fontSize: 32`, `fontWeight: '700'`) with a clean mint green bottom baseline (`borderBottomColor: #1CC29F`, `borderBottomWidth: 2`).

#### Conversational Trigger Strip
- Text: `Paid by ` `[ you ]` ` and split ` `[ equally ]`
- Chips: Clean dark pills with thin border (`borderWidth: 1`, `borderColor: rgba(255, 255, 255, 0.2)`).

#### Keyboard-Anchored Accessory Toolbar
- Pinned directly above the numeric soft keyboard when typing (and flush at bottom when keyboard is closed).
- **Left**: Group badge `👥 College`.
- **Right**: Action icons:
  - Calendar `[ 📅 ]`
  - Camera `[ 📷 ]`
  - Notes `[ 📝 ]`

---

### 2.3 "Who Paid?" Modal (`PayerSelectModal.tsx`)

#### Top Navigation Bar
- `←` Back, `Who paid?`, `✓` Confirm.

#### Tab Bar
- `Single person` | `Multiple people` with sleek sliding underline.

#### Content
- **Single Person**: List of members with avatars, names, and a clean checkmark for active payer. Instant tap-to-select.
- **Multiple People**: Currency input per member with live `% of total`, "Split paid equally" action, and live balance dock.

---

## 3. Keyboard & Phone Optimization Architecture

1. **Uninterrupted Visibility**: The amount and description fields, conversational chips, and toolbar are tightly packed into the top 240px of screen height. When the soft keyboard (typically ~280px tall) deploys, nothing is obscured.
2. **Input Accessory Dock**: Utilizes `KeyboardAvoidingView` with `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` and native keyboard listeners on Android to seamlessly track keyboard height in real time.
3. **One-Tap Validation**: Top-right `✓` icon is always reachable in the top app bar regardless of keyboard state.
