import { db, SiteSettingsRecord } from '../db/database';
import { buildInjectedSecurityGuards, SecurityGuardOptions } from '../security/injectedGuards';

export const USER_AGENT_PRESETS = {
  default: '', // System default WebView UA
  safari_ios:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  safari_mac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  chrome_win:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  firefox_linux:
    'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0',
  chrome_android:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
};

export interface GlobalSecurityConfig {
  blockAds: boolean;
  blockCookies: boolean;
  httpsOnly: boolean;
  sendGpc: boolean;
  blockWebRtc: boolean;
  reduceFingerprinting: boolean;
  globalJs: boolean;
  blockThirdPartyScripts: boolean;
  blockAutoplay: boolean;
  blockLocalNetwork: boolean;
  imagesEnabled: boolean;
  blockWebFonts: boolean;
  blockServiceWorkers: boolean;
  blockBeacons: boolean;
  blockClipboardRead: boolean;
  detectInsecureForms: boolean;
  uaPreset: keyof typeof USER_AGENT_PRESETS | 'custom';
  customUa: string;
  language: string;
  timezone: string;
  roundScreen: boolean;
  duressCode?: string;
  maxFailedAttempts: number; // 0 = never, 5, 10
}

export interface ResolvedPolicy {
  host: string;
  javascriptEnabled: boolean;
  blockThirdPartyScripts: boolean;
  blockAutoplay: boolean;
  blockLocalNetwork: boolean;
  imagesEnabled: boolean;
  blockWebFonts: boolean;
  blockServiceWorkers: boolean;
  blockBeacons: boolean;
  blockClipboardRead: boolean;
  detectInsecureForms: boolean;
  fingerprintProtection: boolean;
  blockerEnabled: boolean;
  httpsOnly: boolean;
  sendGpc: boolean;
  userAgent: string;
  language: string;
  timezone: string;
  roundScreen: boolean;
}

export class PolicyEngine {
  /**
   * Resolve effective policy with precedence:
   * 1. Exact host override in site_settings
   * 2. Parent domain override (e.g. example.com for sub.example.com)
   * 3. Global config
   */
  public static async resolvePolicy(
    urlOrHost: string,
    globalConfig: GlobalSecurityConfig
  ): Promise<ResolvedPolicy> {
    let host = '';
    try {
      if (urlOrHost.includes('://')) {
        host = new URL(urlOrHost).hostname.toLowerCase();
      } else {
        host = urlOrHost.toLowerCase().split('/')[0].split(':')[0];
      }
    } catch {
      host = urlOrHost.toLowerCase();
    }

    // Lookup exact host
    let siteSetting: SiteSettingsRecord | null = null;
    if (host) {
      siteSetting = await db.getSiteSettings(host);

      // If not found, try parent domain
      if (!siteSetting && host.includes('.')) {
        const parts = host.split('.');
        if (parts.length > 2) {