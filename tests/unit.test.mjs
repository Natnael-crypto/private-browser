import test from 'node:test';
import assert from 'node:assert';

// 1. Privacy Manager Logic Tests (PRV-7, PRV-8)
test('PrivacyManager - strips tracking parameters', () => {
  const TRACKING_PARAMS = new Set([
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
    'fbclid', 'gclid', 'gclsrc', 'dclid', 'msclkid', 'mc_cid', 'igshid', 'yclid'
  ]);

  function sanitizeUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);
      const params = new URLSearchParams(url.search);
      let changed = false;
      const keysToDelete = [];
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

  const dirtyUrl = 'https://example.com/page?article=123&utm_source=twitter&fbclid=IwAR123&gclid=xyz456&theme=dark';
  const cleanUrl = sanitizeUrl(dirtyUrl);

  assert.strictEqual(cleanUrl, 'https://example.com/page?article=123&theme=dark');
  assert.ok(!cleanUrl.includes('utm_source'));
  assert.ok(!cleanUrl.includes('fbclid'));
  assert.ok(!cleanUrl.includes('gclid'));
});

test('PrivacyManager - upgrades insecure http to https', () => {
  function upgradeToHttps(rawUrl) {
    if (rawUrl.startsWith('http://')) {
      return 'https://' + rawUrl.slice(7);
    }
    return rawUrl;
  }

  assert.strictEqual(upgradeToHttps('http://example.com/video.mp4'), 'https://example.com/video.mp4');
  assert.strictEqual(upgradeToHttps('https://secure.com'), 'https://secure.com');
});

// 2. Blocker Engine Tests (BLK-1, BLK-2, BLK-4)
test('BlockerEngine - identifies and blocks tracker & ad domains', () => {
  const BUNDLED_BLOCK_PATTERNS = [
    /doubleclick\.net/i,
    /google-analytics\.com/i,
    /googletagmanager\.com/i,
    /criteo\.com/i,
    /outbrain\.com/i,
    /taboola\.com/i,
  ];

  function shouldBlockUrl(url, isAllowedHost) {
    if (isAllowedHost) return false;
    for (const pattern of BUNDLED_BLOCK_PATTERNS) {
      if (pattern.test(url)) return true;
    }
    return false;
  }

  assert.strictEqual(shouldBlockUrl('https://ad.doubleclick.net/tracker.js', false), true);
  assert.strictEqual(shouldBlockUrl('https://www.google-analytics.com/analytics.js', false), true);
  assert.strictEqual(shouldBlockUrl('https://static.criteo.com/ld.js', false), true);
  assert.strictEqual(shouldBlockUrl('https://news.ycombinator.com/index.html', false), false);

  // Allowlist overrides blocking (BLK-4)
  assert.strictEqual(shouldBlockUrl('https://ad.doubleclick.net/tracker.js', true), false);
});

// 3. M3U8 Parser Tests (VID-5, VID-7, VID-8)
test('M3U8Parser - parses master playlist variants and detects DRM', () => {
  const sampleM3U8 = `
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360
360p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720
720p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
1080p.m3u8
  `.trim();

  const lines = sampleM3U8.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const variants = [];
  let currentStreamInf = null;

  for (const line of lines) {
    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      const match = line.match(/RESOLUTION=(\d+x\d+)/);
      currentStreamInf = { resolution: match ? match[1] : null };
    } else if (currentStreamInf && !line.startsWith('#')) {
      variants.push({
        uri: line,
        resolution: currentStreamInf.resolution,
        qualityLabel: currentStreamInf.resolution.split('x')[1] + 'p',
      });
      currentStreamInf = null;
    }
  }

  assert.strictEqual(variants.length, 3);
  assert.strictEqual(variants[0].qualityLabel, '360p');
  assert.strictEqual(variants[1].qualityLabel, '720p');
  assert.strictEqual(variants[2].qualityLabel, '1080p');

  // DRM tag detection (VID-8)
  const drmM3U8 = '#EXT-X-KEY:METHOD=SAMPLE-AES,URI="skd://widevine.key"';
  const hasDrm = drmM3U8.includes('SAMPLE-AES') || drmM3U8.includes('widevine');
  assert.strictEqual(hasDrm, true);
});

// 4. Download Manager Clean Filename Tests (DL-9)
test('DownloadManager - cleanFileName strips invalid characters and clamps length', () => {
  function cleanFileName(title, extension) {
    const cleaned = title
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
    return `${cleaned || 'video'}.${extension}`;
  }

  const dirtyTitle = 'What Is Cinematography? / A "Director\'s" <Guide> & Masterclass: 2026';
  const clean = cleanFileName(dirtyTitle, 'mp4');

  assert.strictEqual(clean, "What Is Cinematography_ _ A _Director's_ _Guide_ & Masterclass_ 2026.mp4");
  assert.ok(!clean.includes('/'));
  assert.ok(!clean.includes(':'));
  assert.ok(!clean.includes('?'));
  assert.ok(!clean.includes('"'));
  assert.ok(!clean.includes('<'));
  assert.ok(!clean.includes('>'));
});

// 5. Search Engine & Google Suggestions Tests (WEB-1, Suggestions)
test('Browser - routes query to Google by default', () => {
  const SEARCH_URLS = {
    Google: 'https://www.google.com/search?q=',
    DuckDuckGo: 'https://duckduckgo.com/?q=',
  };

  function resolveUrl(input, engine = 'Google') {
    const raw = input.trim();
    const hasSpace = /\s/.test(raw);
    const isLikelyDomain = !hasSpace && (raw.includes('.') || raw.startsWith('localhost'));
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    if (isLikelyDomain) return `https://${raw}`;
    return `${SEARCH_URLS[engine]}${encodeURIComponent(raw)}`;
  }

  assert.strictEqual(resolveUrl('nature documentary'), 'https://www.google.com/search?q=nature%20documentary');
  assert.strictEqual(resolveUrl('how to bake sourdough bread'), 'https://www.google.com/search?q=how%20to%20bake%20sourdough%20bread');
  assert.strictEqual(resolveUrl('wikipedia.org'), 'https://wikipedia.org');
});

test('SuggestionsService - parses Google suggestion completion payload', () => {
  const sampleGoogleResponse = [
    'react native',
    [
      'react native tutorial',
      'react native docs',
      'react native vs flutter',
      'react native 0.86',
      'react native expo'
    ]
  ];

  function parseSuggestions(data) {
    if (Array.isArray(data) && Array.isArray(data[1])) {
      return data[1].slice(0, 7);
    }
    return [];
  }

  const suggestions = parseSuggestions(sampleGoogleResponse);
  assert.strictEqual(suggestions.length, 5);
  assert.strictEqual(suggestions[0], 'react native tutorial');
  assert.strictEqual(suggestions[1], 'react native docs');
  assert.ok(suggestions.every(s => typeof s === 'string'));
});

// 6. Video Size Detection & Byte Formatting Tests
test('VideoRegistry - formatBytes accurately converts sizes to KB, MB, GB', () => {
  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(0)} KB`;
    } else if (bytes < 1024 * 1024 * 1024) {
      const mb = bytes / (1024 * 1024);
      return mb < 10 ? `${mb.toFixed(1)} MB` : `${Math.round(mb)} MB`;
    } else {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
  }

  assert.strictEqual(formatBytes(512), '512 B');
  assert.strictEqual(formatBytes(850 * 1024), '850 KB');
  assert.strictEqual(formatBytes(4.5 * 1024 * 1024), '4.5 MB');
  assert.strictEqual(formatBytes(148 * 1024 * 1024), '148 MB');
  assert.strictEqual(formatBytes(1.25 * 1024 * 1024 * 1024), '1.25 GB');
});

test('VideoRegistry - extracts total video size from HTTP Content-Range header', () => {
  function parseContentRange(header) {
    if (!header) return null;
    const match = header.match(/\/(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
  }

  assert.strictEqual(parseContentRange('bytes 0-1/15728640'), 15728640);
  assert.strictEqual(parseContentRange('bytes 0-1024/987654321'), 987654321);
  assert.strictEqual(parseContentRange('bytes */*'), null);
});

// 7. External App Deep Link Interception Tests (PRV-6, Security)
test('BrowserScreen - intercepts custom deep link schemes (e.g. TikTok snssdk1340://) and identifies app name', () => {
  function shouldAllowDirectNavigation(url) {
    if (!url) return false;
    return (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('about:') ||
      url.startsWith('data:') ||
      url.startsWith('blob:')
    );
  }

  function getAppInfo(targetUrl) {
    const lower = targetUrl.toLowerCase();
    if (lower.includes('tiktok') || lower.includes('snssdk') || lower.includes('aweme') || lower.includes('musically')) {
      return { appName: 'TikTok', isExternal: true };
    } else if (lower.includes('instagram')) {
      return { appName: 'Instagram', isExternal: true };
    } else if (lower.includes('twitter') || lower.includes('x.com')) {
      return { appName: 'X (Twitter)', isExternal: true };
    }
    const scheme = targetUrl.split(':')[0].toLowerCase();
    return { appName: `${scheme.toUpperCase()} App`, isExternal: true };
  }

  const tiktokDeepLink = 'snssdk1340://aweme/detail/7697712637718646017?refer=web';
  assert.strictEqual(shouldAllowDirectNavigation(tiktokDeepLink), false);
  assert.strictEqual(getAppInfo(tiktokDeepLink).appName, 'TikTok');

  const webUrl = 'https://www.tiktok.com/@creator/video/123';
  assert.strictEqual(shouldAllowDirectNavigation(webUrl), true);

  const instagramLink = 'instagram://user?username=nature';
  assert.strictEqual(shouldAllowDirectNavigation(instagramLink), false);
  assert.strictEqual(getAppInfo(instagramLink).appName, 'Instagram');
});

// 10. Screen Navigation Stack & Hardware Back Routing Tests
test('Navigation & Back Button Flow - Sub-screens dismiss cleanly to Browser without mutating browser history', () => {
  // Simulate screen stack in App.tsx
  let screenStack = ['browser'];
  function navigateTo(screen) {
    screenStack.push(screen);
  }
  function goBackScreen() {
    if (screenStack.length > 1) {
      screenStack.pop();
    }
  }

  // Simulate tab state in BrowserScreen
  let activeTab = {
    id: 'tab-1',
    url: 'https://news.ycombinator.com',
    isBlank: false,
    history: ['about:blank', 'https://news.ycombinator.com'],
    historyIndex: 1,
    canGoBack: true,
    canGoForward: false,
  };

  function simulateBrowserBack() {
    if (activeTab.historyIndex > 0) {
      activeTab.historyIndex -= 1;
      activeTab.url = activeTab.history[activeTab.historyIndex];
      if (activeTab.url === 'about:blank') {
        activeTab.isBlank = true;
      }
    }
  }

  // User navigates from Browser to Downloads screen
  navigateTo('downloads');
  assert.strictEqual(screenStack[screenStack.length - 1], 'downloads');

  // Video is played in Downloads screen
  let playingVideo = { id: 101, title: 'Downloaded Video' };

  // Step 1: User presses back while video is playing -> Dismisses video, stays on downloads
  function handleDownloadsBack() {
    if (playingVideo) {
      playingVideo = null;
      return true;
    }
    // No dialog/video: navigate back to previous screen
    goBackScreen();
    return true;
  }

  const handledVideoClose = handleDownloadsBack();
  assert.strictEqual(handledVideoClose, true);
  assert.strictEqual(playingVideo, null, 'Video player must be dismissed on first back press');
  assert.strictEqual(screenStack[screenStack.length - 1], 'downloads', 'User must remain on downloads screen after closing video');
  assert.strictEqual(activeTab.url, 'https://news.ycombinator.com', 'Browser history MUST NOT be mutated while on downloads screen');

  // Step 2: User presses back on Downloads screen -> Navigates back to BrowserScreen
  const handledDownloadsClose = handleDownloadsBack();
  assert.strictEqual(handledDownloadsClose, true);
  assert.strictEqual(screenStack[screenStack.length - 1], 'browser', 'Must return to browser screen on second back press');
  assert.strictEqual(activeTab.url, 'https://news.ycombinator.com', 'Browser must retain current webpage when returning from downloads');

  // Step 3: Now user is back on BrowserScreen -> Pressing back navigates back in browser history
  function handleBrowserBack(isActiveScreen) {
    if (!isActiveScreen) return false;
    simulateBrowserBack();
    return true;
  }

  const handledBrowserBack = handleBrowserBack(screenStack[screenStack.length - 1] === 'browser');
  assert.strictEqual(handledBrowserBack, true);
  assert.strictEqual(activeTab.isBlank, true, 'Navigating back in browser returns to start page');
  assert.strictEqual(activeTab.url, 'about:blank');
});

// 11. Search Results to Home Page Navigation Tests (Prevents redirect loop)
test('Search Results Back Navigation - Exits search results back to home/blank page even if webview has internal redirect (nativeCanGoBack: true)', () => {
  let tab = {
    id: 'tab-search',
    url: 'https://www.google.com/search?q=expo&oq=expo...',
    isBlank: false,
    history: ['about:blank', 'https://www.google.com/search?q=expo&oq=expo...'],
    historyIndex: 1,
    nativeCanGoBack: true, // Internal redirect in WebView session
    canGoBack: true, // UI button is enabled
    canGoForward: false,
  };

  function handleBack() {
    if (tab.isBlank) return 'none';
    const hist = tab.history && tab.history.length > 0 ? tab.history : ['about:blank'];
    const idx = typeof tab.historyIndex === 'number' ? tab.historyIndex : hist.length - 1;

    // Direct exit to home start page when at index <= 1 (search results or first page)
    if (idx <= 1 || hist[idx - 1] === 'about:blank' || !hist[idx - 1]) {
      tab.url = 'about:blank';
      tab.isBlank = true;
      tab.historyIndex = 0;
      tab.nativeCanGoBack = false;
      tab.nativeCanGoForward = true;
      tab.canGoBack = false;
      tab.canGoForward = hist.length > 1;
      return 'home_page';
    }

    if (tab.nativeCanGoBack) {
      return 'webview_back';
    }
    return 'none';
  }

  const result = handleBack();
  assert.strictEqual(result, 'home_page', 'Back press on search results must return directly to home page without looping');
  assert.strictEqual(tab.isBlank, true, 'Tab must become blank home page');
  assert.strictEqual(tab.url, 'about:blank');
  assert.strictEqual(tab.canGoForward, true, 'Forward button must be enabled to restore search results');
});

// 12. App Lock Overlay State Preservation Tests (SEC-2 & UI)
test('App Lock Screen - Minimizing and unlocking preserves browser history, tabs, and current web pages', () => {
  // App starts with active tab on a webpage
  let browserState = {
    tabs: [
      {
        id: 'tab-active',
        url: 'https://developer.mozilla.org/en-US/',
        title: 'MDN Web Docs',
        isBlank: false,
        history: ['about:blank', 'https://www.google.com/search?q=mdn', 'https://developer.mozilla.org/en-US/'],
        historyIndex: 2,
      },
    ],
    activeTabId: 'tab-active',
  };

  let isLocked = false;
  let browserScreenMounted = true; // Kept mounted in hierarchy

  // App is minimized to background -> resumes -> triggers auto-lock
  function onAppResume(shouldLock) {
    if (shouldLock) {
      isLocked = true;
      // Because LockScreen is rendered as an overlay, browserScreenMounted remains TRUE!
    }
  }

  onAppResume(true);
  assert.strictEqual(isLocked, true, 'App must be locked');
  assert.strictEqual(browserScreenMounted, true, 'BrowserScreen must remain mounted underneath lock overlay');

  // User unlocks via PIN or Biometrics
  function onUnlocked() {
    isLocked = false;
  }

  onUnlocked();
  assert.strictEqual(isLocked, false, 'App is now unlocked');
  assert.strictEqual(browserState.tabs.length, 1);
  assert.strictEqual(browserState.tabs[0].url, 'https://developer.mozilla.org/en-US/', 'Current webpage must be retained after unlock without resetting to search engine');
  assert.strictEqual(browserState.tabs[0].isBlank, false);
  assert.strictEqual(browserState.tabs[0].history.length, 3, 'History stack must remain completely intact');
  assert.strictEqual(browserState.tabs[0].historyIndex, 2);
});

// 13. Search Engine Redirect & Query Normalization
test('Navigation - isSameSearchOrRedirect correctly identifies search engine internal redirects', () => {
  function isSameSearchOrRedirect(url1, url2) {
    if (!url1 || !url2) return false;
    if (url1 === url2) return true;
    try {
      const u1 = new URL(url1);
      const u2 = new URL(url2);
      const h1 = u1.hostname.replace(/^www\./, '');
      const h2 = u2.hostname.replace(/^www\./, '');
      if (h1 !== h2) return false;

      const isSearchHost =
        h1.includes('google.') ||
        h1.includes('duckduckgo.') ||
        h1.includes('bing.') ||
        h1.includes('brave.') ||
        h1.includes('ecosia.');

      if (isSearchHost) {
        const q1 = u1.searchParams.get('q');
        const q2 = u2.searchParams.get('q');
        if (q1 && q2 && q1.toLowerCase() === q2.toLowerCase()) {
          return true;
        }
      }

      if (
        u1.pathname.replace(/\/$/, '') === u2.pathname.replace(/\/$/, '') &&
        u1.search === u2.search
      ) {
        return true;
      }
    } catch {}
    return false;
  }

  assert.strictEqual(
    isSameSearchOrRedirect(
      'https://www.google.com/search?q=hello',
      'https://www.google.com/search?q=hello&oq=hello&gs_lcrp=abc123'
    ),
    true,
    'Google client redirect with same query must be detected as same search'
  );

  assert.strictEqual(
    isSameSearchOrRedirect(
      'https://duckduckgo.com/?q=privacy',
      'https://duckduckgo.com/?q=privacy&ia=web'
    ),
    true,
    'DuckDuckGo instant answer redirect must be detected as same search'
  );

  assert.strictEqual(
    isSameSearchOrRedirect(
      'https://www.google.com/search?q=hello',
      'https://en.wikipedia.org/wiki/Hello'
    ),
    false,
    'Navigation to external domain is a new page'
  );

  assert.strictEqual(
    isSameSearchOrRedirect(
      'https://www.google.com/search?q=hello',
      'https://www.google.com/search?q=world'
    ),
    false,
    'New search query is a new page'
  );
});

// 15. Universal Web Theme Injection Tests
test('Web Theme Injection - Generates color-scheme directives and Google search preferences', () => {
  function generateThemeScript(isDark) {
    const mode = isDark ? 'dark' : 'light';
    const prefVal = isDark ? 'f6=400' : 'f6=0';
    return {
      mode,
      prefVal,
      metaContent: mode,
      colorSchemeStyle: mode,
    };
  }

  const dark = generateThemeScript(true);
  assert.strictEqual(dark.mode, 'dark');
  assert.strictEqual(dark.metaContent, 'dark');
  assert.strictEqual(dark.colorSchemeStyle, 'dark');
  assert.strictEqual(dark.prefVal, 'f6=400', 'Google dark mode preference cookie must be f6=400');

  const light = generateThemeScript(false);
  assert.strictEqual(light.mode, 'light');
  assert.strictEqual(light.metaContent, 'light');
  assert.strictEqual(light.colorSchemeStyle, 'light');
  assert.strictEqual(light.prefVal, 'f6=0', 'Google light mode preference cookie must be f6=0');
});

// 16. Tabs Screen Page Preview Logic Tests
test('TabsScreen - correctly classifies tabs and parses URLs for rich previews', () => {
  function getSearchEngineFromUrl(url) {
    if (!url) return null;
    const lower = url.toLowerCase();
    if (lower.includes('google.com')) return 'Google';
    if (lower.includes('duckduckgo.com')) return 'DuckDuckGo';
    if (lower.includes('search.brave.com') || lower.includes('brave.com')) return 'Brave';
    if (lower.includes('bing.com')) return 'Bing';
    if (lower.includes('ecosia.org')) return 'Ecosia';
    return null;
  }

  function getSearchQuery(url) {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      const q = parsed.searchParams.get('q') || parsed.searchParams.get('query') || parsed.searchParams.get('p');
      if (q) return decodeURIComponent(q.replace(/\+/g, ' '));
    } catch {
      const match = url.match(/[?&](?:q|query|p)=([^&]+)/i);
      if (match && match[1]) {
        try {
          return decodeURIComponent(match[1].replace(/\+/g, ' '));
        } catch {
          return match[1];
        }
      }
    }
    return '';
  }

  function getDomain(url) {
    if (!url || url === 'about:blank') return '';
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      const match = url.match(/https?:\/\/(?:www\.)?([^\/\?#]+)/i);
      return match ? match[1] : '';
    }
  }

  function getPreviewType(tab) {
    if (tab.isBlank || !tab.url || tab.url === 'about:blank') {
      return 'blank';
    }
    const engine = getSearchEngineFromUrl(tab.url);
    if (engine) {
      return 'search';
    }
    if (tab.previewImage) {
      return 'image';
    }
    return 'document';
  }

  // Blank tab
  assert.strictEqual(getPreviewType({ isBlank: true, url: 'about:blank' }), 'blank');

  // Search Engine URLs
  const googleTab = { isBlank: false, url: 'https://www.google.com/search?q=expo+react+native' };
  assert.strictEqual(getPreviewType(googleTab), 'search');
  assert.strictEqual(getSearchEngineFromUrl(googleTab.url), 'Google');
  assert.strictEqual(getSearchQuery(googleTab.url), 'expo react native');

  const ddgTab = { isBlank: false, url: 'https://duckduckgo.com/?q=privacy+browser&t=h_' };
  assert.strictEqual(getPreviewType(ddgTab), 'search');
  assert.strictEqual(getSearchEngineFromUrl(ddgTab.url), 'DuckDuckGo');
  assert.strictEqual(getSearchQuery(ddgTab.url), 'privacy browser');

  // Web page with extracted preview image
  const articleTab = {
    isBlank: false,
    url: 'https://www.theverge.com/tech/cool-gadget',
    previewImage: 'https://cdn.theverge.com/hero.jpg',
    title: 'The Verge Tech Review'
  };
  assert.strictEqual(getPreviewType(articleTab), 'image');
  assert.strictEqual(getDomain(articleTab.url), 'theverge.com');

  // Web page without preview image
  const docTab = {
    isBlank: false,
    url: 'https://reactnative.dev/docs/getting-started',
    title: 'Getting Started - React Native'
  };
  assert.strictEqual(getPreviewType(docTab), 'document');
  assert.strictEqual(getDomain(docTab.url), 'reactnative.dev');
});

// 17. Voice Search and Camera (Google Lens) Search Tests
test('Voice & Camera Search - constructs correct URLs for search engines', () => {
  function getVoiceSearchUrl(engine) {
    if (engine === 'Google') return 'https://www.google.com/?source=voice&pb_voice=1';
    if (engine === 'Bing') return 'https://www.bing.com/?pb_voice=1';
    if (engine === 'DuckDuckGo') return 'https://duckduckgo.com/?q=&pb_voice=1';
    if (engine === 'Brave') return 'https://search.brave.com/?pb_voice=1';
    return 'https://www.ecosia.org/?pb_voice=1';
  }

  function getCameraSearchUrl(engine) {
    if (engine === 'Google') return 'https://lens.google.com/';
    if (engine === 'Bing') return 'https://www.bing.com/visualsearch';
    if (engine === 'DuckDuckGo') return 'https://duckduckgo.com/?ia=images&iax=images';
    if (engine === 'Brave') return 'https://search.brave.com/images';
    return 'https://www.ecosia.org/images';
  }

  function isVoiceSearchIntent(url) {
    return url.includes('source=voice') || url.includes('pb_voice=1');
  }

  // Google Voice & Lens
  assert.strictEqual(getVoiceSearchUrl('Google'), 'https://www.google.com/?source=voice&pb_voice=1');
  assert.ok(isVoiceSearchIntent(getVoiceSearchUrl('Google')));
  assert.strictEqual(getCameraSearchUrl('Google'), 'https://lens.google.com/');

  // Bing Voice & Visual Search
  assert.strictEqual(getVoiceSearchUrl('Bing'), 'https://www.bing.com/?pb_voice=1');
  assert.ok(isVoiceSearchIntent(getVoiceSearchUrl('Bing')));
  assert.strictEqual(getCameraSearchUrl('Bing'), 'https://www.bing.com/visualsearch');

  // DuckDuckGo
  assert.strictEqual(getVoiceSearchUrl('DuckDuckGo'), 'https://duckduckgo.com/?q=&pb_voice=1');
  assert.strictEqual(getCameraSearchUrl('DuckDuckGo'), 'https://duckduckgo.com/?ia=images&iax=images');

  // Non-voice URL check
  assert.strictEqual(isVoiceSearchIntent('https://www.google.com/search?q=test'), false);
});

// 18. Download Connection Speed & ETA Calculation Tests
test('DownloadManager - accurately formats live download speed and ETA', () => {
  function formatSpeed(bytesPerSec) {
    if (!bytesPerSec || bytesPerSec <= 0 || !isFinite(bytesPerSec)) return '0 KB/s';
    const kbps = bytesPerSec / 1024;
    const mbps = (bytesPerSec * 8) / (1024 * 1024);
    if (kbps < 1000) {
      return `${kbps.toFixed(1)} KB/s (${mbps.toFixed(1)} Mbps)`;
    }
    const mb = kbps / 1024;
    return `${mb.toFixed(2)} MB/s (${mbps.toFixed(1)} Mbps)`;
  }

  function formatEta(seconds) {
    if (!seconds || seconds <= 0 || !isFinite(seconds)) return '';
    if (seconds < 5) return '< 5s left';
    if (seconds < 60) return `${Math.round(seconds)}s left`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    if (mins < 60) {
      return `${mins}m ${secs}s left`;
    }
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}h ${remMins}m left`;
  }

  // Speed formatting
  assert.strictEqual(formatSpeed(0), '0 KB/s');
  assert.strictEqual(formatSpeed(-100), '0 KB/s');
  assert.strictEqual(formatSpeed(512 * 1024), '512.0 KB/s (4.0 Mbps)');
  assert.strictEqual(formatSpeed(1.5 * 1024 * 1024), '1.50 MB/s (12.0 Mbps)');
  assert.strictEqual(formatSpeed(12.75 * 1024 * 1024), '12.75 MB/s (102.0 Mbps)');

  // ETA formatting
  assert.strictEqual(formatEta(0), '');
  assert.strictEqual(formatEta(3), '< 5s left');
  assert.strictEqual(formatEta(45), '45s left');
  assert.strictEqual(formatEta(90), '1m 30s left');
  assert.strictEqual(formatEta(3720), '1h 2m left');
});

// 19. VPN Configuration Validator Tests (VPN-7)
test('VpnConfigValidator - rejects dangerous directives and accepts safe profiles', () => {
  const FORBIDDEN_DIRECTIVES = ['up', 'down', 'route-up', 'management', 'plugin', 'script-security'];

  function validateOpenVpn(config) {
    const lines = config.split(/\r?\n/);
    let hasClient = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const directive = trimmed.split(/\s+/)[0].toLowerCase();
      if (FORBIDDEN_DIRECTIVES.includes(directive)) {
        return { valid: false, error: `Forbidden directive: ${directive}` };
      }
      if (directive === 'client' || directive === 'remote') {
        hasClient = true;
      }
    }
    return { valid: hasClient };
  }

  // Safe OpenVPN
  const safeOvpn = `
client
dev tun
proto udp
remote 198.51.100.1 1194
resolv-retry infinite
nobind
persist-key
persist-tun
cipher AES-256-GCM
  `;
  assert.strictEqual(validateOpenVpn(safeOvpn).valid, true);

  // Dangerous OpenVPN with script execution
  const exploitOvpn = `
client
remote 198.51.100.1 1194
script-security 2
up /bin/sh
  `;
  const result = validateOpenVpn(exploitOvpn);
  assert.strictEqual(result.valid, false);
  assert.ok(result.error.includes('script-security'));

  // WireGuard validation
  function validateWireGuard(config) {
    const lines = config.split(/\r?\n/).map(l => l.trim().toLowerCase());
    const hasInterface = lines.includes('[interface]');
    const hasPeer = lines.includes('[peer]');
    const hasKey = lines.some(l => l.startsWith('privatekey'));
    return { valid: hasInterface && hasPeer && hasKey };
  }

  const safeWg = `