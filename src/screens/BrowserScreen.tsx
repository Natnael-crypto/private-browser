import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  TextInput,
  Share,
  ScrollView,
  Linking,
  ImageBackground,
  StatusBar as RNStatusBar,
  BackHandler,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import Svg, { Path } from 'react-native-svg';
import { C, F, Ic, T, useHanken, useTheme } from '../theme/tokens';
import { useBrowserStore, BrowserTab } from '../browser/browserStore';
import { PrivacyManager } from '../privacy/privacyManager';
import { BlockerEngine } from '../blocker/blockerEngine';
import { INJECTED_VIDEO_DETECTOR_SCRIPT } from '../video/injectedDetector';
import { VideoRegistry, DetectedVideoItem } from '../video/videoRegistry';
import { SuggestionsService } from '../browser/suggestionsService';
import { DownloadManager } from '../downloads/downloadManager';
import { ActionSheetModal, ConfirmDialogModal, NoticeDialogModal } from '../components/AppModal';
import SearchEngineIcon from '../components/SearchEngineIcon';
import { PolicyEngine, USER_AGENT_PRESETS } from '../policy/policyEngine';
import { DebugLogger } from '../utils/debugLogger';

function MicIcon({ size = 20, color = '#5f6368' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <Path d="M12 19v4" />
      <Path d="M8 23h8" />
    </Svg>
  );
}

function LensIcon({ size = 20, color = '#5f6368' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <Path d="M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
    </Svg>
  );
}

interface BrowserScreenProps {
  isLocked?: boolean;
  isActiveScreen?: boolean;
  onOpenTabs: () => void;
  onOpenBookmarks: () => void;
  onOpenDownloads: () => void;
  onOpenSettings: () => void;
  onOpenVideosSheet: () => void;
}

export default function BrowserScreen({
  isLocked = false,
  isActiveScreen = true,
  onOpenTabs,
  onOpenBookmarks,
  onOpenDownloads,
  onOpenSettings,
  onOpenVideosSheet,
}: BrowserScreenProps) {
  const ok = useHanken();
  const theme = useTheme();
  const webViewRefs = useRef<{ [tabId: string]: any }>({});
  const [webViewRemountKeys, setWebViewRemountKeys] = useState<Record<string, number>>({});

  const {
    tabs,
    activeTabId,
    createTab,
    updateTab,
    navigateTab,
    reloadTab,
    stopTab,
    toggleDesktopMode,
    incrementBlockedCount,
    resetBlockedCount,
    blockAds,
    blockCookies,
    sendGpc,
    searchEngine,
    setSearchEngine,
    searchSuggestions,
    httpsOnly,
    uaPreset,
    customUa,
    spoofLanguage,
    spoofTimezone,
    roundScreen,
    reduceFingerprinting,
    globalJs,
    blockThirdPartyScripts,
    blockAutoplay,
    blockLocalNetwork,
    imagesEnabled,
    blockWebFonts,
    blockServiceWorkers,
    blockBeacons,
    blockClipboardRead,
    warnRiskyDownloads,
    blockDriveByNav,
    confirmAppRedirects,
    privateKeyboard,
    detectInsecureForms,
  } = useBrowserStore();

  const activeTab: BrowserTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const [urlInput, setUrlInput] = useState('');
  const [isEditingBottomUrl, setIsEditingBottomUrl] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [detectedVideos, setDetectedVideos] = useState<DetectedVideoItem[]>([]);
  const [shieldModalVisible, setShieldModalVisible] = useState(false);
  const [siteBrokenConfirmVisible, setSiteBrokenConfirmVisible] = useState(false);
  const [searchEngineModalVisible, setSearchEngineModalVisible] = useState(false);
  const [redirectModalData, setRedirectModalData] = useState<{
    visible: boolean;
    appName: string;
    targetUrl: string;
  } | null>(null);
  const [browserNotice, setBrowserNotice] = useState<{
    visible: boolean;
    title: string;
    message: string;
  } | null>(null);
  const [activeDownloadCount, setActiveDownloadCount] = useState<number>(0);
  const [activeDownloadSpeed, setActiveDownloadSpeed] = useState<number>(0);
  const [bottomBarHeight, setBottomBarHeight] = useState<number>(Platform.OS === 'android' ? 148 : 130);

  useEffect(() => {
    (RNStatusBar as any).setTranslucent?.(true);
    (RNStatusBar as any).setBackgroundColor?.('transparent');
    const unsub = DownloadManager.subscribe(() => {
      setActiveDownloadCount(DownloadManager.getActiveDownloads().length);
      setActiveDownloadSpeed(DownloadManager.getTotalSpeed());
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (activeTab?.id) {
      VideoRegistry.setActiveTab(activeTab.id);
    }
    const unsub = VideoRegistry.subscribe((list) => {
      setDetectedVideos(list);
    });
    return unsub;
  }, [activeTab?.id]);

  // Debounced search suggestions from selected search engine (Privacy: off by default)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!searchSuggestions) {
        setSuggestions([]);
        return;
      }
      const trimmed = urlInput.trim();
      if (!trimmed) {
        setSuggestions([]);
        return;
      }
      const list = await SuggestionsService.fetchSuggestions(trimmed, searchEngine);
      setSuggestions(list);
    }, 200);
    return () => clearTimeout(timer);
  }, [urlInput, searchSuggestions, searchEngine]);

  const canGoBack = Boolean(activeTab.canGoBack) || !activeTab.isBlank;
  const canGoForward = Boolean(activeTab.canGoForward) || Boolean(activeTab.isBlank && activeTab.homeForward);

  const handleBack = useCallback(() => {
    const tab = useBrowserStore.getState().tabs.find((t) => t.id === activeTab.id) || activeTab;
    const ref = webViewRefs.current[tab.id];

    if (tab.isBlank) {
      DebugLogger.backForward('back', 'already_blank');
      return;
    }

    if (tab.canGoBack && ref) {
      DebugLogger.backForward('back', 'native_goBack', { canGoBack: tab.canGoBack });
      ref.goBack();
      return;
    }

    // Tab is on its first page: return to Home without destroying the WebView, so Forward can return to it
    DebugLogger.backForward('back', 'first_page_to_blank');
    updateTab(tab.id, {
      isBlank: true,
      homeForward: true,
      canGoBack: false,
      canGoForward: true,
      loadError: null,
    });
  }, [activeTab, updateTab]);

  const handleForward = useCallback(() => {
    const tab = useBrowserStore.getState().tabs.find((t) => t.id === activeTab.id) || activeTab;
    const ref = webViewRefs.current[tab.id];

    // If user went back to home screen from first page and now presses Forward:
    if (tab.isBlank && tab.homeForward) {
      DebugLogger.backForward('forward', 'restore_from_blank');
      updateTab(tab.id, {
        isBlank: false,
        homeForward: false,
      });
      return;
    }

    if (tab.canGoForward && ref) {
      DebugLogger.backForward('forward', 'native_goForward');
      ref.goForward();
      return;
    }

    DebugLogger.backForward('forward', 'noop');
  }, [activeTab, updateTab]);

  const handleReloadOrStop = useCallback(() => {
    const tab = useBrowserStore.getState().tabs.find((t) => t.id === activeTab.id) || activeTab;
    const ref = webViewRefs.current[tab.id];
    if (tab.isLoading) {
      stopTab(tab.id);
      if (ref?.stopLoading) {
        ref.stopLoading();
      }
    } else {
      updateTab(tab.id, { loadError: null });
      reloadTab(tab.id);
      if (ref?.reload) {
        ref.reload();
      }
    }
  }, [activeTab, reloadTab, stopTab, updateTab]);

  // Load Timeout (30 seconds): if loading doesn't finish within 30s, show error page
  useEffect(() => {
    if (!activeTab.isLoading) return;
    const timeoutTimer = setTimeout(() => {
      const currentTab = useBrowserStore.getState().tabs.find((t) => t.id === activeTab.id);
      if (currentTab && currentTab.isLoading) {
        DebugLogger.load('load_timeout_30s', { tabId: currentTab.id, url: currentTab.currentUrl });
        updateTab(currentTab.id, {
          isLoading: false,
          loadError: {
            description: 'Connection timed out after 30 seconds. The server took too long to respond.',
            failingUrl: currentTab.currentUrl,
          },
        });
        const ref = webViewRefs.current[currentTab.id];
        ref?.stopLoading?.();
      }
    }, 30000);

    return () => clearTimeout(timeoutTimer);
  }, [activeTab.id, activeTab.isLoading, updateTab]);

  // Hardware Back Button navigation for Web & In-Browser Modals
  useEffect(() => {
    if (!isActiveScreen) return;

    const onHardwareBack = () => {
      if (searchEngineModalVisible) {
        setSearchEngineModalVisible(false);
        return true;
      }
      if (browserNotice?.visible) {
        setBrowserNotice(null);
        return true;
      }
      if (redirectModalData?.visible) {
        setRedirectModalData(null);
        return true;
      }
      if (siteBrokenConfirmVisible) {
        setSiteBrokenConfirmVisible(false);
        return true;
      }
      if (shieldModalVisible) {
        setShieldModalVisible(false);
        return true;
      }
      if (isEditingBottomUrl) {
        setIsEditingBottomUrl(false);
        setSuggestions([]);
        setUrlInput('');
        return true;
      }
      if (urlInput.length > 0 && activeTab.isBlank) {
        setUrlInput('');
        setSuggestions([]);
        return true;
      }
      if (!activeTab.isBlank) {
        handleBack();
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => sub.remove();
  }, [
    isActiveScreen,
    isEditingBottomUrl,
    urlInput,
    shieldModalVisible,
    siteBrokenConfirmVisible,
    redirectModalData,
    browserNotice,
    searchEngineModalVisible,
    activeTab,
    canGoBack,
    handleBack,
  ]);

  // Extract display host
  const hostDisplay = React.useMemo(() => {
    if (!activeTab || activeTab.isBlank || !activeTab.url || activeTab.url.startsWith('about:')) {
      return 'Search or enter address';
    }
    try {
      return new URL(activeTab.url).hostname.replace('www.', '');
    } catch {
      return activeTab.url;
    }
  }, [activeTab]);

  // Combined Injected Script
  const combinedInjectedJavaScript = React.useMemo(() => {
    const isDark = Boolean(theme.isDark);
    const mode = isDark ? 'dark' : 'light';

    const darkThemeScript = `
      (function() {
        try {
          var isDark = ${isDark};
          var mode = '${mode}';

          // 1. Inject or update meta color-scheme
          var meta = document.querySelector('meta[name="color-scheme"]');
          if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'color-scheme';
            if (document.head) {
              document.head.appendChild(meta);
            }
          }
          if (meta) {
            meta.content = mode;
          }

          if (document.documentElement) {
            document.documentElement.style.colorScheme = mode;
          }
        } catch(e) {}
      })();
    `;

    const pagePreviewScript = `
      (function() {
        function extractPageMetadata() {
          try {
            var ogImg = document.querySelector('meta[property="og:image"]');
            var twImg = document.querySelector('meta[name="twitter:image"]');
            var imgUrl = (ogImg && ogImg.content) || (twImg && twImg.content) || '';

            if (!imgUrl) {
              var imgs = document.querySelectorAll('main img, article img, img');
              for (var i = 0; i < imgs.length && i < 15; i++) {
                var img = imgs[i];
                if (img.naturalWidth > 120 && img.naturalHeight > 80 && img.src && img.src.indexOf('data:') !== 0 && img.src.indexOf('blob:') !== 0) {
                  imgUrl = img.src;
                  break;
                }
              }
            }

            var descMeta = document.querySelector('meta[name="description"]') || document.querySelector('meta[property="og:description"]');
            var desc = descMeta ? descMeta.content : '';

            if (window.ReactNativeWebView && (imgUrl || desc)) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'pb_page_metadata',
                data: {
                  previewImage: imgUrl,
                  description: desc,
                }
              }));
            }
          } catch(e) {}
        }

        if (document.readyState === 'complete') {
          setTimeout(extractPageMetadata, 800);
        } else {
          window.addEventListener('load', function() {
            setTimeout(extractPageMetadata, 800);
          });
        }
      })();
    `;

    const mediaAndVoiceScript = `
      (function() {
        try {
          // Auto-trigger search engine voice search when navigated with pb_voice or source=voice
          var href = window.location.href || '';
          if (href.indexOf('pb_voice=1') !== -1 || href.indexOf('source=voice') !== -1) {
            function triggerSearchEngineVoice() {
              var micSelectors = [
                '[aria-label*="voice" i]',
                '[aria-label*="Voice" i]',
                '[jsname="bVqjv"]',
                'div[jscontroller] [role="button"][aria-label*="voice" i]',
                '#sb_mic',
                'button[id*="voice" i]',
                'button[class*="voice" i]'
              ];
              for (var i = 0; i < micSelectors.length; i++) {
                var btn = document.querySelector(micSelectors[i]);
                if (btn) {
                  btn.click();
                  return true;
                }
              }
              return false;
            }

            if (!triggerSearchEngineVoice()) {
              var attempts = 0;
              var pollInterval = setInterval(function() {
                attempts++;
                if (triggerSearchEngineVoice() || attempts > 15) {
                  clearInterval(pollInterval);
                }
              }, 250);
            }
          }
        } catch(e) {}
      })();
    `;

    const resolvedPolicy = {
      host: hostDisplay,
      javascriptEnabled: globalJs,
      blockThirdPartyScripts,
      blockAutoplay,
      blockLocalNetwork,
      imagesEnabled,
      blockWebFonts,
      blockServiceWorkers,
      blockBeacons,
      blockClipboardRead,
      detectInsecureForms,
      fingerprintProtection: reduceFingerprinting,
      blockerEnabled: blockAds,
      httpsOnly,
      sendGpc,
      userAgent:
        uaPreset === 'custom' && customUa
          ? customUa
          : uaPreset in USER_AGENT_PRESETS
          ? USER_AGENT_PRESETS[uaPreset as keyof typeof USER_AGENT_PRESETS]
          : '',
      language: spoofLanguage === 'system' ? '' : spoofLanguage,
      timezone: spoofTimezone === 'system' ? '' : spoofTimezone,
      roundScreen,
    };

    const securityGuardsScript = PolicyEngine.getInjectedScript(resolvedPolicy);

    const privacyScript = PrivacyManager.getPrivacyInjectedScript({
      sendGpc,
      blockWebRtc: true,
      reduceFingerprinting,
    });
    const blockerScript = BlockerEngine.getBlockerInjectedScript(blockAds, false);
    const desktopViewportScript = activeTab.desktopMode
      ? `
      (function() {
        try {
          var meta = document.querySelector('meta[name="viewport"]');
          if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'viewport';
            document.head.appendChild(meta);
          }
          meta.content = 'width=1280, initial-scale=1.0';
        } catch(e) {}
      })();
    `
      : '';
    return `
      if (window.__pb_installed) {
        true;
      } else {
        window.__pb_installed = true;
        ${desktopViewportScript}
        ${darkThemeScript}
        ${privacyScript}
        ${blockerScript}
        ${securityGuardsScript}
        ${mediaAndVoiceScript}
        ${pagePreviewScript}
        ${INJECTED_VIDEO_DETECTOR_SCRIPT}
        true;
      }
    `;
  }, [
    activeTab.desktopMode,
    blockAds,
    sendGpc,
    theme.isDark,
    hostDisplay,
    globalJs,
    blockThirdPartyScripts,
    blockAutoplay,
    blockLocalNetwork,
    imagesEnabled,
    blockWebFonts,
    blockServiceWorkers,
    blockBeacons,
    blockClipboardRead,
    detectInsecureForms,
    reduceFingerprinting,
    httpsOnly,
    uaPreset,
    customUa,
    spoofLanguage,
    spoofTimezone,
    roundScreen,
  ]);

  // Dynamically update active webviews when theme changes
  useEffect(() => {
    const isDark = Boolean(theme.isDark);
    const mode = isDark ? 'dark' : 'light';
    const dynScript = `
      (function() {
        try {
          var meta = document.querySelector('meta[name="color-scheme"]');
          if (meta) meta.content = '${mode}';
          if (document.documentElement) {
            document.documentElement.style.colorScheme = '${mode}';
            if (${isDark}) {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
          }
        } catch(e) {}
      })();
      true;
    `;
    Object.values(webViewRefs.current).forEach((ref) => {
      ref?.injectJavaScript?.(dynScript);
    });
  }, [theme.isDark]);

  // Handle messages from WebView (tracker blocked, video detected, drm)
  function handleWebViewMessage(event: any, tabId?: string) {
    const targetId = tabId || activeTab.id;
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'pb_tracker_blocked') {
        incrementBlockedCount(targetId);
      } else if (msg.type === 'pb_video_detected') {
        VideoRegistry.registerDetected({
          ...msg.data,
          tabId: targetId,
        });
      } else if (msg.type === 'pb_drm_detected') {
        console.log('DRM detected in page:', msg.keySystem);
      } else if (msg.type === 'pb_page_metadata') {
        if (msg.data) {
          updateTab(targetId, {
            previewImage: msg.data.previewImage || undefined,
            description: msg.data.description || undefined,
          });
        }
      } else if (msg.type === 'pb_external_scheme_attempt') {
        if (msg.url && targetId === activeTabId) {
          promptExternalAppRedirect(msg.url);
        }
      } else if (msg.type === 'pb_insecure_form_detected') {
        if (detectInsecureForms && targetId === activeTabId) {
          setBrowserNotice({
            visible: true,
            title: 'Insecure Form Alert (HTTP)',
            message: `Warning: This webpage is submitting form data to an unencrypted destination:\n${msg.action || 'HTTP target'}\n\nYour submitted credentials or personal data could be intercepted on the network.`,
          });
        }
      } else if (msg.type === 'pb_clipboard_read_blocked') {
        if (targetId === activeTabId) {
          setBrowserNotice({
            visible: true,
            title: 'Clipboard Read Blocked',
            message: `The website at ${msg.host || 'current page'} attempted to silently read your device clipboard. Access was denied (PRM-3).`,
          });
        }
      }
    } catch {}
  }

  const lastPromptUrlRef = useRef<string>('');
  const lastPromptTimeRef = useRef<number>(0);

  const promptExternalAppRedirect = useCallback((targetUrl: string) => {
    const now = Date.now();
    if (lastPromptUrlRef.current === targetUrl && now - lastPromptTimeRef.current < 2000) {
      return;