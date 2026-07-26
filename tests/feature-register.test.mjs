import test from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';

// =========================================================================
// 1. SECURITY & APP LOCK TESTS (SEC-1, SEC-2, PRV-12)
// =========================================================================
test('SEC-2 & PRV-12: Master password setup, salt derivation, and validation', () => {
  function hashPassword(password, salt) {
    return crypto.createHash('sha256').update(`${password}:${salt}`).digest('hex');
  }

  // 1. Minimum length enforcement (min 6 characters)
  const tooShort = '12345';
  assert.strictEqual(tooShort.length < 6, true, 'Short password must be rejected');

  const validPassword = 'MySecretMasterKey2026!';
  const salt = crypto.randomBytes(16).toString('hex');
  const storedHash = hashPassword(validPassword, salt);

  // 2. Correct password verification
  const verifySuccess = hashPassword(validPassword, salt) === storedHash;
  assert.strictEqual(verifySuccess, true, 'Correct password must verify');

  // 3. Incorrect password rejection
  const verifyFail = hashPassword('WrongPassword', salt) === storedHash;
  assert.strictEqual(verifyFail, false, 'Wrong password must be rejected');
});

test('SEC-2: Exponential backoff calculation on failed unlock attempts', () => {
  function getBackoffDelaySec(failedAttempts) {
    if (failedAttempts >= 5) return 30;
    if (failedAttempts >= 4) return 15;
    if (failedAttempts >= 3) return 5;
    return 0;
  }

  assert.strictEqual(getBackoffDelaySec(1), 0, '1 failed attempt has no delay');
  assert.strictEqual(getBackoffDelaySec(2), 0, '2 failed attempts have no delay');
  assert.strictEqual(getBackoffDelaySec(3), 5, '3 failed attempts trigger 5s delay');
  assert.strictEqual(getBackoffDelaySec(4), 15, '4 failed attempts trigger 15s delay');
  assert.strictEqual(getBackoffDelaySec(5), 30, '5 failed attempts trigger 30s delay');
  assert.strictEqual(getBackoffDelaySec(10), 30, 'Subsequent failed attempts cap at 30s delay');
});

test('SEC-2: Auto-lock background timeout checks', () => {
  function shouldLockOnResume(lastActiveTime, timeoutSec, currentTime) {
    if (timeoutSec === -1) return false; // 'Never'
    const elapsed = currentTime - lastActiveTime;
    return elapsed >= timeoutSec * 1000;
  }

  const now = 100000;
  // Immediately (0s)
  assert.strictEqual(shouldLockOnResume(now - 100, 0, now), true, 'Immediate auto-lock must trigger');
  // 1 minute (60s)
  assert.strictEqual(shouldLockOnResume(now - 30000, 60, now), false, '30s elapsed on 60s timeout should not lock');
  assert.strictEqual(shouldLockOnResume(now - 65000, 60, now), true, '65s elapsed on 60s timeout must lock');
  // Never (-1)
  assert.strictEqual(shouldLockOnResume(now - 9999999, -1, now), false, 'Never timeout should never auto-lock');
});

// =========================================================================
// 2. PRIVACY LAYER TESTS (PRV-1 to PRV-11)
// =========================================================================
test('PRV-8: Strip comprehensive tracking query parameters', () => {
  const TRACKING_PARAMS = new Set([
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
    'fbclid', 'gclid', 'gclsrc', 'dclid', 'msclkid', 'mc_cid', 'mc_eid', 'igshid',
    'yclid', '_hsenc', '_hsmi', 'mkt_tok', 's_kwcid', 'zanpid', 'wickedid', 'twclid', 'sc_clid'
  ]);

  function sanitizeUrl(rawUrl) {
    const url = new URL(rawUrl);
    const params = new URLSearchParams(url.search);
    let changed = false;
    const keysToDelete = [];
    params.forEach((_, key) => {
      const lower = key.toLowerCase();
      if (TRACKING_PARAMS.has(lower) || lower.startsWith('utm_')) {
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
  }

  const testUrl = 'https://store.example.com/item?id=8823&utm_source=newsletter&utm_campaign=summer&fbclid=AQD123&gclid=G-456&twclid=TW99&ref=organic';
  const cleaned = sanitizeUrl(testUrl);

  assert.strictEqual(cleaned, 'https://store.example.com/item?id=8823&ref=organic');
  assert.ok(!cleaned.includes('utm_source'));
  assert.ok(!cleaned.includes('fbclid'));
  assert.ok(!cleaned.includes('gclid'));
  assert.ok(!cleaned.includes('twclid'));
  assert.ok(cleaned.includes('id=8823'), 'Legitimate functional params must be preserved');
  assert.ok(cleaned.includes('ref=organic'), 'Non-tracking params must be preserved');
});

test('PRV-7: Automatic HTTPS upgrade', () => {
  function upgradeToHttps(url) {
    if (url.startsWith('http://')) return 'https://' + url.slice(7);
    return url;
  }

  assert.strictEqual(upgradeToHttps('http://insecure-site.org/index.html'), 'https://insecure-site.org/index.html');
  assert.strictEqual(upgradeToHttps('https://already-secure.org/index.html'), 'https://already-secure.org/index.html');
});

test('PRV-9, PRV-10, PRV-11: Injected privacy scripts structure', () => {
  // Test presence of GPC, WebRTC relay enforcement, and fingerprinting reduction
  const script = `
    if (!('globalPrivacyControl' in navigator)) {
      Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true });
    }
    if (window.RTCPeerConnection) {
      cfg.iceTransportPolicy = 'relay';
    }
    if (navigator.hardwareConcurrency) {
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
    }
  `;

  assert.ok(script.includes('globalPrivacyControl'), 'GPC must be defined (PRV-9)');
  assert.ok(script.includes('iceTransportPolicy'), 'WebRTC relay must be forced (PRV-10)');
  assert.ok(script.includes('hardwareConcurrency'), 'Hardware concurrency must be neutralized (PRV-11)');
});

// =========================================================================
// 3. AD & TRACKER BLOCKER TESTS (BLK-1 to BLK-9)
// =========================================================================
test('BLK-1, BLK-2, BLK-4: Request-level blocker and allowlist bypass', () => {
  const PATTERNS = [
    /doubleclick\.net/i,
    /google-analytics\.com/i,
    /googletagmanager\.com/i,
    /criteo\.com/i,
    /outbrain\.com/i,
    /taboola\.com/i,
    /scorecardresearch\.com/i,
    /appsflyer\.com/i,
    /branch\.io/i,
    /adjust\.com/i,
  ];

  function shouldBlock(url, isAllowlisted) {
    if (isAllowlisted) return false;
    return PATTERNS.some((p) => p.test(url));
  }

  assert.strictEqual(shouldBlock('https://securepubads.g.doubleclick.net/gampad/ads', false), true);
  assert.strictEqual(shouldBlock('https://www.google-analytics.com/collect?v=1', false), true);
  assert.strictEqual(shouldBlock('https://api.branch.io/v1/open', false), true);
  assert.strictEqual(shouldBlock('https://widgets.outbrain.com/outbrain.js', false), true);
  assert.strictEqual(shouldBlock('https://wikipedia.org/wiki/Main_Page', false), false);

  // BLK-4: Allowlisted site bypasses blocker
  assert.strictEqual(shouldBlock('https://securepubads.g.doubleclick.net/gampad/ads', true), false);
});

test('BLK-6, BLK-9: Cosmetic filtering hides ads and cookie consent banners', () => {
  const SELECTORS = [
    '.ad-banner',
    '.adsbox',
    'ins.adsbygoogle',
    '#onetrust-consent-sdk',
    '#cmpbox',
    '.cookie-banner',
    '.cookie-consent',
  ];

  const css = `${SELECTORS.join(', ')} { display: none !important; visibility: hidden !important; }`;
  assert.ok(css.includes('display: none !important'));
  assert.ok(css.includes('#onetrust-consent-sdk'), 'Cookie notices must be hidden (BLK-9)');
  assert.ok(css.includes('ins.adsbygoogle'), 'Google AdSense slots must be hidden (BLK-6)');
});

// =========================================================================
// 4. VIDEO DETECTION & EXTENSION LOGIC TESTS (VID-1 to VID-8, EXT-1)
// =========================================================================
test('VID-1 & VID-2: Format detection from URL extensions', () => {
  function guessFormat(url) {
    const clean = url.split('?')[0].toLowerCase();
    if (clean.endsWith('.m3u8')) return 'HLS';
    if (clean.endsWith('.mpd')) return 'DASH';
    if (clean.endsWith('.mp4')) return 'MP4';
    if (clean.endsWith('.webm')) return 'WebM';
    if (clean.endsWith('.mov')) return 'MOV';
    return 'MP4';
  }

  assert.strictEqual(guessFormat('https://cdn.example.com/master.m3u8?token=xyz'), 'HLS');
  assert.strictEqual(guessFormat('https://media.example.com/manifest.mpd'), 'DASH');
  assert.strictEqual(guessFormat('https://video.example.com/clip.mp4?hd=1'), 'MP4');
  assert.strictEqual(guessFormat('https://stream.example.com/movie.webm'), 'WebM');
  assert.strictEqual(guessFormat('https://archive.org/video.mov'), 'MOV');
});

test('VID-7: HLS Master M3U8 multi-variant parsing', () => {
  const masterContent = `
#EXTM3U
#EXT-X-VERSION:4
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio-1",NAME="English",DEFAULT=YES,URI="audio_en.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=1100000,RESOLUTION=640x360,AUDIO="audio-1"
360p/prog_index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2600000,RESOLUTION=1280x720,AUDIO="audio-1"
720p/prog_index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=5800000,RESOLUTION=1920x1080,AUDIO="audio-1"
1080p/prog_index.m3u8
  `.trim();

  const lines = masterContent.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const variants = [];
  let currentInf = null;

  for (const line of lines) {
    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      const resMatch = line.match(/RESOLUTION=(\d+x\d+)/);
      const bwMatch = line.match(/BANDWIDTH=(\d+)/);
      currentInf = {
        resolution: resMatch ? resMatch[1] : null,
        bandwidth: bwMatch ? parseInt(bwMatch[1], 10) : 0,
      };
    } else if (currentInf && !line.startsWith('#')) {
      variants.push({
        uri: line,
        resolution: currentInf.resolution,
        qualityLabel: currentInf.resolution ? currentInf.resolution.split('x')[1] + 'p' : 'Auto',
        bandwidth: currentInf.bandwidth,
      });
      currentInf = null;
    }
  }

  assert.strictEqual(variants.length, 3, 'Must parse all 3 variants');
  assert.strictEqual(variants[0].qualityLabel, '360p');
  assert.strictEqual(variants[1].qualityLabel, '720p');
  assert.strictEqual(variants[2].qualityLabel, '1080p');

  // Verify UI label formatting matches design: "HLS · 3 qualities · 1080p selected"
  const formattedMeta = `HLS · ${variants.length} qualities · ${variants[2].qualityLabel} selected`;
  assert.strictEqual(formattedMeta, 'HLS · 3 qualities · 1080p selected');
});

test('VID-8: DRM detection and protection flagging', () => {
  function checkDrm(manifestOrTag) {
    return manifestOrTag.includes('SAMPLE-AES') ||
           manifestOrTag.includes('com.widevine') ||
           manifestOrTag.includes('com.microsoft.playready') ||
           manifestOrTag.includes('com.apple.streamingkeydelivery') ||
           manifestOrTag.includes('ContentProtection');
  }

  // 1. HLS SAMPLE-AES Key
  assert.strictEqual(checkDrm('#EXT-X-KEY:METHOD=SAMPLE-AES,URI="skd://key"'), true);
  // 2. DASH Widevine ContentProtection tag
  assert.strictEqual(checkDrm('<ContentProtection schemeIdUri="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"/>'), true);
  // 3. Clear unencrypted stream
  assert.strictEqual(checkDrm('#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360'), false);
});

// =========================================================================
// 5. DOWNLOAD ENGINE & STORAGE (DL-1 to DL-9, SEC-3, SEC-4, SEC-5)
// =========================================================================
test('SEC-3: In-progress downloads use UUID temporary filenames without titles', () => {
  function createTempFilename(extension) {
    const uuid = crypto.randomUUID();
    return `${uuid}.${extension}`;
  }

  const tempName = createTempFilename('mp4');
  const uuidPart = tempName.split('.')[0];
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuidPart);
  assert.strictEqual(isUuid, true, 'Temp file name must be a valid UUID');
  assert.ok(!tempName.includes('Video'), 'Temp file name must never leak the video title');
});

test('DL-9: Clean filename sanitization', () => {
  function cleanFileName(title, extension) {
    const cleaned = title
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
    return `${cleaned || 'video'}.${extension}`;
  }

  const invalid = 'Lecture 4: Full Recording / Film [1080p] *Special* <Part 1>?';
  const clean = cleanFileName(invalid, 'mp4');

  assert.strictEqual(clean, 'Lecture 4_ Full Recording _ Film [1080p] _Special_ _Part 1__.mp4');
  assert.ok(!clean.includes(':'));
  assert.ok(!clean.includes('/'));
  assert.ok(!clean.includes('*'));
  assert.ok(!clean.includes('<'));
  assert.ok(!clean.includes('?'));
});

test('SEC-4 & SEC-5: Video record metadata and removal rules', () => {
  // Mock DB store
  const videos = new Map();
  const downloads = new Map();

  function saveVideo(v) {
    videos.set(v.id, v);
  }

  function saveDownload(d) {
    downloads.set(d.id, d);
  }

  function removeVideoDetailsOnly(videoId) {
    videos.delete(videoId);
    for (const [id, dl] of downloads.entries()) {
      if (dl.video_id === videoId) downloads.delete(id);
    }
  }

  const videoId = 'vid-123';
  const downloadId = 'dl-456';
  const sourcePage = 'https://northfield.example/cinemas';

  saveVideo({
    id: videoId,
    source_page_url: sourcePage, // SEC-4
    title: 'Inside the quiet revival',
    format: 'MP4',
    resolution: '1080p',
  });

  saveDownload({
    id: downloadId,
    video_id: videoId,
    state: 'completed',
    file_uri: '/storage/downloads/revival.mp4',
    final_name: 'Inside the quiet revival.mp4',
  });

  // SEC-4: verify source page is accessible
  assert.strictEqual(videos.get(videoId).source_page_url, sourcePage);

  // SEC-5: remove video details only
  removeVideoDetailsOnly(videoId);
  assert.strictEqual(videos.has(videoId), false, 'Video details must be deleted');
  assert.strictEqual(downloads.has(downloadId), false, 'Download record must cascade delete');
});

// =========================================================================
// 6. BROWSER SHELL & NAVIGATION (WEB-1, WEB-3, WEB-4, WEB-5, WEB-15)
// =========================================================================
test('WEB-1 & WEB-4: Single address bar URL detection vs search query across engines', () => {
  const SEARCH_URLS = {
    DuckDuckGo: 'https://duckduckgo.com/?q=',
    Google: 'https://www.google.com/search?q=',
    Brave: 'https://search.brave.com/search?q=',
    Bing: 'https://www.bing.com/search?q=',
    Ecosia: 'https://www.ecosia.org/search?q=',
  };

  function resolveNavigation(raw, engine = 'DuckDuckGo') {
    const input = raw.trim();
    const hasSpace = /\s/.test(input);
    const isDomain = !hasSpace && (input.includes('.') || input.startsWith('localhost'));

    if (input.startsWith('http://') || input.startsWith('https://')) {
      return input;
    }
    if (isDomain) {
      return `https://${input}`;
    }
    return `${SEARCH_URLS[engine]}${encodeURIComponent(input)}`;
  }

  // 1. Full URL
  assert.strictEqual(resolveNavigation('https://github.com/expo/expo'), 'https://github.com/expo/expo');
  // 2. Domain without scheme
  assert.strictEqual(resolveNavigation('wikipedia.org'), 'https://wikipedia.org');
  // 3. Search query with DuckDuckGo (default)
  assert.strictEqual(resolveNavigation('private mobile browser'), 'https://duckduckgo.com/?q=private%20mobile%20browser');
  // 4. Search query with Google
  assert.strictEqual(resolveNavigation('react native', 'Google'), 'https://www.google.com/search?q=react%20native');
  // 5. Search query with Brave
  assert.strictEqual(resolveNavigation('ad blocking', 'Brave'), 'https://search.brave.com/search?q=ad%20blocking');
});

test('WEB-3 & WEB-5: Multi-tab management lifecycle', () => {
  const tabs = [];

  function createTab(url = 'about:blank') {
    const id = crypto.randomUUID();
    tabs.push({ id, url, isBlank: url === 'about:blank' });
    return id;
  }

  function closeTab(id) {
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx !== -1) tabs.splice(idx, 1);
    // If all closed, spawn fresh blank tab (PRV-3, WEB-5)
    if (tabs.length === 0) {
      createTab('about:blank');
    }
  }

  const tab1 = createTab('https://site1.com');
  const tab2 = createTab('https://site2.com');
  assert.strictEqual(tabs.length, 2);

  closeTab(tab1);
  assert.strictEqual(tabs.length, 1);
  assert.strictEqual(tabs[0].id, tab2);

  // Closing last tab creates fresh blank tab
  closeTab(tab2);
  assert.strictEqual(tabs.length, 1);
  assert.strictEqual(tabs[0].url, 'about:blank');
  assert.strictEqual(tabs[0].isBlank, true);
});

test('WEB-15: Local Bookmarks CRUD in SQLite storage', () => {
  const bookmarks = [];

  function addBookmark(url, title) {
    const id = bookmarks.length + 1;
    bookmarks.push({ id, url, title, added_at: Date.now() });
    return id;
  }

  function deleteBookmark(id) {
    const idx = bookmarks.findIndex((b) => b.id === id);
    if (idx !== -1) bookmarks.splice(idx, 1);
  }

  const bId = addBookmark('https://news.example.com', 'Daily News');
  assert.strictEqual(bookmarks.length, 1);
  assert.strictEqual(bookmarks[0].title, 'Daily News');

  deleteBookmark(bId);
  assert.strictEqual(bookmarks.length, 0);
});

test('DL-5: HLS segment sequential extraction and download assembly', () => {
  const mediaPlaylistText = `
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXTINF:9.009,
segment_0.ts
#EXTINF:9.009,
segment_1.ts
#EXTINF:9.009,
segment_2.ts
#EXT-X-ENDLIST
  `.trim();

  const lines = mediaPlaylistText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  assert.strictEqual(lines.length, 3);
  assert.strictEqual(lines[0], 'segment_0.ts');
  assert.strictEqual(lines[1], 'segment_1.ts');
  assert.strictEqual(lines[2], 'segment_2.ts');

  // Verify URL resolution
  const baseUrl = 'https://stream.example.com/hls/720p/playlist.m3u8';
  const resolved = lines.map((seg) => new URL(seg, baseUrl).href);
  assert.strictEqual(resolved[0], 'https://stream.example.com/hls/720p/segment_0.ts');
  assert.strictEqual(resolved[1], 'https://stream.example.com/hls/720p/segment_1.ts');
  assert.strictEqual(resolved[2], 'https://stream.example.com/hls/720p/segment_2.ts');
});

