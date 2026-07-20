# Video Download Helper Extension Audit & Porting Document (EXT-1)

## Overview
This document audits the reference **Video Download Helper** extension (v10.6.1.2) located in `video downloader/` and records the exact mapping, ported modules, and intentional differences in the Private Browser React Native / Expo application according to `IMPROVEMENT_PLAN.md`.

---

## 1. Extension Manifest Analysis (`manifest.json`)
- **Manifest Version:** 3
- **Author:** Video Download Helper Team
- **Permissions Requested:**
  - `tabs`, `offscreen`, `downloads`, `sidePanel`, `webRequest`, `webNavigation`, `scripting`, `declarativeNetRequest`, `storage`, `notifications`, `contextMenus`, `unlimitedStorage`
- **Host Permissions:** `<all_urls>`
- **Content Scripts:**
  - Dedicated domain extractors for YouTube, Vimeo, Facebook, Instagram, OK.ru, VK, Canva, iQIYI, Twitcasting, Bilibili, TaiAV, Osmosis, Kick, Chaturbate, XGPlayer, JAVRank.

---

## 2. Rule Engine Porting (`video downloader/service/main.js` -> `src/video/detection/rules.ts`)

The reference extension uses `NS` (`onResponseStarted`) to evaluate requests in an exact sequential priority. This has been ported to pure TypeScript in `src/video/detection/rules.ts` without React or Expo dependencies:

| Step | Reference Rule | Private Browser Engine | Status |
| :--- | :--- | :--- | :--- |
| **1. Status Code** | Reject status < 200 or > 299 | `evaluateDetectionRules` checks `statusCode` 2xx | ✅ Ported |
| **2. Segment Filter** | Reject `.ts`, `.m4s`, `.m2ts` | `SEGMENT_REGEX = /\.(?:ts\|m4s\|m2ts)(?:[?#]\|$)/i` | ✅ Ported |
| **3. Special Configs** | `player.vimeo.com/.../config` & `intl-api.iq.com/.../dash` | Extracted & routed to `VimeoExtractor` and DASH handler | ✅ Ported |
| **4. Site Extractor Domains**| Excludes `PS` domain set from generic network filter | `SITE_EXTRACTOR_DOMAINS` set handles Vimeo, Facebook, etc. | ✅ Ported |
| **5. Initiator / Tab** | Requires valid initiator / tabId | Tagged with `tabId` and `sourcePageUrl` | ✅ Ported |
| **6. HLS Manifests** | `Content-Type: mpegurl` or URL `/hls\|m3u8/` or `/api/playlist/master/` | Parsed with `M3U8Parser`, extracts variants, audio groups & AES-128 | ✅ Ported |
| **7. MPD to M3U8 Rewrite** | Rewrites `.mpd` to `.m3u8` for supported CDNs | Supported in URL resolver | ✅ Ported |
| **8. DASH Manifests** | `Content-Type: dash` or URL `/\.mpd/` | Parsed with `MPDParser`, representations & templates | ✅ Ported |
| **9. Direct Media** | `Content-Type` mapped via `jm` table or response type `media` | `JM_CONTENT_TYPES` 17-entry table mapping to `ALLOWED_EXTENSIONS` (`bv` set) | ✅ Ported |
| **9a. 500 KB Filter** | Files < 500,000 bytes ignored | Enforced unless `allowSmallFiles` | ✅ Ported |
| **9b. 20 MB Anti-Spam** | Files < 20,000,000 bytes ignored if manifest seen on page | Tracked per tab via `hasManifestStream` flag | ✅ Ported |
| **9c. Content-Disposition** | Filename from `filename*=` or `filename=` | `parseContentDispositionFilename` UTF-8 priority | ✅ Ported |
| **9d. Range Support** | Checks `Accept-Ranges: bytes` or `Content-Range` | Flagged as `supportsByteRanges` for parallel chunking | ✅ Ported |
| **10. Deduplication** | Hash of URL or playlist content | DJB2 hash algorithm (`hashString`) | ✅ Ported |

---

## 3. Dedicated Site Extractors (`video downloader/injected/` -> `src/video/extractors/`)

| Extractor | Reference File | Implemented In | Features Handled |
| :--- | :--- | :--- | :--- |
| **Vimeo** | `vimeo.js` + `vimeo_untrusted.js` | `src/video/extractors/vimeo.ts` | Progressive MP4s with resolution labels (1080p, 720p), HLS CDNs, thumbnails, and duration |
| **Facebook & Instagram** | `facebook.js` | `src/video/extractors/facebook.ts` | Inline `dash_manifests`, `video_dash_manifest`, and progressive `playable_url(_quality_hd)` |
| **YouTube** | `youtube.js` | Optional / deferred | Deferred per specification (avoids unstable deciphering / Terms violations) |
| **Licensing / Premium** | `activate.js`, `premium.js` | **Excluded** | Excised for user privacy and licensing compliance |

---

## 4. Download Engine Overhaul (`video downloader/download_worker/` -> `src/downloads/engine/`)

The extension's multi-worker download architecture was ported to eliminate the previous Base64 string bottleneck in React Native:

1. **`DownloadQueue` (`src/downloads/engine/DownloadQueue.ts`):**
   - Maximum 2 concurrent jobs.
   - States: `queued → preparing → downloading → merging → completed / failed / paused / canceled`.
   - Persisted in SQLCipher database.
   - Respects user's `wifiOnly` setting before initiating data transfer.
2. **`SegmentPool` (`src/downloads/engine/SegmentPool.ts`):**
   - Semaphore-backed worker pool with concurrency 6.
   - As soon as one segment completes, the worker immediately pulls the next segment.
   - Adaptive error backoff: decreases concurrency upon consecutive network failures.
3. **`Fetcher` (`src/downloads/engine/Fetcher.ts`):**
   - Exponential backoff retries (up to 6 attempts).
   - Replays session headers (Referer, Origin, Cookies, User-Agent).
   - `AbortSignal` integration for immediate Pause and Cancel cancellation.
4. **`Decryptor` (`src/downloads/engine/Decryptor.ts`):**
   - WebCrypto-accelerated AES-128 CBC segment decryptor.
   - Computes 16-byte big-endian IV from media sequence number per RFC 8216 when IV is omitted.
5. **`SegmentWriter` (`src/downloads/engine/SegmentWriter.ts`):**
   - Streams byte buffers directly to disk via Expo SDK 58 File API, avoiding the Base64 memory bottleneck.
6. **`SpeedMeter` (`src/downloads/engine/SpeedMeter.ts`):**
   - 5-second sliding window with exponential moving average (EMA) smoothing.
   - Emits speed (MB/s and Mbps) and ETA throttled to 4 updates/sec without 0 KB/s lag.

---

## 5. Privacy & Zero-Telemetry Audit
- **Zero Remote Phoning Home:** All tracking, telemetry, and license-checking calls to `downloadhelper.net` were excised.
- **In-Memory Video Probing (DL-10):** Candidate media is evaluated and probed strictly in memory. Database writes occur only when the user explicitly taps Download.
- **Encrypted Local Storage (SEC-1):** All persistent data is stored in SQLCipher with 256-bit encryption and `PRAGMA secure_delete = ON`.
