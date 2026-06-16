// ── Analytics abstraction layer ──────────────────────────────────────────
//
// Usage:
//   import { trackScreenView, trackEvent } from "../utils/analytics";
//
//   trackScreenView("Watchlist");
//   trackEvent("stock_add", { code: "600519", name: "Kweichow Moutai" });
//
// To switch to a real provider (Firebase, PostHog, etc.), replace the
// implementations in this file.  The public API stays the same.

// ── Types ────────────────────────────────────────────────────────────────

export interface AnalyticsEvent {
  /** Event name, e.g. "stock_add", "analysis_request". */
  name: string;
  /** Optional key-value payload. */
  params?: Record<string, string | number | boolean>;
}

// ── Queue for offline resilience ─────────────────────────────────────────

const pendingQueue: AnalyticsEvent[] = [];
const MAX_QUEUE_SIZE = 200;

function enqueue(event: AnalyticsEvent): void {
  if (pendingQueue.length >= MAX_QUEUE_SIZE) {
    pendingQueue.shift(); // drop oldest
  }
  pendingQueue.push(event);
}

/** Flush queued events (called when connectivity resumes). */
export function flushQueue(): void {
  while (pendingQueue.length > 0) {
    const event = pendingQueue.shift()!;
    sendToConsole(event);
  }
}

// ── Sink: console (default) ──────────────────────────────────────────────

function sendToConsole(event: AnalyticsEvent): void {
  const ts = new Date().toISOString().slice(11, 19);
  const params = event.params
    ? " " + JSON.stringify(event.params)
    : "";
  console.log(`[analytics] ${ts} ${event.name}${params}`);
}

function sendToConsoleWithRetry(event: AnalyticsEvent): void {
  try {
    sendToConsole(event);
  } catch {
    enqueue(event);
  }
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Track a screen view event.
 * Call this from navigation listeners or useEffect in screen components.
 */
export function trackScreenView(screenName: string): void {
  sendToConsoleWithRetry({ name: "screen_view", params: { screen: screenName } });
}

/**
 * Track a custom event.
 *
 * Examples:
 *   trackEvent("analysis_request", { code: "600519" });
 *   trackEvent("stock_add", { code: "600519", name: "Kweichow Moutai" });
 *   trackEvent("skill_switch", { from: "chan", to: "wave" });
 */
export function trackEvent(name: string, params?: Record<string, string | number | boolean>): void {
  sendToConsoleWithRetry({ name, params });
}

/**
 * Track a timing metric (e.g. analysis duration).
 */
export function trackTiming(category: string, durationMs: number, label?: string): void {
  sendToConsoleWithRetry({
    name: "timing",
    params: { category, duration_ms: durationMs, ...(label ? { label } : {}) },
  });
}
