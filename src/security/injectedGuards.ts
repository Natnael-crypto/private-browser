/**
 * Injected Security Guards
 * Document-start JavaScript guards for identity spoofing, fingerprint neutralization,
 * content control, permission gates, and safety warnings.
 */

export interface SecurityGuardOptions {
  currentHost?: string;
  userAgent?: string;
  language?: string;
  timezone?: string;
  roundScreen?: boolean;
  reduceFingerprinting?: boolean;
  blockThirdPartyScripts?: boolean;
  blockAutoplay?: boolean;
  blockLocalNetwork?: boolean;
  blockImages?: boolean;
  blockWebFonts?: boolean;
  blockServiceWorkers?: boolean;
  blockBeacons?: boolean;
  blockClipboardRead?: boolean;
  detectInsecureForms?: boolean;
}

export function buildInjectedSecurityGuards(options: SecurityGuardOptions): string {
  const currentHost = options.currentHost || '';
  const lang = options.language || 'en-US';
  const tz = options.timezone || 'UTC';
  const roundScreen = Boolean(options.roundScreen);
  const reduceFingerprinting = Boolean(options.reduceFingerprinting);
  const blockThirdPartyScripts = Boolean(options.blockThirdPartyScripts);
  const blockLocalNetwork = Boolean(options.blockLocalNetwork);
  const blockImages = Boolean(options.blockImages);
  const blockWebFonts = Boolean(options.blockWebFonts);
  const blockServiceWorkers = Boolean(options.blockServiceWorkers);
  const blockBeacons = Boolean(options.blockBeacons);
  const blockClipboardRead = Boolean(options.blockClipboardRead);
  const detectInsecureForms = Boolean(options.detectInsecureForms);

  return `
    (function() {
      try {
        const HOST = "${currentHost.replace(/"/g, '\\"')}";

        // --- IDN-6: Language Spoofing ---
        ${
          options.language
            ? `
          try {
            const spoofLang = "${lang.replace(/"/g, '\\"')}";
            Object.defineProperty(navigator, 'language', { get: () => spoofLang, configurable: true });
            Object.defineProperty(navigator, 'languages', { get: () => [spoofLang, 'en'], configurable: true });
          } catch(e) {}
        `
            : ''
        }

        // --- IDN-7: Timezone Spoofing ---
        ${
          options.timezone
            ? `
          try {
            const targetTz = "${tz.replace(/"/g, '\\"')}";
            const OrigDateTimeFormat = Intl.DateTimeFormat;
            Intl.DateTimeFormat = function(locales, dtfOptions) {
              const opts = Object.assign({}, dtfOptions);
              if (!opts.timeZone) {
                opts.timeZone = targetTz;
              }
              return new OrigDateTimeFormat(locales, opts);
            };
            Intl.DateTimeFormat.prototype = OrigDateTimeFormat.prototype;
            Intl.DateTimeFormat.supportedLocalesOf = OrigDateTimeFormat.supportedLocalesOf;
          } catch(e) {}
        `
            : ''
        }

        // --- IDN-8: Screen Resolution Rounding ---
        ${
          roundScreen
            ? `
          try {
            const roundTo100 = (val) => Math.round(val / 100) * 100;
            const w = roundTo100(window.screen.width || 390);
            const h = roundTo100(window.screen.height || 844);
            Object.defineProperty(screen, 'width', { get: () => w });
            Object.defineProperty(screen, 'height', { get: () => h });
            Object.defineProperty(screen, 'availWidth', { get: () => w });
            Object.defineProperty(screen, 'availHeight', { get: () => h });
            Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
            Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
          } catch(e) {}
        `
            : ''
        }
