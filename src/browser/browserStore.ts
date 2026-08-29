import { create } from 'zustand';
import * as Crypto from 'expo-crypto';
import { db } from '../db/database';
import { PrivacyManager } from '../privacy/privacyManager';

export interface BrowserTab {
  id: string;
  // What the user asked to load. Changes ONLY on an explicit user navigation.
  loadRequest: { url: string; nonce: number } | null;
  // What the page is showing right now. Written by WebView events, read-only for the UI.
  currentUrl: string;
  url: string; // Mirror of currentUrl for UI backwards-compatibility
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  homeForward: boolean;
  isLoading: boolean;
  progress: number;
  blockedCount: number;
  isBlank: boolean;
  desktopMode: boolean;
  previewImage?: string;
  description?: string;
  loadError?: { code?: number; description: string; failingUrl?: string } | null;
}

export type SearchEngine = 'DuckDuckGo' | 'Google' | 'Brave' | 'Bing' | 'Ecosia';

const SEARCH_URLS: Record<SearchEngine, string> = {
  DuckDuckGo: 'https://duckduckgo.com/?q=',
  Google: 'https://www.google.com/search?q=',
  Brave: 'https://search.brave.com/search?q=',
  Bing: 'https://www.bing.com/search?q=',
  Ecosia: 'https://www.ecosia.org/search?q=',
};

interface BrowserState {
  tabs: BrowserTab[];
  activeTabId: string;
  searchEngine: SearchEngine;
  searchSuggestions: boolean;
  blockAds: boolean;
  blockCookies: boolean;
  httpsOnly: boolean;
  sendGpc: boolean;
  wifiOnly: boolean;
  removeDetailsAfterDl: boolean;
  saveDestination: 'Downloads' | 'App Secure Storage';
  autoLockLabel: string;
  fingerprintEnabled: boolean;
  themeMode: 'dark' | 'light' | 'system';

  // Network & Proxy Settings
  activeProxyId: string | null;
  failClosed: boolean;
  activeVpnId: string | null;
  vpnKillSwitch: boolean;

  // Identity & User Agent
  uaPreset: 'default' | 'safari_ios' | 'safari_mac' | 'chrome_win' | 'firefox_linux' | 'chrome_android' | 'custom';
  customUa: string;
  spoofLanguage: string;
  spoofTimezone: string;
  roundScreen: boolean;
  reduceFingerprinting: boolean;

  // Content & Scripts
  globalJs: boolean;
  blockThirdPartyScripts: boolean;
  blockAutoplay: boolean;
  blockLocalNetwork: boolean;
  imagesEnabled: boolean;
  blockWebFonts: boolean;
  blockServiceWorkers: boolean;
  blockBeacons: boolean;

  // Permissions & Safe Browsing
  defaultDenyPermissions: boolean;
  blockClipboardRead: boolean;
  warnRiskyDownloads: boolean;
  blockDriveByNav: boolean;
  confirmAppRedirects: boolean;

  // Lock & Emergency
  screenOffLock: boolean;
  privateKeyboard: boolean;
  duressCode: string;
  maxFailedAttempts: number;

  // Safety
  detectInsecureForms: boolean;

  // Actions
  createTab: (initialUrl?: string) => string;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, partial: Partial<BrowserTab>) => void;
  incrementBlockedCount: (tabId: string) => void;
  resetBlockedCount: (tabId: string) => void;
  navigateTab: (tabId: string, input: string) => void;
  reloadTab: (tabId: string) => void;
  stopTab: (tabId: string) => void;
  toggleDesktopMode: (tabId: string) => void;

  // Settings Setters
  setBlockAds: (v: boolean) => void;
  setBlockCookies: (v: boolean) => void;
  setHttpsOnly: (v: boolean) => void;
  setSendGpc: (v: boolean) => void;
  setWifiOnly: (v: boolean) => void;
  setRemoveDetailsAfterDl: (v: boolean) => void;
  setSaveDestination: (v: 'Downloads' | 'App Secure Storage') => void;
  setAutoLockLabel: (v: string) => void;
  setFingerprintEnabled: (v: boolean) => void;
  setSearchEngine: (se: SearchEngine) => void;
  setSearchSuggestions: (v: boolean) => void;
  setThemeMode: (mode: 'dark' | 'light' | 'system') => void;

  // Security Setters
  setActiveProxyId: (id: string | null) => void;
  setFailClosed: (v: boolean) => void;
  setActiveVpnId: (id: string | null) => void;
  setVpnKillSwitch: (v: boolean) => void;
  setUaPreset: (preset: 'default' | 'safari_ios' | 'safari_mac' | 'chrome_win' | 'firefox_linux' | 'chrome_android' | 'custom') => void;
  setCustomUa: (v: string) => void;
  setSpoofLanguage: (v: string) => void;
  setSpoofTimezone: (v: string) => void;
  setRoundScreen: (v: boolean) => void;
  setReduceFingerprinting: (v: boolean) => void;
  setGlobalJs: (v: boolean) => void;
  setBlockThirdPartyScripts: (v: boolean) => void;
  setBlockAutoplay: (v: boolean) => void;
  setBlockLocalNetwork: (v: boolean) => void;
  setImagesEnabled: (v: boolean) => void;
  setBlockWebFonts: (v: boolean) => void;
  setBlockServiceWorkers: (v: boolean) => void;
  setBlockBeacons: (v: boolean) => void;
  setDefaultDenyPermissions: (v: boolean) => void;
  setBlockClipboardRead: (v: boolean) => void;
  setWarnRiskyDownloads: (v: boolean) => void;
  setBlockDriveByNav: (v: boolean) => void;
  setConfirmAppRedirects: (v: boolean) => void;
  setScreenOffLock: (v: boolean) => void;
  setPrivateKeyboard: (v: boolean) => void;
  setDuressCode: (v: string) => void;
  setMaxFailedAttempts: (v: number) => void;
  setDetectInsecureForms: (v: boolean) => void;

  // Wipes & Persistence (SEC-2, SEC-4)
  clearEverything: () => Promise<void>;
  resetToInitialState: () => void;
  loadPersistedSettings: () => Promise<void>;
}

const DEFAULT_BLANK_URL = 'about:blank';

export const DEFAULT_SETTINGS = {
  searchEngine: 'DuckDuckGo' as SearchEngine,
  searchSuggestions: false, // Privacy default: disabled so keystrokes are not transmitted
  blockAds: true,
  blockCookies: true,
  httpsOnly: true,
  sendGpc: true,
  wifiOnly: false,
  removeDetailsAfterDl: false,
  saveDestination: 'Downloads' as 'Downloads' | 'App Secure Storage',
  autoLockLabel: 'Immediately',
  fingerprintEnabled: true,
  themeMode: 'dark' as 'dark' | 'light' | 'system',

  // Network defaults
  activeProxyId: null as string | null,
  failClosed: false,
  activeVpnId: null as string | null,
  vpnKillSwitch: false,

  // Identity defaults
  uaPreset: 'default' as 'default' | 'safari_ios' | 'safari_mac' | 'chrome_win' | 'firefox_linux' | 'chrome_android' | 'custom',
  customUa: '',
  spoofLanguage: 'system',
  spoofTimezone: 'system',
  roundScreen: false,
  reduceFingerprinting: true,

  // Content defaults
  globalJs: true,
  blockThirdPartyScripts: false,
  blockAutoplay: true,
  blockLocalNetwork: true,
  imagesEnabled: true,
  blockWebFonts: false,
  blockServiceWorkers: false,
  blockBeacons: true,

  // Permissions defaults
  defaultDenyPermissions: true,
  blockClipboardRead: true,
  warnRiskyDownloads: true,
  blockDriveByNav: true,
  confirmAppRedirects: true,

  // Lock defaults
  screenOffLock: true,
  privateKeyboard: true,
  duressCode: '',
  maxFailedAttempts: 5,

  // Safety defaults
  detectInsecureForms: true,
};

const NON_SECRET_SETTINGS_KEYS = Object.keys(DEFAULT_SETTINGS).filter(
  (k) => k !== 'duressCode'
) as (keyof typeof DEFAULT_SETTINGS)[];

let saveDebounceTimer: any = null;
function persistCurrentSettings(state: BrowserState) {
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(async () => {
    try {
      const payload: Record<string, any> = {};
      for (const k of NON_SECRET_SETTINGS_KEYS) {
        payload[k] = state[k];
      }
      await db.setSetting('pb_app_settings', JSON.stringify(payload));
    } catch (e) {
      console.warn('Failed to persist settings:', e);
    }
  }, 100);
}

export const useBrowserStore = create<BrowserState>((set, get) => {
  const initialTabId = Crypto.randomUUID();
  const initialTab: BrowserTab = {
    id: initialTabId,
    loadRequest: null,
    currentUrl: DEFAULT_BLANK_URL,
    url: DEFAULT_BLANK_URL,
    title: 'New Tab',
    canGoBack: false,
    canGoForward: false,
    homeForward: false,
    isLoading: false,
    progress: 0,
    blockedCount: 0,
    isBlank: true,
    desktopMode: false,
    loadError: null,
  };

  const updateSetting = <K extends keyof typeof DEFAULT_SETTINGS>(key: K, val: typeof DEFAULT_SETTINGS[K]) => {
    set((state) => {
      const next = { ...state, [key]: val };
      persistCurrentSettings(next);
      return { [key]: val } as any;
    });
  };

  return {
    tabs: [initialTab],
    activeTabId: initialTabId,
    ...DEFAULT_SETTINGS,

    createTab: (initialUrl) => {
      const id = Crypto.randomUUID();
      const isBlank = !initialUrl || initialUrl === DEFAULT_BLANK_URL;
      const targetUrl = isBlank ? DEFAULT_BLANK_URL : initialUrl!;
      const newTab: BrowserTab = {
        id,
        loadRequest: isBlank ? null : { url: targetUrl, nonce: 1 },
        currentUrl: targetUrl,
        url: targetUrl,
        title: isBlank ? 'New Tab' : 'Loading...',
        canGoBack: false,
        canGoForward: false,
        homeForward: false,
        isLoading: !isBlank,
        progress: isBlank ? 0 : 0.1,
        blockedCount: 0,
        isBlank,
        desktopMode: false,
        loadError: null,
      };

      set((state) => ({
        tabs: [...state.tabs, newTab],
        activeTabId: id,
      }));
      return id;
    },

    closeTab: (tabId) => {
      const state = get();
      const newTabs = state.tabs.filter((t) => t.id !== tabId);

      if (newTabs.length === 0) {
        // If all closed, create fresh blank tab (PRV-3)
        const newId = Crypto.randomUUID();
        set({
          tabs: [
            {
              id: newId,
              loadRequest: null,
              currentUrl: DEFAULT_BLANK_URL,
              url: DEFAULT_BLANK_URL,
              title: 'New Tab',
              canGoBack: false,
              canGoForward: false,
              homeForward: false,
              isLoading: false,
              progress: 0,
              blockedCount: 0,
              isBlank: true,
              desktopMode: false,
              loadError: null,
            },
          ],
          activeTabId: newId,
        });
      } else {
        const nextActive = state.activeTabId === tabId ? newTabs[newTabs.length - 1].id : state.activeTabId;
        set({
          tabs: newTabs,
          activeTabId: nextActive,
        });
      }
    },

    setActiveTab: (tabId) => {
      set({ activeTabId: tabId });
    },

    updateTab: (tabId, partial) => {
      set((state) => ({
        tabs: state.tabs.map((t) => {
          if (t.id !== tabId) return t;
          const merged = { ...t, ...partial };
          if (partial.currentUrl && !partial.url) {
            merged.url = partial.currentUrl;
          } else if (partial.url && !partial.currentUrl) {
            merged.currentUrl = partial.url;
          }
          return merged;
        }),
      }));
    },

    incrementBlockedCount: (tabId) => {
      set((state) => ({
        tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, blockedCount: t.blockedCount + 1 } : t)),
      }));
    },

    resetBlockedCount: (tabId) => {
      set((state) => ({
        tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, blockedCount: 0 } : t)),
      }));
    },

    navigateTab: (tabId, input) => {
      const state = get();
      const raw = input.trim();
      if (!raw) return;

      let targetUrl = '';
      const hasSpace = /\s/.test(raw);
      const isLikelyDomain = !hasSpace && (raw.includes('.') || raw.startsWith('localhost'));

      if (raw.startsWith('http://') || raw.startsWith('https://')) {
        targetUrl = raw;
      } else if (isLikelyDomain) {
        targetUrl = `https://${raw}`;
      } else {
        // Search engine query (WEB-1, WEB-4)
        targetUrl = `${SEARCH_URLS[state.searchEngine]}${encodeURIComponent(raw)}`;
      }

      // Apply Privacy Layer (PRV-7, PRV-8)
      targetUrl = PrivacyManager.upgradeToHttps(targetUrl, state.httpsOnly);
      targetUrl = PrivacyManager.sanitizeUrl(targetUrl, true);

      set((s) => ({
        tabs: s.tabs.map((t) => {
          if (t.id !== tabId) return t;
          const nextNonce = (t.loadRequest?.nonce ?? 0) + 1;
          return {
            ...t,
            loadRequest: { url: targetUrl, nonce: nextNonce },
            currentUrl: targetUrl,
            url: targetUrl,
            title: targetUrl,
            isLoading: true,
            progress: 0.1,
            isBlank: false,
            homeForward: false,
            loadError: null,
          };
        }),
      }));
    },

    reloadTab: (tabId) => {
      set((s) => ({
        tabs: s.tabs.map((t) => {
          if (t.id !== tabId) return t;
          const targetUrl = t.currentUrl || t.loadRequest?.url || DEFAULT_BLANK_URL;
          if (targetUrl === DEFAULT_BLANK_URL) return t;
          const nextNonce = (t.loadRequest?.nonce ?? 0) + 1;
          return {
            ...t,
            loadRequest: { url: targetUrl, nonce: nextNonce },
            isLoading: true,
            progress: 0.1,
            loadError: null,
          };
        }),
      }));
    },

    stopTab: (tabId) => {
      set((s) => ({
        tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, isLoading: false } : t)),
      }));
    },

    toggleDesktopMode: (tabId) => {
      set((state) => ({
        tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, desktopMode: !t.desktopMode } : t)),
      }));
    },

    setBlockAds: (v) => updateSetting('blockAds', v),
    setBlockCookies: (v) => updateSetting('blockCookies', v),
    setHttpsOnly: (v) => updateSetting('httpsOnly', v),
    setSendGpc: (v) => updateSetting('sendGpc', v),
    setWifiOnly: (v) => updateSetting('wifiOnly', v),
    setRemoveDetailsAfterDl: (v) => updateSetting('removeDetailsAfterDl', v),
    setSaveDestination: (v) => updateSetting('saveDestination', v),
    setAutoLockLabel: (v) => updateSetting('autoLockLabel', v),
    setFingerprintEnabled: (v) => updateSetting('fingerprintEnabled', v),
    setSearchEngine: (se) => updateSetting('searchEngine', se),
    setSearchSuggestions: (v) => updateSetting('searchSuggestions', v),
    setThemeMode: (mode) => updateSetting('themeMode', mode),

    // Security Setters
    setActiveProxyId: (id) => updateSetting('activeProxyId', id),
    setFailClosed: (v) => updateSetting('failClosed', v),
    setActiveVpnId: (id) => updateSetting('activeVpnId', id),
    setVpnKillSwitch: (v) => updateSetting('vpnKillSwitch', v),
    setUaPreset: (preset) => updateSetting('uaPreset', preset),
    setCustomUa: (v) => updateSetting('customUa', v),
    setSpoofLanguage: (v) => updateSetting('spoofLanguage', v),
    setSpoofTimezone: (v) => updateSetting('spoofTimezone', v),
    setRoundScreen: (v) => updateSetting('roundScreen', v),
    setReduceFingerprinting: (v) => updateSetting('reduceFingerprinting', v),
    setGlobalJs: (v) => updateSetting('globalJs', v),