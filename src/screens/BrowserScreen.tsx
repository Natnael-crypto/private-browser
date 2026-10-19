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
    }
    lastPromptUrlRef.current = targetUrl;
    lastPromptTimeRef.current = now;

    let scheme = '';
    try {
      scheme = targetUrl.split(':')[0].toLowerCase();
    } catch {
      scheme = 'app';
    }

    let appName = 'External Application';
    const lower = targetUrl.toLowerCase();
    if (lower.includes('tiktok') || lower.includes('snssdk') || lower.includes('aweme') || lower.includes('musically')) {
      appName = 'TikTok';
    } else if (lower.includes('instagram')) {
      appName = 'Instagram';
    } else if (lower.includes('twitter') || lower.includes('x.com')) {
      appName = 'X (Twitter)';
    } else if (lower.includes('youtube') || scheme === 'vnd.youtube') {
      appName = 'YouTube';
    } else if (lower.includes('reddit')) {
      appName = 'Reddit';
    } else if (lower.includes('whatsapp')) {
      appName = 'WhatsApp';
    } else if (lower.includes('telegram') || scheme === 'tg') {
      appName = 'Telegram';
    } else if (lower.includes('facebook') || lower.includes('fb-messenger') || scheme === 'fb') {
      appName = 'Facebook';
    } else if (lower.includes('spotify')) {
      appName = 'Spotify';
    } else if (lower.includes('market') || lower.includes('play.google')) {
      appName = 'App Store';
    } else {
      appName = scheme ? `${scheme.toUpperCase()} App` : 'External App';
    }

    setRedirectModalData({
      visible: true,
      appName,
      targetUrl,
    });
  }, []);

  async function handleConfirmRedirect() {
    if (!redirectModalData) return;
    const { appName, targetUrl } = redirectModalData;
    setRedirectModalData(null);
    try {
      let openableUrl = targetUrl;
      if (targetUrl.startsWith('intent://')) {
        const schemeMatch = targetUrl.match(/scheme=([^;]+)/);
        if (schemeMatch && schemeMatch[1]) {
          const innerScheme = schemeMatch[1];
          const pathPart = targetUrl.slice('intent://'.length).split('#')[0];
          openableUrl = `${innerScheme}://${pathPart}`;
        }
      }

      const canOpen = await Linking.canOpenURL(openableUrl).catch(() => false);
      if (canOpen) {
        await Linking.openURL(openableUrl);
      } else {
        const canOpenOrig = await Linking.canOpenURL(targetUrl).catch(() => false);
        if (canOpenOrig) {
          await Linking.openURL(targetUrl);
        } else {
          setBrowserNotice({
            visible: true,
            title: 'App Not Installed',
            message: `The ${appName} application is not installed on your phone.`,
          });
        }
      }
    } catch {
      setBrowserNotice({
        visible: true,
        title: 'Unable to Open',
        message: `Could not open ${appName}. The app may not be installed.`,
      });
    }
  }

  function handleShouldStartLoadWithRequest(request: { url: string; isTopFrame?: boolean }): boolean {
    const url = request.url;
    if (!url) return false;
    const isTop = request.isTopFrame !== false;

    DebugLogger.nav('shouldStartLoadWithRequest', { url, isTopFrame: request.isTopFrame });

    // Block top-level data: and blob: navigations if blockDriveByNav is on (NAV-7)
    if (isTop && (url.startsWith('data:') || url.startsWith('blob:'))) {
      if (blockDriveByNav) {
        DebugLogger.nav('blockDriveByNav', { url });
        return false;
      }
    }

    // javascript: pseudo-protocol: ignore silently without external app prompt
    if (url.startsWith('javascript:')) {
      return false;
    }

    // Standard web protocols allowed inside the browser
    if (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('about:') ||
      url.startsWith('data:') ||
      url.startsWith('blob:')
    ) {
      if (warnRiskyDownloads) {
        const lower = url.toLowerCase().split('?')[0];
        const riskyExts = ['.apk', '.exe', '.dmg', '.msi', '.bat', '.sh', '.iso'];
        if (riskyExts.some((ext) => lower.endsWith(ext))) {
          setBrowserNotice({
            visible: true,
            title: 'Suspicious Download Blocked',
            message: `This website attempted to download an executable file:\n\n${url}\n\nExecutable downloads may compromise your device. Navigation was blocked for your safety.`,
          });
          return false;
        }
      }
      return true;
    }

    // Sub-frames (ad iframes) with custom schemes should never trigger external app prompt
    if (!isTop) {
      return false;
    }

    // If external app redirects confirmation is disabled, block silently
    if (!confirmAppRedirects) {
      return false;
    }

    // Intercept custom external schemes (snssdk1340://, tiktok://, intent://, etc.)
    promptExternalAppRedirect(url);
    return false;
  }

  function handleNavigateSubmit(targetText?: string) {
    const query = (targetText ?? urlInput).trim();
    if (!query) {
      setIsEditingBottomUrl(false);
      setSuggestions([]);
      return;
    }
    resetBlockedCount(activeTab.id);
    VideoRegistry.clearCurrentPage();
    navigateTab(activeTab.id, query);
    setUrlInput('');
    setSuggestions([]);
    setIsEditingBottomUrl(false);
  }

  function handleShare() {
    if (activeTab.url && !activeTab.isBlank) {
      Share.share({
        url: activeTab.url,
        message: activeTab.title ? `${activeTab.title}: ${activeTab.url}` : activeTab.url,
      });
    }
  }

  function handleReload() {
    resetBlockedCount(activeTab.id);
    VideoRegistry.clearCurrentPage();
    updateTab(activeTab.id, { loadError: null });
    reloadTab(activeTab.id);
    const ref = webViewRefs.current[activeTab.id];
    if (ref) {
      ref.reload();
    }
  }

  function handleSiteBroken() {
    setShieldModalVisible(false);
    setSiteBrokenConfirmVisible(true);
  }

  function handleVoiceSearch() {
    setUrlInput('');
    setSuggestions([]);
    if (searchEngine === 'Google') {
      navigateTab(activeTab.id, 'https://www.google.com/?source=voice&pb_voice=1');
    } else if (searchEngine === 'Bing') {
      navigateTab(activeTab.id, 'https://www.bing.com/?pb_voice=1');
    } else if (searchEngine === 'DuckDuckGo') {
      navigateTab(activeTab.id, 'https://duckduckgo.com/?q=&pb_voice=1');
    } else if (searchEngine === 'Brave') {
      navigateTab(activeTab.id, 'https://search.brave.com/?pb_voice=1');
    } else {
      navigateTab(activeTab.id, 'https://www.ecosia.org/?pb_voice=1');
    }
  }

  function handleCameraSearch() {
    setUrlInput('');
    setSuggestions([]);
    if (searchEngine === 'Google') {
      navigateTab(activeTab.id, 'https://lens.google.com/');
    } else if (searchEngine === 'Bing') {
      navigateTab(activeTab.id, 'https://www.bing.com/visualsearch');
    } else if (searchEngine === 'DuckDuckGo') {
      navigateTab(activeTab.id, 'https://duckduckgo.com/?ia=images&iax=images');
    } else if (searchEngine === 'Brave') {
      navigateTab(activeTab.id, 'https://search.brave.com/images');
    } else {
      navigateTab(activeTab.id, 'https://www.ecosia.org/images');
    }
  }

  if (!ok) return null;

  return (
    <View style={{ flex: 1, backgroundColor: activeTab.isBlank ? '#090b14' : (theme.isDark ? '#000000' : '#fff') }}>
      <StatusBar style={activeTab.isBlank ? 'light' : 'dark'} />

      {/* Main WebView or Blank Page */}
      <View
        style={{
          flex: 1,
          backgroundColor: activeTab.isBlank ? '#090b14' : (theme.isDark ? '#000000' : '#fff'),
        }}
      >
        {/* Loading Progress Bar */}
        {activeTab.isLoading && (
          <View style={[s.progressBarTrack, { top: activeTab.isBlank ? 0 : (Platform.OS === 'android' ? 36 : 52), zIndex: 10 }]}>
            <View style={[s.progressBarFill, { width: `${Math.min(100, Math.max(10, activeTab.progress * 100))}%` }]} />
          </View>
        )}

        {/* Tab WebViews Container - Keeps background tabs alive in memory, unmounted on lock (SEC-6) */}
        {!isLocked && tabs.map((tab) => {
          if (tab.isBlank && !tab.homeForward) return null;
          const isActive = tab.id === activeTabId && !tab.isBlank;
          const remountKey = webViewRemountKeys[tab.id] || 0;
          return (
            <View
              key={`${tab.id}-${remountKey}`}
              style={[
                StyleSheet.absoluteFill,
                {
                  paddingTop: Platform.OS === 'android' ? 36 : 52,
                  paddingBottom: bottomBarHeight,
                  display: isActive ? 'flex' : 'none',
                },
              ]}
              pointerEvents={isActive ? 'auto' : 'none'}
            >
              {tab.loadRequest && (
                <WebView
                  ref={(r) => {
                    if (r) {
                      webViewRefs.current[tab.id] = r;
                    } else {
                      delete webViewRefs.current[tab.id];
                    }
                  }}
                  source={{ uri: tab.loadRequest.url }}
                  forceDarkOn={theme.isDark}
                  injectedJavaScriptBeforeContentLoaded={combinedInjectedJavaScript}
                  onMessage={(e) => handleWebViewMessage(e, tab.id)}
                  onLoadStart={() => {
                    DebugLogger.load('onLoadStart', { tabId: tab.id, url: tab.loadRequest?.url });
                    updateTab(tab.id, { isLoading: true, progress: 0.15, loadError: null });
                    if (tab.id === activeTabId) {
                      VideoRegistry.clearCurrentPage();
                    }
                  }}
                  onLoadProgress={({ nativeEvent }: any) => {
                    updateTab(tab.id, { progress: nativeEvent.progress });
                  }}
                  onLoadEnd={() => {
                    DebugLogger.load('onLoadEnd', { tabId: tab.id });
                    updateTab(tab.id, { isLoading: false, progress: 1.0 });
                    webViewRefs.current[tab.id]?.injectJavaScript(
                      '(function(){ if (window.__pb_scan) window.__pb_scan(); })(); true;'
                    );
                  }}
                  onNavigationStateChange={(navState: any) => {
                    if (!navState.url) return;
                    if (navState.url === 'about:blank') return;
                    DebugLogger.nav('onNavigationStateChange', {
                      url: navState.url,
                      canGoBack: navState.canGoBack,
                      canGoForward: navState.canGoForward,
                    });

                    updateTab(tab.id, {
                      currentUrl: navState.url,
                      url: navState.url,
                      title: navState.title || navState.url,
                      canGoBack: Boolean(navState.canGoBack),
                      canGoForward: Boolean(navState.canGoForward),
                    });
                  }}
                  onError={(syntheticEvent) => {
                    const { nativeEvent } = syntheticEvent;
                    const failingUrl = (nativeEvent as any).failingUrl || (nativeEvent as any).url || tab.currentUrl;
                    DebugLogger.load('onError', { code: nativeEvent.code, description: nativeEvent.description, failingUrl });
                    updateTab(tab.id, {
                      isLoading: false,
                      loadError: {
                        code: nativeEvent.code,
                        description: nativeEvent.description || "Can't open page",
                        failingUrl,
                      },
                    });
                  }}
                  onHttpError={(syntheticEvent) => {
                    const { nativeEvent } = syntheticEvent;
                    DebugLogger.load('onHttpError', { statusCode: nativeEvent.statusCode, url: nativeEvent.url });
                    if (nativeEvent.statusCode >= 400) {
                      updateTab(tab.id, {
                        isLoading: false,
                        loadError: {
                          code: nativeEvent.statusCode,
                          description: `Server returned HTTP ${nativeEvent.statusCode}`,
                          failingUrl: nativeEvent.url || tab.currentUrl,
                        },
                      });
                    }
                  }}
                  onRenderProcessGone={() => {
                    DebugLogger.load('onRenderProcessGone', { tabId: tab.id });
                    updateTab(tab.id, {
                      isLoading: false,
                      loadError: {
                        description: 'The web rendering process crashed unexpectedly.',
                        failingUrl: tab.currentUrl,
                      },
                    });
                    setWebViewRemountKeys((prev) => ({ ...prev, [tab.id]: (prev[tab.id] || 0) + 1 }));
                  }}
                  onContentProcessDidTerminate={() => {
                    DebugLogger.load('onContentProcessDidTerminate', { tabId: tab.id });
                    updateTab(tab.id, {
                      isLoading: false,
                      loadError: {
                        description: 'The web content process was terminated by the system.',
                        failingUrl: tab.currentUrl,
                      },
                    });
                    setWebViewRemountKeys((prev) => ({ ...prev, [tab.id]: (prev[tab.id] || 0) + 1 }));
                  }}
                  setSupportMultipleWindows={true}
                  onOpenWindow={(syntheticEvent) => {
                    const { targetUrl } = syntheticEvent.nativeEvent;
                    if (targetUrl) {
                      createTab(targetUrl);
                    }
                  }}
                  allowsFullscreenVideo
                  allowsInlineMediaPlayback
                  mediaPlaybackRequiresUserAction={blockAutoplay}
                  mediaCapturePermissionGrantType="prompt"
                  incognito={true}
                  thirdPartyCookiesEnabled={!blockCookies}
                  sharedCookiesEnabled={!blockCookies}
                  javaScriptEnabled={globalJs}
                  userAgent={
                    tab.desktopMode
                      ? USER_AGENT_PRESETS.chrome_win
                      : uaPreset === 'custom' && customUa
                      ? customUa
                      : uaPreset in USER_AGENT_PRESETS && USER_AGENT_PRESETS[uaPreset as keyof typeof USER_AGENT_PRESETS]
                      ? USER_AGENT_PRESETS[uaPreset as keyof typeof USER_AGENT_PRESETS]
                      : undefined
                  }
                  domStorageEnabled
                  originWhitelist={['*']}
                  onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
                  style={{ flex: 1 }}
                />
              )}

              {/* In-app error view (NAV-6) */}
              {tab.loadError && (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      backgroundColor: theme.isDark ? '#000' : '#fff',
                      justifyContent: 'center',
                      alignItems: 'center',
                      padding: 24,
                      zIndex: 20,
                    },
                  ]}
                >
                  <Svg width={44} height={44} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2} style={{ marginBottom: 16 }}>
                    <Path d="M12 9v4M12 17h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </Svg>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: theme.isDark ? '#fff' : '#000', marginBottom: 8, textAlign: 'center' }}>
                    {"Can't open page"}
                  </Text>
                  <Text style={{ fontSize: 14, color: theme.isDark ? '#aaa' : '#666', textAlign: 'center', marginBottom: 12 }}>
                    {tab.loadError.description}
                  </Text>
                  {Boolean(tab.loadError.failingUrl) && (
                    <Text style={{ fontSize: 12, color: '#888', textAlign: 'center', marginBottom: 20 }} numberOfLines={2}>
                      {tab.loadError.failingUrl}
                    </Text>
                  )}
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <Pressable
                      style={{ backgroundColor: '#0d74ce', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
                      onPress={() => {
                        updateTab(tab.id, { loadError: null });
                        reloadTab(tab.id);
                      }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Retry</Text>
                    </Pressable>
                    <Pressable
                      style={{ backgroundColor: theme.isDark ? '#27272a' : '#e4e4e7', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
                      onPress={() => updateTab(tab.id, { isBlank: true, loadError: null })}
                    >
                      <Text style={{ color: theme.isDark ? '#fff' : '#000', fontWeight: '600', fontSize: 14 }}>Go Home</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          );
        })}

        {/* Start / Home Screen when active tab is blank */}
        {activeTab.isBlank && (
          <ImageBackground
            // source={require('../../assets/home-bg.jpg')}
            source={require('../../assets/home-bg-2.png')}
            style={s.blankBg}
            resizeMode="cover"
          >
            <View style={s.blankOverlay} />
            <ScrollView
              contentContainerStyle={s.blankContainer}
              showsVerticalScrollIndicator={false}
            >

              {/* On-Screen Chrome Search Bar (Direct Inline Input) */}
              <View style={[s.chromeSearchBar, { backgroundColor: theme.isDark ? '#202124' : '#ffffff', borderColor: theme.isDark ? '#3c4043' : 'transparent', borderWidth: theme.isDark ? 1 : 0 }]}>
                <View style={s.chromeSearchLeft}>
                  <Pressable
                    hitSlop={8}
                    onPress={() => setSearchEngineModalVisible(true)}
                    accessibilityLabel="Select search engine"
                    style={{ marginRight: 8, justifyContent: 'center', alignItems: 'center' }}
                  >
                    <SearchEngineIcon engine={searchEngine} size={22} />
                  </Pressable>
                  <TextInput
                    value={urlInput}
                    onChangeText={setUrlInput}
                    placeholder="Search or type URL"
                    placeholderTextColor={theme.isDark ? '#9aa0a6' : '#5f6368'}
                    keyboardType={privateKeyboard ? (Platform.OS === 'android' ? 'visible-password' : 'url') : 'web-search'}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="off"
                    importantForAutofill="no"
                    spellCheck={false}
                    returnKeyType="search"
                    onSubmitEditing={() => handleNavigateSubmit()}
                    style={[s.chromeSearchInput, { color: theme.isDark ? '#ffffff' : '#202124' }]}
                  />
                </View>

                <View style={s.chromeSearchActions}>
                  {urlInput.length > 0 ? (
                    <Pressable
                      hitSlop={8}
                      onPress={() => {
                        setUrlInput('');
                        setSuggestions([]);
                      }}
                      style={{ padding: 4 }}
                    >
                      <Ic n="x" c={theme.isDark ? '#9aa0a6' : '#5f6368'} s={18} />
                    </Pressable>
                  ) : (
                    <>
                      <Pressable
                        hitSlop={8}
                        onPress={handleVoiceSearch}
                        accessibilityLabel="Voice search"
                        style={{ padding: 4 }}
                      >
                        <MicIcon size={20} color={theme.isDark ? '#9aa0a6' : '#5f6368'} />
                      </Pressable>
                      <Pressable
                        hitSlop={8}
                        onPress={handleCameraSearch}
                        accessibilityLabel="Google Lens camera search"
                        style={{ padding: 4 }}
                      >
                        <LensIcon size={20} color={theme.isDark ? '#9aa0a6' : '#5f6368'} />
                      </Pressable>
                    </>
                  )}
                </View>
              </View>

              {/* On-Screen Google Autocomplete Suggestions */}
              {urlInput.length > 0 && suggestions.length > 0 && (
                <View style={[s.homeSuggestionsCard, { backgroundColor: theme.isDark ? '#202124' : '#ffffff', borderColor: theme.isDark ? '#3c4043' : 'transparent', borderWidth: theme.isDark ? 1 : 0 }]}>
                  <ScrollView
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    style={{ maxHeight: 220 }}
                  >
                    {suggestions.map((item, idx) => (
                      <View key={`${item}-${idx}`} style={[s.homeSuggestionRow, idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.isDark ? '#3c4043' : 'rgba(60,60,67,0.12)' }]}>
                        <Pressable
                          style={s.homeSuggestionMain}
                          onPress={() => handleNavigateSubmit(item)}
                        >
                          <Ic n="search" c={theme.isDark ? '#9aa0a6' : '#5f6368'} s={16} />
                          <T numberOfLines={1} style={[s.homeSuggestionText, { color: theme.isDark ? '#e8eaed' : '#202124' }]}>
                            {item}
                          </T>
                        </Pressable>
                        <Pressable
                          style={s.suggestionFillBtn}
                          hitSlop={8}
                          onPress={() => setUrlInput(item)}
                        >
                          <Ic n="fwd" c={theme.isDark ? '#9aa0a6' : C.gray} s={14} w={2} />
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}
            </ScrollView>
          </ImageBackground>
        )}
      </View>


      {/* Bottom Bar: Address Capsule & Navigation Controls */}
      <View
        onLayout={(e) => {
          const { height } = e.nativeEvent.layout;
          if (height > 50 && Math.abs(height - bottomBarHeight) > 1) {
            setBottomBarHeight(height);
          }
        }}
        style={[
          s.bar,
          {
            backgroundColor: theme.isDark ? '#1c1c1e' : 'rgba(247,247,249,0.95)',
            borderTopColor: theme.isDark ? '#2c2c2e' : 'rgba(60,60,67,0.22)',
          },
        ]}
      >
        <View style={[s.cap, { backgroundColor: theme.isDark ? '#2c2c2e' : C.fill }]}>
          {/* Shield & Blocked Count */}
          <Pressable
            accessibilityLabel={`Blocker: ${activeTab.blockedCount} blocked`}
            style={s.capLeft}
            onPress={() => setShieldModalVisible(true)}
          >
            <Ic n="sh" c={theme.sec} s={18} />
            <T style={{ fontSize: 14, color: theme.sec, fontFamily: F.m }}>{activeTab.blockedCount}</T>
          </Pressable>

          {/* Center Address Host / Inline Input */}
          <View style={s.capCenter}>
            {isEditingBottomUrl ? (
              <TextInput
                value={urlInput}
                onChangeText={setUrlInput}
                autoFocus
                placeholder="Search or enter website"
                placeholderTextColor={theme.sec}
                keyboardType={privateKeyboard ? (Platform.OS === 'android' ? 'visible-password' : 'url') : 'web-search'}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                importantForAutofill="no"
                spellCheck={false}
                returnKeyType="search"
                onSubmitEditing={() => handleNavigateSubmit()}
                style={[s.capTextInput, { color: theme.text }]}
              />
            ) : (
              <Pressable
                style={s.capCenterTouchable}
                onPress={() => {
                  setUrlInput(activeTab.isBlank ? '' : activeTab.url);
                  setIsEditingBottomUrl(true);
                }}
              >
                <Ic n="lock" c={theme.isDark ? '#8e8e93' : '#000'} s={13} w={2.2} />
                <T numberOfLines={1} style={{ fontSize: 16, fontFamily: F.m, color: theme.text }}>
                  {hostDisplay}
                </T>
              </Pressable>
            )}

            {isEditingBottomUrl && urlInput.length > 0 && (
              <Pressable
                onPress={() => {
                  setUrlInput('');
                  setSuggestions([]);
                }}
                style={{ padding: 4 }}
              >
                <Ic n="x" c={theme.sec} s={16} />
              </Pressable>
            )}
          </View>

          {/* Reload or Cancel Button */}
          {isEditingBottomUrl ? (
            <Pressable
              hitSlop={8}
              onPress={() => {
                setIsEditingBottomUrl(false);
                setSuggestions([]);
                setUrlInput('');
              }}
              style={{ paddingHorizontal: 4 }}
            >
              <T style={{ color: theme.blue, fontFamily: F.s, fontSize: 14 }}>Cancel</T>
            </Pressable>
          ) : (
            <Pressable
              accessibilityLabel={activeTab.isLoading ? 'Stop' : 'Reload'}
              onPress={handleReloadOrStop}
              hitSlop={8}
            >
              {activeTab.isLoading ? (
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={theme.isDark ? '#8e8e93' : '#000'} strokeWidth={2.5}>
                  <Path d="M18 6L6 18M6 6l12 12" />
                </Svg>
              ) : (
                <Ic n="rl" c={theme.isDark ? '#8e8e93' : '#000'} s={18} />
              )}
            </Pressable>
          )}
        </View>

        {/* Bottom Toolbar: Back, Forward, Share, Downloads, Bookmarks, Tabs, Settings */}
        <View style={s.tb}>
          <Pressable
            accessibilityLabel="Back"
            disabled={!canGoBack}
            onPress={handleBack}
          >
            <Ic n="back" c={canGoBack ? theme.blue : (theme.isDark ? '#48484a' : C.gray)} s={24} />
          </Pressable>

          <Pressable
            accessibilityLabel="Forward"
            disabled={!canGoForward}
            onPress={handleForward}
          >
            <Ic n="fwd" c={canGoForward ? theme.blue : (theme.isDark ? '#48484a' : C.gray)} s={24} />
          </Pressable>

          <Pressable accessibilityLabel="Share" onPress={handleShare}>
            <Ic n="share" c={theme.blue} s={22} />
          </Pressable>

          <Pressable
            accessibilityLabel="Downloads"
            onPress={onOpenDownloads}
            style={s.dlBtnWrap}
          >
            <Ic n="dl" c={theme.blue} s={22} w={2} />
            {activeDownloadCount > 0 && (
              <View style={s.dlBadge}>
                <T style={s.dlBadgeText}>{activeDownloadCount}</T>
              </View>
            )}
          </Pressable>

          <Pressable accessibilityLabel="Bookmarks" onPress={onOpenBookmarks}>
            <Ic n="book" c={theme.blue} s={22} />
          </Pressable>

          <Pressable accessibilityLabel="Tabs" onPress={onOpenTabs}>
            <Ic n="tabs" c={theme.blue} s={22} />
          </Pressable>

          <Pressable accessibilityLabel="Settings" onPress={onOpenSettings}>
            <Ic n="gear" c={theme.blue} s={22} />
          </Pressable>
        </View>
      </View>

      {/* Floating Active Download Speed Pill (Section 6.2) */}
      {activeDownloadCount > 0 && !isEditingBottomUrl && (
        <Pressable
          style={[
            s.floatingSpeedPill,
            {
              bottom: bottomBarHeight + 12,
              backgroundColor: theme.isDark ? '#1c1c1e' : '#ffffff',
              borderColor: theme.blue,
            },
          ]}
          onPress={onOpenDownloads}
          accessibilityLabel="Active downloads"
        >
          <Ic n="speed" s={13} c={theme.blue} />
          <T style={[s.floatingSpeedText, { color: theme.blue }]}>
            {activeDownloadSpeed > 0 ? DownloadManager.formatSpeed(activeDownloadSpeed) : 'Downloading...'}
          </T>
          <View style={s.floatingSpeedBadge}>
            <T style={s.floatingSpeedBadgeText}>{activeDownloadCount}</T>
          </View>
        </Pressable>
      )}

      {/* Floating Video Detector Button (Bottom Right) */}
      {detectedVideos.length > 0 && !isEditingBottomUrl && (
        <View style={[s.videoFabWrap, { bottom: bottomBarHeight + 12 }]} pointerEvents="box-none">
          <Pressable
            style={({ pressed }) => [
              s.videoFab,
              { backgroundColor: theme.blue, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={onOpenVideosSheet}
            hitSlop={8}
            accessibilityLabel={`${detectedVideos.length} video${detectedVideos.length === 1 ? '' : 's'} detected`}
          >
            <Ic n="dl" c="#fff" s={22} w={2.2} />
            {detectedVideos.length > 0 && (
              <View style={[s.videoFabBadge, { backgroundColor: theme.red }]}>
                <T style={s.videoFabBadgeText}>{detectedVideos.length}</T>
              </View>
            )}
          </Pressable>
        </View>
      )}

      {/* Floating Suggestions Card above Bottom Bar when editing */}
      {isEditingBottomUrl && suggestions.length > 0 && (
        <View
          style={[
            s.bottomSuggestionsFloat,
            {
              bottom: bottomBarHeight + 6,
              backgroundColor: theme.isDark ? '#202124' : '#ffffff',
              borderColor: theme.isDark ? '#3c4043' : 'transparent',
              borderWidth: theme.isDark ? 1 : 0,
            },
          ]}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 200 }}
          >
            {suggestions.map((item, idx) => (
              <View key={`${item}-${idx}`} style={[s.homeSuggestionRow, idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.isDark ? '#3c4043' : 'rgba(60,60,67,0.12)' }]}>
                <Pressable
                  style={s.homeSuggestionMain}
                  onPress={() => handleNavigateSubmit(item)}
                >
                  <Ic n="search" c={theme.isDark ? '#9aa0a6' : '#5f6368'} s={16} />
                  <T numberOfLines={1} style={[s.homeSuggestionText, { color: theme.isDark ? '#e8eaed' : '#202124' }]}>{item}</T>
                </Pressable>
                <Pressable
                  style={s.suggestionFillBtn}
                  hitSlop={8}
                  onPress={() => setUrlInput(item)}
                >
                  <Ic n="fwd" c={theme.isDark ? '#9aa0a6' : C.gray} s={14} w={2} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Shield Info / Allowlist Modal */}
      <ActionSheetModal
        visible={shieldModalVisible}
        title="Protection Shield"
        message={`${activeTab.blockedCount} trackers and advertisements blocked on this page.`}
        cancelText="Done"
        onClose={() => setShieldModalVisible(false)}
        options={[
          {
            text: 'Site broken? Reload without blocking',
            icon: 'rl',
            onPress: handleSiteBroken,
          },
          {
            text: 'View Downloads & Saved Videos',
            icon: 'dl',
            onPress: () => {
              setShieldModalVisible(false);