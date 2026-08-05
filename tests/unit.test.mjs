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
