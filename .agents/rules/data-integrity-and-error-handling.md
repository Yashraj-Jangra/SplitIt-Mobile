# 🛡️ Data Integrity & Production Error Handling Standards

## Core Principle

**Never ever use mock, dummy, or synthetic fallback data in production code unless explicitly specified by the user.**
When an operation fails — whether an AI vision OCR call, a network request, a database mutation, or a native module interaction — the application must report the failure honestly and handle all edge cases defensively. Fabricating fake success states (such as hardcoded receipt amounts or simulated purchases) degrades user trust, compromises financial ledger integrity, and is strictly forbidden.

---

## 1. Zero Mock or Dummy Data Policy

### Strict Rules

1. **No Synthetic Fallbacks in Service Catch Blocks**:
   - `catch` blocks must **never** return hardcoded dummy objects (e.g. returning a fake 1850 Cafe Bodega receipt, fake balances, or dummy transaction items) to "hide" errors.
   - If an API, native bridge, or network call fails, throw a typed error or return an explicit failure result `{ success: false, error: ... }`.

```typescript
// ❌ FORBIDDEN — Fabricating fake success data on error
try {
  const result = await ocrApi.scan(imageUri);
  return result;
} catch {
  return { amount: 1850, merchant: 'Cafe Bodega', date: '2026-11-20' }; // CHEAP MOCK DATA
}

// ✅ REQUIRED — Defensive error handling with granular diagnostic context
try {
  const result = await ocrApi.scan(imageUri);
  return result;
} catch (error) {
  if (error instanceof NetworkError) {
    throw new OcrServiceError('NETWORK_UNREACHABLE', 'Unable to reach SplitIt Vision server. Please check your internet connection.');
  }
  throw new OcrServiceError('SCAN_FAILED', error.message || 'Could not parse receipt text. Please ensure the bill is well-lit and in focus.');
}
```

2. **Permitted Mock Data Exceptions**:
   - Mock data is permitted **only** in designated unit test fixtures (`*.test.ts`, `__mocks__/`) or when the user explicitly requests demo/mock mode in the requirement specification.
   - Any test fixture or demo switch must be strictly segregated from production code paths.

3. **Honest Nullish Representation**:
   - If OCR or an AI model cannot detect a specific field (such as an obscured total or illegible date), keep it `null` or `undefined`.
   - Never substitute `null` with arbitrary magic numbers (e.g. `parsedAmount || 1850`). Let the user review and manually enter the missing field with clear visual guidance.

---

## 2. Granular Edge Case Classification & Handling

Every feature interacting with networks, native modules, hardware sensors, or local storage must handle the following matrix of edge cases:

| Failure Mode | Root Cause | Required User Action / UI State |
| :--- | :--- | :--- |
| **Offline / No Connection** | Device offline, airplane mode, DNS failure | Non-blocking banner or card: "You are offline. Reconnect to scan receipts or sync expenses." + "Retry" CTA |
| **Request Timeout** | High latency or hanging socket (> 15s) | Cancel active socket, clean up spinners, display "Request timed out. Please try again." |
| **Session Expired (401)** | Expired JWT or revoked session | Trigger non-disruptive token refresh; if refresh fails, guide user to sign-in modal without losing local state |
| **Forbidden (403)** | Non-member access or missing permissions | Inform user of access limits: "You do not have permission to upload receipts to this circle." |
| **Unprocessable Media (422 / Format)** | Corrupted image, unsupported MIME, blurriness | "Image could not be parsed. Please capture a clear, well-lit photo of the receipt." + "Retake" CTA |
| **Payload Too Large (413)** | Image exceeds upload limit (> 10MB) | Automatic client-side compression (`expo-image-manipulator`) before upload; if still oversized, reject with explicit size guidance |
| **Hardware / OS Incompatible** | Device lacks required API level or SDK extension | Automatic graceful degradation to supported standard fallback (e.g. `expo-image-picker` on iOS/unsupported Android) |
| **Permission Denied / Revoked** | User denied camera or revoked media access | High-context permission screen explaining *why* permission is needed + 1-tap "Open Settings" launcher (`Linking.openSettings()`) |
| **User Abort / Cancel** | User dismissed picker or pressed Back | Silent cancellation without error alerts or residual loading spinners |

---

## 3. UI State Lifecycle & Cleanup Discipline

To guarantee that the app never enters an inconsistent or frozen state:

1. **Always Reset Loading States in `finally`**:
   - Every `setIsProcessing(true)` or `setLoading(true)` must have its corresponding `false` call inside a `finally` block, ensuring spinners never loop indefinitely on failure.
2. **Cancel Active Animations on Error**:
   - Laser scan animations, progress bars, or worklets must be safely canceled (`cancelAnimation(...)`) when an error occurs or when the screen unmounts.
3. **Actionable Recovery Paths**:
   - Every error message must offer the user an immediate recovery option (e.g., "Retry", "Retake Photo", "Choose from Gallery", "Enter Manually").
4. **Haptic Failure Feedback**:
   - On error, trigger tactile failure haptics (`haptics.error()`) so the user receives immediate physical feedback.
