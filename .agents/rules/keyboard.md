# ⌨️ Keyboard Compatibility & Input Rules

## Core Principle

On a mobile finance app, the user spends most of their time entering amounts, descriptions, and notes. **The keyboard must never obscure an active input field, and the UX around the soft keyboard must feel native and fluid.**

---

## KeyboardAvoidingView Requirements

- **Every screen with a form or text input** must wrap its content in a `KeyboardAvoidingView` (or equivalent mechanism like `KeyboardAwareScrollView`).
- Use platform-specific behavior:
  ```tsx
  <KeyboardAvoidingView
    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
  >
  ```
- On Android, ensure `android:windowSoftInputMode="adjustResize"` is set (Expo default — do not override to `adjustPan`).

---

## Input Field Keyboard Types

Always specify the correct `keyboardType` for the data being entered:

| Data | `keyboardType` | `returnKeyType` |
|------|----------------|-----------------|
| Currency amount | `'decimal-pad'` | `'done'` |
| Percentage | `'decimal-pad'` | `'done'` |
| Share count (integer) | `'number-pad'` | `'done'` |
| Description / name | `'default'` | `'next'` |
| Email | `'email-address'` | `'next'` |
| Phone | `'phone-pad'` | `'done'` |
| Search | `'default'` | `'search'` |
| URL | `'url'` | `'go'` |

---

## Return Key Field Chaining

When a screen has multiple inputs (e.g., Add Expense: description → amount):

1. Set `returnKeyType='next'` on all fields except the last.
2. Set `returnKeyType='done'` on the last field.
3. Use `ref` forwarding and `onSubmitEditing` to advance focus to the next input:
   ```tsx
   const amountRef = useRef<TextInput>(null);

   <TextInput
     placeholder="Description"
     returnKeyType="next"
     onSubmitEditing={() => amountRef.current?.focus()}
   />
   <TextInput
     ref={amountRef}
     placeholder="0.00"
     keyboardType="decimal-pad"
     returnKeyType="done"
     onSubmitEditing={handleSubmit}
   />
   ```

---

## Input Accessory Toolbar

- Financial input screens (Add Expense, Settle Up, Split Options) must have a **keyboard-anchored accessory toolbar** that:
  - Docks flush above the soft keyboard when open.
  - Sits at the bottom of the screen when the keyboard is closed.
  - Contains contextual actions (group selector, date picker, camera, notes).
- On iOS, use `InputAccessoryView` for native docking. On Android, use absolute positioning with keyboard height listeners from `react-native-reanimated` or `Keyboard` API.

---

## Input Visibility Guarantees

- The active input field, its label, and its immediate context (e.g., "₹ remaining" status bar below a split input) must **always be visible** when the keyboard is deployed.
- Form sections should vertically compact into the top ~50% of screen height so the keyboard (typically ~280-320px) does not obscure them.
- For long forms (e.g., group settings), wrap in `ScrollView` with `keyboardShouldPersistTaps="handled"` and auto-scroll to the focused input.

---

## Dismissal Behavior

- Tapping outside any input must dismiss the keyboard. Use `Keyboard.dismiss()` on scroll or background press.
- `ScrollView` and `FlatList` should use `keyboardDismissMode="on-drag"` where appropriate.
- Modal dismiss gestures must also dismiss the keyboard first if open.

---

## Platform-Specific Gotchas

### iOS
- `KeyboardAvoidingView` with `behavior="padding"` is required.
- Set `keyboardVerticalOffset` to account for navigation header height.
- `InputAccessoryView` requires a `nativeID` matching the `inputAccessoryViewID` on the `TextInput`.

### Android
- Do NOT use `behavior="padding"` — Android's `adjustResize` handles this natively.
- Hardware keyboard users: all inputs must work with external Bluetooth keyboards (tab navigation, enter to submit).
- `keyboardType="decimal-pad"` on some Android OEMs does not show a decimal point — test on multiple devices and provide an alternative input method if needed.

---

## Testing Checklist

Before shipping any screen with inputs:
- [ ] Type in every field — keyboard never covers active input.
- [ ] Return key advances to next field in logical order.
- [ ] Last field's return key triggers submit or dismiss.
- [ ] Keyboard dismisses on background tap and scroll drag.
- [ ] Accessory toolbar tracks keyboard height smoothly (no jump/flicker).
- [ ] Test on both iOS and Android (ideally real devices).
- [ ] Test with external Bluetooth keyboard (tab, enter, escape).
