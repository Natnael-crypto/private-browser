# Private Browser CHANGELOG

## [1.1.0] - 2026-10-27

### Architecture & Engine Upgrades (IMPROVEMENT_PLAN.md Implementation)

#### SDK & Navigation Overhaul
- Upgraded project to Expo SDK 58 (`expo@^58.0.19`, `react@19.3.0`, `react-native@0.88.0`, `react-native-webview@14.0.1`).
- Rewrote `BrowserTab` navigation model to use `loadRequest: { url, nonce }` pattern, eliminating reload loops and history mutation desyncs.
- Native back and forward navigation (`handleBack`/`handleForward`) using `webViewRef.goBack()`.
- Implemented reload/stop toggle button and 30-second navigation load timeout.
- Added in-app error page (`Can't open page`) with Retry and Go Home actions.
- Enabled multi-window support (`onOpenWindow`) routing popup links cleanly to new tabs.
- Configured isolation props (`incognito={true}`, `thirdPartyCookiesEnabled={!blockCookies}`, `sharedCookiesEnabled={!blockCookies}`).
- Replaced automatic media capture granting with `mediaCapturePermissionGrantType="prompt"`.

#### Injected Scripts & Security Sanitization
- Removed dangerous `window.Worker` stub that broke web worker pages.
- Sanitized canvas fingerprint protection to avoid canvas context destruction.
- Fixed unswallowed local network blocking in XHR and fetch.
- Removed fake JS autoplay overrides and connected `mediaPlaybackRequiresUserAction` WebView prop.
- Restricted image blocking to `img, picture` elements, preserving SVG icons and video streams.
- Replaced Google keystroke leakage in suggestions with selected engine provider (DuckDuckGo, Brave, Google, Bing, Ecosia) and made search suggestions opt-in (off by default).

#### App Icon & Visual Identity
- Replaced the unfinished wireframe blueprint placeholder icon with a flagship-quality 3D browser icon: an illuminated sapphire compass needle fused with a privacy shield and glowing cyan/purple orbital speed rings.
- Generated and formatted all standard icon assets: 1024x1024 master icon (`assets/icon.png`), Android full-bleed adaptive foreground (`assets/android-icon-foreground.png`), seamless background (`assets/android-icon-background.png`), Android 13+ Material You monochrome silhouette (`assets/android-icon-monochrome.png`), splash screen (`assets/splash-icon.png`), and web favicon (`assets/favicon.png`).

#### Security Foundations & Persistence
- Configured SQLCipher 256-bit database encryption in `expo-sqlite` with key derivation from master password and `PRAGMA secure_delete = ON`.
- Created unified `WipeService.wipeAll()` clearing SQLite database, SecureStore keys, filesystem download directory and thumbnails, and active store tabs.
- Activated `ScreenCapture.preventScreenCaptureAsync()` to prevent screen recording and recents leakage.
- Wired unmounting of WebViews when app is locked (`isLocked`).
- Persisted non-secret settings in encrypted database and restored them on startup.
- Honestly marked uncompleted VPN and Proxy sections as "Coming Soon / In Development" without fake toggles.
- Implemented native filesystem document picker for VPN profile imports (`expo-document-picker`), eliminating manual copy-pasting for `.ovpn` and `.conf` files.

#### Video Detection Rule Engine (Matching Video DownloadHelper v10.6.1.2)
- Created pure TypeScript detection rule engine (`src/video/detection/rules.ts`) without React/Expo dependencies.
- Implemented 9-step evaluation priority: status 2xx, `.ts/.m4s/.m2ts` segment exclusion, 500 KB size filter, 20 MB anti-spam rule for pages with manifests, `jm` Content-Type mapping, and Content-Disposition filename parsing.
- Added dedicated site extractors for Vimeo (`src/video/extractors/vimeo.ts`) and Facebook/Instagram (`src/video/extractors/facebook.ts`).
- Upgraded `VideoRegistry`: per-tab media isolation, in-memory probing (no database writes until user starts download), DJB2 hash deduplication, and removal of invented "720p" defaults.
- Updated `VideosSheetScreen.tsx` with per-item quality picker, audio tracks, embed player buttons, and DRM indicators ("Protected — can't be downloaded").

#### High-Performance Download Engine
- Created semaphore-backed `SegmentPool` worker pool (concurrency 6) with adaptive network backoff.
- Created sliding-window `SpeedMeter` (5s window + exponential smoothing) emitting live MB/s, Mbps, and ETA throttled to 4/sec without 0 KB/s lag.
- Implemented WebCrypto-accelerated AES-128 CBC `Decryptor` with sequence number to IV computation.
- Implemented `SegmentWriter` bypassing Base64 string memory bottlenecks.
- Added live download speed floating pill in `BrowserScreen.tsx` (tap -> Downloads) and inline progress in `VideosSheetScreen.tsx`.
- Enforced `wifiOnly` restriction checking network state before starting downloads.

---

## [1.0.0] - 2026-10-18

### Initial Release
- Multi-tab private browser with ad & tracker blocking, biometric lock, and download management.
