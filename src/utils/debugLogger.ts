/**
 * Debug-only logger for Private Browser.
 * Disabled in production builds (__DEV__ === false).
 * STRICT PRIVACY: Logs locally to console only; NEVER sends any telemetry or analytics off-device.
 */

const IS_ENABLED = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

export const DebugLogger = {
  nav(event: string, details?: Record<string, any>) {
    if (!IS_ENABLED) return;
    console.log(`[PB:NAV] ${event}`, details ? JSON.stringify(details) : '');
  },

  load(event: string, details?: Record<string, any>) {
    if (!IS_ENABLED) return;
    console.log(`[PB:LOAD] ${event}`, details ? JSON.stringify(details) : '');
  },

  backForward(action: 'back' | 'forward', decision: string, state?: Record<string, any>) {
    if (!IS_ENABLED) return;
    console.log(`[PB:HISTORY] Action=${action} Decision=${decision}`, state ? JSON.stringify(state) : '');
  },

  download(event: string, details?: Record<string, any>) {
    if (!IS_ENABLED) return;
    console.log(`[PB:DOWNLOAD] ${event}`, details ? JSON.stringify(details) : '');
  },

  media(event: string, details?: Record<string, any>) {
    if (!IS_ENABLED) return;
    console.log(`[PB:MEDIA] ${event}`, details ? JSON.stringify(details) : '');
  },
};
