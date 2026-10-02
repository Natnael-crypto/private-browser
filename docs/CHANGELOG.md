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