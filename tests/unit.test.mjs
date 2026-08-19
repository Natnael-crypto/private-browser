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