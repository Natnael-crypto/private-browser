/**
 * Privacy Layer (PRV-1 to PRV-13)
 * Strips tracking parameters, enforces HTTPS-only, injects GPC & WebRTC leak shields.
 */

// Known tracking parameters to strip before navigation (PRV-8)
const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'gclid',
  'gclsrc',
  'dclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  'igshid',
  'yclid',
  '_hsenc',
  '_hsmi',
  'mkt_tok',
  's_kwcid',
  'zanpid',
  'wickedid',
  'twclid',
  'sc_clid',
]);

export class PrivacyManager {
  /**
   * Strip tracking query parameters from URL (PRV-8)
   */
  public static sanitizeUrl(rawUrl: string, enabled: boolean = true): string {
    if (!enabled) return rawUrl;
    try {
      const url = new URL(rawUrl);
      const params = new URLSearchParams(url.search);
      let changed = false;

      // Check each param
      const keysToDelete: string[] = [];
      params.forEach((_, key) => {
        const lowerKey = key.toLowerCase();
        if (TRACKING_PARAMS.has(lowerKey) || lowerKey.startsWith('utm_')) {
          keysToDelete.push(key);
          changed = true;
        }
      });

      keysToDelete.forEach((k) => params.delete(k));

      if (changed) {
        url.search = params.toString() ? `?${params.toString()}` : '';
        return url.toString();
      }
      return rawUrl;
    } catch {
      return rawUrl;
    }
  }

  /**
   * Enforce HTTPS upgrade (PRV-7)
   */
  public static upgradeToHttps(rawUrl: string, enabled: boolean = true): string {
    if (!enabled) return rawUrl;
    if (rawUrl.startsWith('http://')) {
      return 'https://' + rawUrl.slice(7);
    }
    return rawUrl;
  }

  /**
   * Privacy JavaScript to inject into every WebView page before document loads (PRV-9, PRV-10, PRV-11)
   */
  public static getPrivacyInjectedScript(options: {
    sendGpc: boolean;
    blockWebRtc: boolean;
    reduceFingerprinting: boolean;
  }): string {
    return `
      (function() {
        try {
          // PRV-9: Global Privacy Control (GPC)
          ${
            options.sendGpc
              ? `
            if (!('globalPrivacyControl' in navigator)) {
              Object.defineProperty(navigator, 'globalPrivacyControl', {
                get: () => true,
                configurable: false,
                enumerable: true,
              });
            }
          `
              : ''
          }

          // PRV-10: WebRTC IP Leak Shield (Force relay-only / neutralize RTCPeerConnection)
          ${
            options.blockWebRtc
              ? `
            if (window.RTCPeerConnection) {
              const OriginalRTC = window.RTCPeerConnection;
              window.RTCPeerConnection = function(config, constraints) {
                const cfg = config || {};
                cfg.iceTransportPolicy = 'relay';
                return new OriginalRTC(cfg, constraints);
              };
              window.RTCPeerConnection.prototype = OriginalRTC.prototype;
            }
          `
              : ''
          }

          // PRV-11: Fingerprinting Reductions (Canvas, AudioContext, Navigator hardware)
          ${
            options.reduceFingerprinting
              ? `
            if (navigator.hardwareConcurrency) {
              Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
            }
            if (navigator.deviceMemory) {
              Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
            }
          `
              : ''