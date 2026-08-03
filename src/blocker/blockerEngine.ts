
/**
 * Common ad, tracker, and telemetry domain patterns
 * Adheres to BLK-1, BLK-2 EasyList & EasyPrivacy core patterns
 */
const BUNDLED_BLOCK_PATTERNS: (string | RegExp)[] = [
  // Google / DoubleClick / AdSense / Analytics
  /doubleclick\.net/i,
  /google-analytics\.com/i,
  /googletagmanager\.com/i,
  /googlesyndication\.com/i,
  /googleadservices\.com/i,
  /adservice\.google\./i,
  /pagead2\.googlesyndication\.com/i,

  // Social trackers & pixels
  /connect\.facebook\.net/i,
  /facebook\.com\/tr\//i,
  /analytics\.twitter\.com/i,
  /ads-twitter\.com/i,
  /pixel\.wp\.com/i,
  /analytics\.tiktok\.com/i,

  // Major Ad Networks
  /criteo\.com/i,
  /criteo\.net/i,
  /outbrain\.com/i,
  /taboola\.com/i,
  /rubiconproject\.com/i,
  /adnxs\.com/i,
  /adtech\.de/i,
  /pubmatic\.com/i,
  /openx\.net/i,
  /smartadserver\.com/i,
  /media\.net/i,
  /scorecardresearch\.com/i,
  /moatads\.com/i,
  /adroll\.com/i,
  /popads\.net/i,
  /propellerads\.com/i,
  /exoclick\.com/i,
  /adsterra\.com/i,
  /mgid\.com/i,
  /zergnet\.com/i,
  /revcontent\.com/i,

  // Telemetry & Device Fingerprinters
  /segment\.io/i,
  /amplitude\.com/i,
  /mixpanel\.com/i,
  /hotjar\.com/i,
  /clarity\.ms/i,
  /sentry\.io\/api\//i,
  /bugsnag\.com/i,
  /branch\.io/i,
  /appsflyer\.com/i,
  /adjust\.com/i,
];

/**
 * CSS selectors for cosmetic filtering (BLK-6, BLK-9)
 * Hides banner ads, sponsored boxes, and annoying cookie popups
 */
const COSMETIC_SELECTORS = [
  // Generic ad classes/IDs
  '.ad-banner',
  '.adsbox',
  '.advertisement',
  'ins.adsbygoogle',
  'div[id^="google_ads_"]',
  'div[id^="div-gpt-ad"]',
  'iframe[src*="doubleclick"]',
  'iframe[src*="googlesyndication"]',
  'iframe[id^="google_ads_frame"]',
  '.sponsored-post',
  '.native-ad',
  '.taboola-container',
  '.outbrain-container',
  // Cookie notices & consent banners (BLK-9)
  '#onetrust-consent-sdk',
  '#cmpbox',
  '.cookie-banner',
  '.cookie-notice',
  '.cookie-consent',
  '#cookie-notice',
  '#cookieConsent',
  '.qc-cmp2-container',
];

export class BlockerEngine {
  /**
   * Check if a URL should be blocked based on domain rules
   */
  public static shouldBlockUrl(url: string, isAllowedHost: boolean): boolean {
    if (isAllowedHost) return false;
    if (!url) return false;

    for (const pattern of BUNDLED_BLOCK_PATTERNS) {
      if (typeof pattern === 'string') {
        if (url.includes(pattern)) return true;
      } else if (pattern.test(url)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Generate CSS string for cosmetic filtering (BLK-6, BLK-9)
   */
  public static getCosmeticCss(): string {
    const selectorRule = COSMETIC_SELECTORS.join(',\n');
    return `${selectorRule} { display: none !important; visibility: hidden !important; height: 0 !important; max-height: 0 !important; overflow: hidden !important; opacity: 0 !important; pointer-events: none !important; }`;
  }

  /**
   * Generate Injected script that:
   * 1. Injects cosmetic CSS into document
   * 2. Overrides fetch and XMLHttpRequest to intercept and count/block tracker calls in the page
   */
  public static getBlockerInjectedScript(enabled: boolean, siteAllowed: boolean): string {
    if (!enabled || siteAllowed) {
      return `/* Blocker disabled for this page */`;
    }

    const cssContent = JSON.stringify(this.getCosmeticCss());
    const patternsJson = JSON.stringify(
      BUNDLED_BLOCK_PATTERNS.map((p) => (typeof p === 'string' ? p : p.source))
    );

    return `
      (function() {
        try {
          // 1. Inject Cosmetic CSS (BLK-6, BLK-9)
          function injectCosmetic() {
            if (document.getElementById('__pb_cosmetic_style')) return;
            const style = document.createElement('style');
            style.id = '__pb_cosmetic_style';
            style.textContent = ${cssContent};
            (document.head || document.documentElement).appendChild(style);
          }
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', injectCosmetic);
          } else {
            injectCosmetic();
          }

          // 2. Network Interceptor for fetch and XHR inside the page (BLK-2)
          const blockedRules = ${patternsJson}.map(r => new RegExp(r, 'i'));
          function isUrlBlocked(u) {
            if (!u || typeof u !== 'string') return false;
            return blockedRules.some(re => re.test(u));
          }

          function reportBlocked(u) {
            try {
              if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'pb_tracker_blocked',
                  url: u
                }));
              }
            } catch(e) {}
          }

          // Override window.fetch
          const originalFetch = window.fetch;
          window.fetch = function(input, init) {
            const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
            if (isUrlBlocked(url)) {
              reportBlocked(url);
              return Promise.reject(new TypeError('Network request blocked by Private Browser'));
            }
            return originalFetch.apply(this, arguments);