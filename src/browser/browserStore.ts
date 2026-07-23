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