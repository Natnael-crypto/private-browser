
/**
 * Common ad, tracker, and telemetry domain patterns
 * Adheres to BLK-1, BLK-2 EasyList & EasyPrivacy core patterns
 */
const BUNDLED_BLOCK_PATTERNS: (string | RegExp)[] = [
  // Google / DoubleClick / AdSense / Analytics
  /doubleclick\.net/i,
  /google-analytics\.com/i,
  /googletagmanager\.com/i,
  /googlesyndication\.com/i,
  /googleadservices\.com/i,
  /adservice\.google\./i,
  /pagead2\.googlesyndication\.com/i,

  // Social trackers & pixels
  /connect\.facebook\.net/i,
  /facebook\.com\/tr\//i,
  /analytics\.twitter\.com/i,
  /ads-twitter\.com/i,
  /pixel\.wp\.com/i,
  /analytics\.tiktok\.com/i,

  // Major Ad Networks
  /criteo\.com/i,
  /criteo\.net/i,
  /outbrain\.com/i,
  /taboola\.com/i,
  /rubiconproject\.com/i,
  /adnxs\.com/i,
  /adtech\.de/i,
  /pubmatic\.com/i,
  /openx\.net/i,
  /smartadserver\.com/i,
  /media\.net/i,
  /scorecardresearch\.com/i,
  /moatads\.com/i,
  /adroll\.com/i,
  /popads\.net/i,
  /propellerads\.com/i,
  /exoclick\.com/i,
  /adsterra\.com/i,
  /mgid\.com/i,
  /zergnet\.com/i,
  /revcontent\.com/i,

  // Telemetry & Device Fingerprinters
  /segment\.io/i,
  /amplitude\.com/i,
  /mixpanel\.com/i,
  /hotjar\.com/i,
  /clarity\.ms/i,
  /sentry\.io\/api\//i,
  /bugsnag\.com/i,
  /branch\.io/i,
  /appsflyer\.com/i,
  /adjust\.com/i,
];

/**
 * CSS selectors for cosmetic filtering (BLK-6, BLK-9)
 * Hides banner ads, sponsored boxes, and annoying cookie popups
 */
const COSMETIC_SELECTORS = [
  // Generic ad classes/IDs
  '.ad-banner',
  '.adsbox',
  '.advertisement',
  'ins.adsbygoogle',
  'div[id^="google_ads_"]',
  'div[id^="div-gpt-ad"]',
  'iframe[src*="doubleclick"]',
  'iframe[src*="googlesyndication"]',
  'iframe[id^="google_ads_frame"]',
  '.sponsored-post',