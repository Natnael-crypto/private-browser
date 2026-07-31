
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