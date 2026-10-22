/**
 * haptics.service.ts
 *
 * Flagship haptics engine for SplitIt.
 * ─────────────────────────────────────────────────────────────────────────────
 * • Single source of truth — no other file imports expo-haptics directly.
 * • Semantic vocabulary maps user intent to precisely tuned physical patterns.
 * • On/off gate reads from a module-level ref injected by HapticsProvider —
 *   zero AsyncStorage reads at call time, instant toggle response.
 * • Sequenced multi-pulse patterns for premium feel (confirm echo, settle
 *   double-pulse, group ascending triple, destructive heavy+pause+medium).
 */
import * as ExpoHaptics from 'expo-haptics';

// ─── On/Off state ────────────────────────────────────────────────────────────
// In-memory module-level state updated by HapticsProvider. Synchronous read — no overhead.
let _enabled = true;

/** Called by HapticsProvider on mount and on every toggle change. */
export function setHapticsEnabled(val: boolean): void {
  _enabled = val;
}

// ─── Utility ─────────────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function enabled(): boolean {
  return _enabled;
}

// ─── Semantic Vocabulary ─────────────────────────────────────────────────────

/**
 * Passive navigation tap, back button, close button, list row select.
 * Intentionally silent: per Apple HIG and Material Design standards,
 * passive screen navigation and row tapping must never buzz the phone.
 */
function tap(): void {
  // Intentionally silent — prevents navigation fatigue.
}

/**
 * Financial chart timeline scrub / hover detent.
 * Crisp selection tick on crossing discrete data points on graphs
 * (e.g. BalanceHistoryGraph, SpendingTimelineChart, DonutChart).
 */
function chartScrub(): void {
  if (!enabled()) return;
  ExpoHaptics.selectionAsync();
}

/**
 * Mechanical switch toggle (e.g. Simplify Debts, biometrics, notifications).
 * Light crisp snap — realistic tactile binary switch feel.
 */
function toggleSwitch(): void {
  if (!enabled()) return;
  ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light);
}

/** Legacy alias for toggleSwitch */
function tick(): void {
  toggleSwitch();
}

/**
 * Numpad digit press on amount inputs.
 * Ultra-fast, ultra-subtle — like a physical key click.
 */
function keyPress(): void {
  if (!enabled()) return;
  ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light);
}

/**
 * TextInput focus.
 * Intentionally silent: focusing an input should not vibrate.
 */
function inputFocus(): void {
  // Intentionally silent
}

/**
 * Save / submit / primary action confirm.
 * Medium initial press + Light echo after 60ms — feels like a satisfying button
 * click with a physical release rebound.
 */
async function confirm(): Promise<void> {
  if (!enabled()) return;
  ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Medium);
  await sleep(60);
  ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light);
}

/**
 * Settlement successfully recorded.
 * iOS Success notification + Light echo after 120ms — dopamine-tier reward.
 * Feels like money landing in an account.
 */
async function settleSuccess(): Promise<void> {
  if (!enabled()) return;
  ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success);
  await sleep(120);
  ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light);
}

/**
 * New group created.
 * Light → Medium → Light with 80ms gaps — ascending celebration pulse.
 * Feels like a cheer: quiet → full → quiet.
 */
async function groupCreated(): Promise<void> {
  if (!enabled()) return;
  ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light);
  await sleep(80);
  ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Medium);
  await sleep(80);
  ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light);
}

/**
 * Generic confirm after async success (e.g. profile save, password change).
 * iOS Success notification — clear, positive.
 */
function saveSuccess(): void {
  if (!enabled()) return;
  ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success);
}

/**
 * Destructive action (delete account, remove member, irreversible ops).
 * Heavy press + 150ms pause + Medium — "are you sure?" weight and gravity.
 */
async function destructive(): Promise<void> {
  if (!enabled()) return;
  ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Heavy);
  await sleep(150);
  ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Medium);
}

/**
 * Validation error, field rejection, failed action.
 * iOS Error notification — clear, decisive.
 */
function error(): void {
  if (!enabled()) return;
  ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Error);
}

/**
 * Warning / caution state (offline banner, pending alert).
 * iOS Warning notification — softer than error.
 */
function warning(): void {
  if (!enabled()) return;
  ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Warning);
}

/**
 * Network connection lost.
 * Warning notification — signals degraded state without alarm.
 */
function networkDown(): void {
  if (!enabled()) return;
  ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Warning);
}

/**
 * Network connection restored.
 * Double-light ping — relief signal after degraded state.
 */
async function networkUp(): Promise<void> {
  if (!enabled()) return;
  ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light);
  await sleep(80);
  ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light);
}

/**
 * Swipe to dismiss or drag gesture completed.
 * Selection async — consistent with iOS drag-end convention.
 */
function swipe(): void {
  if (!enabled()) return;
  ExpoHaptics.selectionAsync();
}

// ─── Public API ──────────────────────────────────────────────────────────────
export const haptics = {
  tap,
  chartScrub,
  toggleSwitch,
  tick,
  keyPress,
  inputFocus,
  confirm,
  settleSuccess,
  groupCreated,
  saveSuccess,
  destructive,
  error,
  warning,
  networkDown,
  networkUp,
  swipe,
} as const;
