# Private Browser — Improvement Plan for the AI Agent

**Audience:** the AI coding agent that will work on this repository.
**Scope:** (1) fix the broken browsing engine (pages that hang, back/forward that do nothing), (2) make the video detector behave exactly like the reference extension in `video downloader/`, (3) rebuild the download system so it is fast and shows live speed, (4) fix or remove every feature that is broken, half-built or fake, (5) add the features that make the app better.

> **How this document was produced.** It is a static code review of `app.zip` (about 13,000 lines of TypeScript plus the extension source). Nothing was run on a device. Every "root cause" below is a hypothesis taken from reading the code. **Phase 1 therefore starts by reproducing each problem and adding logging** before changing anything. Where a statement depends on a library's behaviour, it is marked *(verify)*.

---

## 0. Ground rules (read first)

1. Read `AGENTS.md`. The project uses Expo `^58` / React Native `0.88` / `react-native-webview 14`. These are newer than most training data. **Before using any Expo, RN or WebView API, read the docs for the installed version.** Code sketches in this file show intent, not exact signatures.
2. Product rules from the owner, which must never be violated:
   - Privacy first. **No telemetry, no analytics, no phoning home.**
   - The app does **exactly what it says and nothing more.** If a setting is shown in the UI, it must really work. A privacy app that shows a toggle that does nothing is worse than one without the toggle (false assurance).
   - The whole SQL database is encrypted. The app opens only with password or biometric.
   - Every downloaded video keeps the original page URL and can be opened from the app. The user can delete video records.
3. Do not port `injected/activate.js` or `injected/premium.js` from the extension. They are licensing and phone-home code.
4. After every phase run `npx tsc --noEmit`, `npx expo lint`, and the tests. Do not mark a task done if any of them fail.
5. Keep docs honest. `docs/extension-audit.md` and `docs/CHANGELOG.md` currently claim things that are not true (see section 2). Fix them in the same PR as the code.
6. Work in small PRs in the order of section 9.

---

## 1. Reproduce first (Phase 1, step 0)

Add a debug-only logger (disabled in release, never sends anything off-device) and reproduce:

| Symptom reported | How to reproduce | What to log |
|---|---|---|
| Some sites hang and never open | Open a heavy site, a site using Web Workers, a site behind redirects (search engine result click), an `http://` site | `onLoadStart/Progress/End/Error/HttpError`, `onNavigationStateChange` (url, loading, canGoBack), every `source.uri` change, every `onShouldStartLoadWithRequest` call with `isTopFrame` and result |
| Back / forward arrows do nothing | Search → click result → click link → Back ×3 → Forward ×2 | Tab `history`, `historyIndex`, `nativeCanGoBack`, what `handleBack` decided |
| Downloads slow | Download one HLS stream and one direct MP4 on the same network | Time per segment, time spent in base64 encode, time spent in file write, bytes/sec |

Do the diagnosis, write the result at the top of `docs/CHANGELOG.md`, then proceed.

---

## 2. Findings (verified by reading the code)

Severity: **P0** = app is unusable or unsafe, **P1** = major, **P2** = minor.

### 2.1 Browsing engine

| ID | Sev | Finding | Where |
|---|---|---|---|
| NAV-1 | P0 | **Feedback loop on `source`.** The WebView is rendered with `source={{ uri: tab.url }}`, and `onNavigationStateChange` writes `navState.url` back into `tab.url`. Every redirect or link click changes the `source` prop of the same WebView, which can make it reload or restart the load. This matches "stuck / never opens". | `BrowserScreen.tsx` WebView block |
| NAV-2 | P0 | **A second, hand-made history stack** (`history`, `historyIndex`) runs in parallel with the WebView's native history. `isSameSearchOrRedirect` guesses whether two URLs are "the same page" (same path+query, same `q=` on search engines). Redirects, hash changes and single-page-app route changes make the two stacks disagree, so Back jumps to the home page early or loops. `onNavigationStateChange` also reads `tab.history` from a stale render closure, so quick events overwrite each other. | `BrowserScreen.tsx` `handleBack`, `handleForward`, `onNavigationStateChange` |
| NAV-3 | P0 | `handleBack`/`handleForward` call `ref.loadUrl(...)`. **`loadUrl` does not exist** on the react-native-webview ref *(verify)*; the code silently falls through to `injectJavaScript("location.href=…")`. | `BrowserScreen.tsx` |
| NAV-4 | P1 | Opening a saved video's source page creates the tab with `createTab(url)` (history `[blank, url]`) and then calls `navigateTab(id, url)` again (history `[blank, url, url]`). Back stays on the same page. | `App.tsx` `onOpenSourcePage` |
| NAV-5 | P0 | **No handling for `window.open` / `target="_blank"`.** No `onOpenWindow` and no `setSupportMultipleWindows` decision. On Android such links and OAuth/login popups do nothing *(verify)*. | WebView props |
| NAV-6 | P0 | **No `onError`, `onHttpError`, `onRenderProcessGone` (Android), `onContentProcessDidTerminate` (iOS).** A failed or crashed page leaves a white screen, `isLoading` can stay true, and there is no error page, no Stop button and no load timeout. | WebView props |
| NAV-7 | P1 | `onShouldStartLoadWithRequest` never checks `isTopFrame` (iOS also calls it for iframes), so ad iframes with custom schemes trigger the "open app" modal repeatedly. It allows top-level `data:` and `blob:` navigations (a phishing vector), sends `javascript:` URLs to the "external app" modal, and for risky downloads only shows a warning but still loads. It ignores the `blockDriveByNav` and `confirmAppRedirects` settings. | `handleShouldStartLoadWithRequest` |
| NAV-8 | P1 | **HTTPS-only is naive.** `upgradeToHttps` rewrites the typed URL to `https://` with no fallback, so `http`-only sites, `localhost` and IP addresses fail. Link clicks to `http://` are not upgraded at all, so the "HTTPS only" setting is not enforced. | `privacyManager.ts`, `browserStore.navigateTab` |
| PERF-1 | P1 | `useBrowserStore()` is called **without a selector** in `App.tsx` and `BrowserScreen.tsx`. Every `onLoadProgress` tick re-renders the whole 1,800-line screen and every tab. All tabs keep a live WebView (`display: none`), so memory grows with each tab. | `App.tsx`, `BrowserScreen.tsx` |
| PERF-2 | P1 | The big injected script is rebuilt whenever the **active tab's host** changes, and the same string (with the *active* tab's host) is given to every tab's WebView. Background tabs get the wrong host. The per-site settings (`PolicyEngine.resolvePolicy`, `site_settings` table) are **never used** by the browser; `BrowserScreen` builds its own `resolvedPolicy` from global settings only. | `combinedInjectedJavaScript` |

### 2.2 Injected scripts (these can break pages)

| ID | Sev | Finding | Where |
|---|---|---|---|
| INJ-1 | P0 | `blockServiceWorkers` is **ON by default**, and it replaces `window.Worker` with a function that throws, and rejects `serviceWorker.register`. Many modern sites need Web Workers to start, so they hang or render blank. | `injectedGuards.ts` SCR-7, `browserStore` default |
| INJ-2 | P0 | The same combined script is passed as both `injectedJavaScriptBeforeContentLoaded` **and** `injectedJavaScript`, so everything except the video detector runs twice per page. `fetch` and `XMLHttpRequest` are wrapped twice, listeners are registered twice. | `BrowserScreen.tsx` |
| INJ-3 | P1 | **Canvas "noise" corrupts pages.** Every `toDataURL()` call does `getContext('2d')` + `getImageData` + `putImageData` on the real canvas. This (a) permanently modifies the canvas content, (b) creates a 2D context on canvases that should later become WebGL, which breaks them, (c) forces GPU read-back (slow), (d) is deterministic, so it is useless as fingerprint protection. `privacyManager.ts` contains a second canvas "patch" that does nothing. | `injectedGuards.ts` FPH-1, `privacyManager.ts` |
| INJ-4 | P1 | `blockLocalNetwork`: the XHR check `throw`s **inside a `try/catch(e){}`**, so XHR is never blocked. The `172.16.0.0/12` regex is double-escaped in the template string and never matches. | `injectedGuards.ts` SCR-4 |
| INJ-5 | P1 | `blockAutoplay` does nothing (sets `autoplay=false` and then calls the original `play()`), and `mediaPlaybackRequiresUserAction={false}` on the WebView contradicts it. | `injectedGuards.ts`, WebView props |
| INJ-6 | P1 | The dark-mode helper adds a `dark` class to `<html>` on every site, overrides `matchMedia` with an object whose `addEventListener` does nothing, and **writes the `PREF` cookie on Google domains**. This changes site styling unpredictably and a privacy browser must not edit another site's cookies. | `combinedInjectedJavaScript` |
| INJ-7 | **P0 (privacy)** | `navigator.permissions.query` is overridden to report **`granted` for microphone and camera on every site**, and the WebView uses `mediaCapturePermissionGrantType="grant"` *(verify per platform)*. Any site can be handed mic/camera without a prompt. This contradicts `defaultDenyPermissions` (which is not wired to anything). | `mediaAndVoiceScript`, WebView props |
| INJ-8 | P2 | `blockImages` only hides `img, picture, svg, video` with CSS (images are still downloaded; icons and videos vanish). `blockThirdPartyScripts` only catches scripts created with `createElement`, and uses "last two labels" as the site domain (wrong for `co.uk` etc.). | `injectedGuards.ts` |
| INJ-9 | P1 | **The ad/tracker blocker blocks nothing at network level.** It only hooks `fetch`/`XHR` from inside the page. `<script>`, `<img>`, `<iframe>`, CSS and beacon requests are not blocked. The pattern list is unanchored (`/adjust\.com/`, `/media\.net/`, `/branch\.io/` match unrelated hosts). The "blocked" counter counts only `fetch`/`XHR` hits. | `blockerEngine.ts` |

### 2.3 Video detector (compared to the extension)

See section 5 for the exact rules. Summary: the app does **not** port the extension. It is a generic DOM scanner plus URL-suffix sniffing. `docs/extension-audit.md` claims it is a port ("pixel-identical", "fully implemented"). That claim is false and must be corrected.

### 2.4 Downloads

| ID | Sev | Finding |
|---|---|---|
| DL-1 | P0 | **HLS is slow by design.** Segments are fetched in `Promise.all` batches of 4, so each batch waits for its slowest segment. Each segment is converted ArrayBuffer → Base64 with a **JavaScript string-concatenation loop** and written with `writeAsStringAsync(..., append)`. That is two full copies through the JS thread per segment and thousands of file re-opens. |
| DL-2 | P0 | **HLS output has no sound for most streams.** Only the chosen video variant is downloaded. `#EXT-X-MEDIA` audio groups (separate audio playlists) and subtitles are ignored, although the parser captures `audioGroup`. |
| DL-3 | P0 | **Encrypted HLS (`#EXT-X-KEY` AES-128) is written still encrypted** → corrupt file. The parser only flags `SAMPLE-AES` / Widevine / `com.apple` as DRM. The extension decrypts AES-128 itself. |
| DL-4 | P0 | **DASH (`.mpd`) and "Embed" items cannot be downloaded.** `startDownload` only distinguishes HLS vs direct, so a `.mpd` manifest or an embed page URL is downloaded as if it were a video and saved as `.mp4`. |
| DL-5 | P1 | HLS output is a raw concatenated `.ts` (or fMP4 pieces) with an `mp4` display name. Not a clean MP4. The extension remuxes with libav (`-c copy`). |
| DL-6 | P1 | Speed is computed, but: HLS speed updates only after a whole batch finishes (long "0 KB/s / Connecting…"); it is shown only on the Downloads screen; there is no indicator in the browser, the video sheet or a notification. `notify()` fires on every progress event with no throttle. |
| DL-7 | P1 | Fake sizes: when size is unknown the code uses a hard-coded `155189248` bytes (148 MB), so progress and ETA are invented. |
| DL-8 | P1 | Pause/Cancel are not real for HLS: pause busy-waits with `setTimeout`, cancel does not abort in-flight requests. Nothing survives an app restart. No foreground service or notification, so Android can kill background downloads. |
| DL-9 | P1 | Cookies come from `document.cookie`, which **cannot see HttpOnly cookies**, and the extension instead replays the real request headers. Many CDNs answer 403. |
| DL-10 | P1 | The registry saves **every probed video** (page URL + media URL + title) to the database even if the user never downloads it. That is browsing history and contradicts "private by default, no history". |

### 2.5 Security / correctness

| ID | Sev | Finding |
|---|---|---|
| SEC-1 | **P0** | **The database is not encrypted.** `openDatabaseAsync('private_browser.db')` has no SQLCipher and no key; only `PRAGMA secure_delete`. The docs claim "AES-256". The owner's requirement is a fully encrypted DB. |
| SEC-2 | P0 | **Settings are not persisted.** `browserStore` is plain `zustand` with no persistence; proxy, user agent, JS, blocker, theme and every privacy toggle reset on each app start (only two download settings use the DB). |
| SEC-3 | P0 | **Many settings are UI-only (not wired to anything):** proxy (`activeProxyId`, `failClosed`), OpenVPN/WireGuard (`activeVpnId`, `vpnKillSwitch`), `blockCookies`, `wifiOnly`, `defaultDenyPermissions`, `blockDriveByNav`, `confirmAppRedirects`, `screenOffLock`, `privateKeyboard`, `desktopMode`. Per-site settings are never applied (PERF-2). |
| SEC-4 | P0 | **"Clear everything" and "Panic wipe" do not wipe the WebView.** They delete DB rows and reset tabs only. WebView cookies, cache, localStorage/IndexedDB and **the downloaded video files on disk** are untouched (`DELETE FROM downloads` removes rows, not files). SecureStore entries are also untouched. |
| SEC-5 | P1 | No `incognito`/cookie/cache isolation on the WebView and no clearing on tab close, which contradicts "cleared on tab/session close". |
| SEC-6 | P1 | The lock screen is an overlay on top of live WebViews: pages keep running and **audio can keep playing while locked**. No `FLAG_SECURE` / app-switcher blur, so page content appears in the recents screen. |
| SEC-7 | P1 | Password hash is `SHA-256(password:salt)` with one iteration. Use a slow KDF (PBKDF2 with a high iteration count, or scrypt/argon2 through a maintained module) and use it to derive the DB key. |
| SEC-8 | P1 | `tests/*.test.mjs` **do not import any app code.** They re-implement the logic inside the test and assert against the copy, so they pass no matter what the app does. They give false confidence. |
| SEC-9 | P2 | `app.json` requests `CAMERA`, `RECORD_AUDIO`, `READ/WRITE_EXTERNAL_STORAGE` at install for every user (storage permissions are obsolete on modern Android) and `NSFaceIDUsageDescription` text. A privacy browser should request only what is used, when it is used. |
| SEC-10 | P2 | `AGENTS.md` says "use Expo Router, routes in `src/app/`", but the app uses a hand-made screen stack in `App.tsx`. Decide: migrate to Expo Router, or update `AGENTS.md`. |

---

## 3. Phase 1 — Fix browsing (stuck pages, back/forward)

### 3.1 Replace the navigation model (fixes NAV-1, NAV-2, NAV-3, NAV-4)

**Rule: the WebView's native history is the only history. The store never feeds a URL back into `source`.**

1. Change `BrowserTab`:
   ```ts
   interface BrowserTab {
     id: string;
     // What the user asked to load. Changes ONLY on an explicit user navigation.
     loadRequest: { url: string; nonce: number } | null;
     // What the page is showing right now. Written by WebView events, read-only for the UI.
     currentUrl: string;
     title: string;
     isBlank: boolean;          // home page shown instead of a WebView
     canGoBack: boolean;        // native
     canGoForward: boolean;     // native
     homeForward: boolean;      // true when user went Back from first page to the home screen
     isLoading: boolean;
     progress: number;
     // ...blockedCount, desktopMode, previewImage, description
   }
   ```
2. `source` is derived only from `loadRequest` and is memoised per tab, for example `source={useMemo(() => ({ uri: tab.loadRequest.url }), [tab.loadRequest?.nonce])}`. Typing a URL, tapping a suggestion, opening a bookmark or opening a source page sets a new `loadRequest` with a new `nonce`. **`onNavigationStateChange` must never write to `loadRequest`.**
3. `onNavigationStateChange` / `onLoadEnd` only update `currentUrl`, `title`, `canGoBack`, `canGoForward`. Read the latest tab with `useBrowserStore.getState()` inside the handler, never from the render closure.
4. Back button:
   - if `canGoBack` (native) → `ref.goBack()`;
   - else if the tab is on its first page → show the home screen (`isBlank = true`, `homeForward = true`) **without** destroying the WebView, so Forward can return to it;
   - else nothing.
5. Forward button: if `isBlank && homeForward` → show the WebView again; else if native `canGoForward` → `ref.goForward()`.
6. Delete `isSameSearchOrRedirect`, the custom `history`/`historyIndex` fields, `nativeCanGoBack/Forward` and every `ref.loadUrl` call.
7. Android hardware back: close open sheets/modals first, then `goBack()` if possible, then home-screen rule above, then let the OS handle it.
8. `App.tsx` `onOpenSourcePage`: call `createTab(sourceUrl)` **only** (it must set the `loadRequest`). Remove the extra `navigateTab`.
9. Reload and Stop: show **Stop** (✕) while `isLoading`, Reload otherwise. Add a load timeout (for example 30 s without progress → show the error page with Retry).

### 3.2 WebView props and handlers (fixes NAV-5, NAV-6, NAV-7, SEC-5)

- `onError`, `onHttpError`, `onRenderProcessGone`, `onContentProcessDidTerminate`: show a simple built-in error page ("Can't open page", reason, Retry, Go home). On a render-process crash, remount that WebView (new `key`).
- `onOpenWindow` (and decide `setSupportMultipleWindows`): open the target URL in a **new tab** (create the tab, then set its `loadRequest`). Required for `target="_blank"`, `window.open`, OAuth popups. Block popups that happen without a recent user gesture (popup blocker) and count them in the shield.
- `onShouldStartLoadWithRequest`:
  - evaluate `isTopFrame` (when available); for sub-frames allow normal web schemes and never show the external-app prompt;
  - top-level `data:`/`blob:` navigations: block (honour `blockDriveByNav`);
  - `javascript:` → allow only if it came from a user gesture, otherwise ignore silently (never show the "external app" modal);
  - external schemes → show the confirm modal only when `confirmAppRedirects` is on, otherwise block silently;
  - risky download extensions → make the warning a real **confirm** (Continue / Cancel) and return `false` until confirmed.
- Isolation: set the WebView isolation props (`incognito`, `cacheEnabled`, `thirdPartyCookiesEnabled`, `sharedCookiesEnabled`) according to the installed version's docs. Default for a private browser: **no persistent cookies/cache**. On tab close and on app exit, clear that tab's cookies/cache/storage *(verify the API; a small native module or `@react-native-cookies/cookies` may be needed)*.
- Permissions: remove `mediaCapturePermissionGrantType="grant"`; use a per-site prompt (Allow once / Deny) and store choices in `site_permissions`. Remove the `permissions.query` override completely (INJ-7).
- HTTPS-first with fallback: for a top-level `http://` request try `https://` first; if it fails to connect show an interstitial "This site does not support a secure connection. Continue anyway?" (Continue once / Go back). Exempt `localhost`, `.local`, private IPs. Do this in `onShouldStartLoadWithRequest` so **link clicks** are covered, not only typed URLs.

### 3.3 Injected scripts (fixes INJ-1 … INJ-9)

Build **one** document-start script per tab and inject it **once**:

1. Pass only `injectedJavaScriptBeforeContentLoaded`. Remove the duplicate `injectedJavaScript`. Wrap the script body in a guard: `if (window.__pb_installed) return; window.__pb_installed = true;`. *(verify main-frame-only vs all-frames options for the installed version; the extension injects into all frames.)*
2. Build the script per tab (host, per-site policy via `PolicyEngine.resolvePolicy`), memoised on that tab's own host + settings only.
3. Defaults and behaviour fixes:
   - **Service workers / Workers (INJ-1):** do **not** replace `window.Worker`. Keep "Block service workers" as `serviceWorker.register` rejection only, default **OFF**, and document that it may break some sites.
   - **Canvas (INJ-3):** delete the current noise. Either remove the claim, or implement it correctly: on `toDataURL/toBlob/getImageData`, copy the canvas to an offscreen canvas, add per-session random noise to the **copy**, and read from the copy. Never touch the original or call `getContext` on a canvas that has no context yet.
   - **Local network (INJ-4):** put the check outside the inner `try/catch`, return a rejected promise for `fetch` and `throw` (not caught) for XHR; fix the regex escaping; also cover `WebSocket` and `EventSource`.
   - **Autoplay (INJ-5):** if kept, set `mediaPlaybackRequiresUserAction` to `true` on the WebView when the setting is on; remove the fake JS patch.
   - **Dark mode (INJ-6):** remove the cookie write, the `dark` class and the `matchMedia` override. Use the WebView's own `forceDarkOn` / color-scheme support only.
   - **Images (INJ-8):** hide only `img/picture`; never `svg` or `video`. Real blocking needs the native request layer (section 6.6).
   - **Third-party scripts (INJ-8):** use a proper registrable-domain (public suffix) check; document that it only covers dynamically created scripts unless native blocking is added.
4. **Blocker (INJ-9):** see section 6.6. Until native blocking exists, rename the UI text to what is true ("Hides ads and blocks tracker requests made by page scripts") and anchor the patterns on hostnames, not substrings.
5. Keep `window.open` filtering for custom schemes, but route the allowed case to the new tab handler.

### 3.4 Performance (PERF-1, PERF-2)

- Use zustand **selectors** everywhere (`useBrowserStore(s => s.tabs)`, with `shallow` where needed). Split `BrowserScreen` into small components (`TabWebView`, `BottomBar`, `HomePage`). A progress tick must re-render only the progress bar.
- Throttle `onLoadProgress` writes (for example max 10 per second).
- Keep at most N live WebViews (for example the active tab and the 2 most recent). Suspend others: unmount, keep `currentUrl`/title/thumbnail, and reload on activation. Always unmount all WebViews when the app is locked (SEC-6).

### 3.5 Acceptance for Phase 1

- A test list of at least 12 sites/pages passes: a search engine (click a result, Back, Forward), a single-page app, a site using Web Workers, a site with `target="_blank"` links, an OAuth popup login, an `http://`-only site (interstitial appears), a site with many redirects, a very heavy page, a dead host (error page + Retry), an offline state, a page that crashes the renderer (page remounts).
- Back ×N then Forward ×N returns to exactly the same pages. No page ever reloads on its own.
- No page loads twice (verify in logs that `source` never changes without a new `nonce`).

---

## 4. Phase 2 — Security foundations that other features depend on

1. **Encrypt the database (SEC-1).** Use SQLCipher through the `expo-sqlite` config option for the installed version *(verify)*, key = random 256-bit key stored in `expo-secure-store` and wrapped with a key derived from the user's password (slow KDF, SEC-7). Migrate existing unencrypted DB data once, then securely delete the old file. Add a test that opens the file without the key and fails.
2. **Persist settings (SEC-2).** Persist all non-secret settings in the encrypted DB (`settings` table or one JSON row). Load before first render of `BrowserScreen`. Secrets (duress code, proxy password, VPN credentials) go to `expo-secure-store` only.
3. **Wire or remove every UI-only setting (SEC-3).** For each item in the table in section 7 choose one: *implement now*, *hide behind "Coming soon" with no toggle*, or *delete*. Never ship a live-looking toggle with no effect.
4. **Real wipe (SEC-4).** One `WipeService.wipeAll()` used by "Clear everything", panic wipe, duress password and "wipe after N failed unlocks". It must: clear WebView cookies/cache/storage, delete downloaded files and thumbnails on disk (and verify they are gone), clear DB (or delete the DB file and recreate), clear SecureStore keys that hold user data, reset tabs. Write an integration test.
5. **Lock behaviour (SEC-6).** On lock: unmount all WebViews and stop media. Enable `FLAG_SECURE` (Android) / blur snapshot (iOS) so recents show no page content. Keep this configurable in Settings.
6. **Stop persisting detected videos (DL-10).** Detected videos live in memory only. Write to the DB only when the user starts a download (and keep the page URL with it, as required). Add "Delete record" and "Delete file + record" actions.
7. **Permissions in `app.json` (SEC-9).** Remove obsolete storage permissions. Request `CAMERA`/`RECORD_AUDIO` only when a site asks and the user allows.

---

## 5. Phase 3 — Video detector: make it behave exactly like the extension

The reference is **Video DownloadHelper v10.6.1.2** in `video downloader/`. The code is minified. To read it:

```bash
npx js-beautify "video downloader/service/main.js"         -o /tmp/service.pretty.js
npx js-beautify "video downloader/download_worker/main.js" -o /tmp/worker.pretty.js
```

Names below refer to the beautified `service.pretty.js` (minified function names are stable for this build). **Read these functions yourself and port their logic; do not rely on the summary alone.**

### 5.1 How the extension really detects media

The extension does **not** scan the DOM for `<video>` tags as its main method. It watches the **network**:

- `webRequest.onSendHeaders` (function `If`) stores the request headers of each request in a map (10-minute TTL), keyed by `requestId`.
- `webRequest.onResponseStarted` (function `NS`) runs for every response of type `xmlhttprequest`, `media`, `main_frame`, `sub_frame`, `other` on `<all_urls>`.

For each response `NS` applies these rules **in this order**:

1. Ignore if status is not 2xx.
2. Ignore URLs whose path ends in `.ts`, `.m4s`, `.m2ts` (these are segments, not videos).
3. Special cases: Vimeo `player.vimeo.com/.../config` and iQIYI `intl-api.iq.com/.../dash` are handed to site extractors (`zf`).
4. Ignore pages whose registrable domain is in the set `PS` = `youtube.com, instagram.com, ok.ru, vk.com, vk.ru, vkvideo.ru, canva.com, iq.com, vimeo.com, kick.com, javrank.com` (these have their own extractors, section 5.4).
5. Ignore if there is no tab (`tabId <= 0`) and no valid initiator URL.
6. **HLS** (function `Ef`): for types `xmlhttprequest/other/main_frame/media`, treat as HLS if the `Content-Type` matches `/mpegurl/i`, **or** the URL matches `/hls|m3u8/i`, **or** it matches `/api/playlist/master/`. Then fetch the playlist **with the same headers the page sent**, parse it, and report either a master playlist (`m3u8_playlist`: variants + audio groups + subtitles + duration + DRM flag) or a plain media playlist (`m3u8`). Dedupe key: hash of `playlist text + URL`.
7. **MPD → M3U8 conversion** (function `sp`): for hosts in the `CONVERT_MPD_URL_TO_M3U8` list, rewrite `.mpd` to `.m3u8` and try HLS first.
8. **DASH** (function `IS`): if `Content-Type` matches `/dash/i` or URL matches `/\.mpd/i`, fetch with the same headers, parse (`Df`) and report `mpd_playlist` (qualities, duration, DRM flag, subtitles).
9. **Direct media** (function `OS`): if the response type is `media` **or** the `Content-Type` maps to a media type via the table `jm` (function `Pf`), report `http_playlist`:
   - Size filter: if `Content-Length` (or the total in `Content-Range`) is **below 500,000 bytes**, ignore, unless the host is in `ALLOW_SMALL_FILE_DETECTION`.
   - Anti-spam filter: if the page (initiator) already produced an HLS/DASH manifest and this file is smaller than **20,000,000 bytes**, ignore (it is a segment).
   - `supports_byte_ranges` = `Accept-Ranges: bytes` or a `Content-Range` header.
   - Filename/extension from `Content-Disposition` (`filename*=` / `filename=`), then the URL path, then the content type (function `$S`), checked against the allowed extension set `bv` (3gp, aac, avi, flac, flv, m4a, m4v, mkv, mov, mp3, mp4, mpeg, mpg, ogg, ogv, opus, ts, wav, webm, wmv, and so on).
   - Dedupe key: hash of the URL.
10. **Title and thumbnail** (function `Of`) are read from the page afterwards with these selectors, in order: `#vp-preview[data-thumb]`, `video[poster]`, `meta[name*=':image' i], meta[property*=':image' i]`, `link[rel='image_src'], link[rel='thumbnail'], link[as='image']`. Title: `document.title`, falling back to `meta[...':title' i]`.
11. **Every download replays the original request headers** (cookies, referer, user agent, authorization), not a guess built from `document.cookie`.

### 5.2 What the app does today vs the extension

| Extension behaviour | App today |
|---|---|
| Network-level detection of every response, with response headers | Only `fetch`/`XHR` calls made by page JS, URL-suffix sniffing (`.mp4`, `.ts`!, `/videoplayback`…) |
| Uses `Content-Type` to decide (`jm` table) | Never reads `Content-Type` |
| Ignores segments `.ts/.m4s/.m2ts` | **Treats `.ts` and `.m4s` as videos** (`isMediaUrl`), flooding the list with segments |
| 500 KB minimum and 20 MB anti-spam rules | None |
| Detects media requested by `<video src>` / MSE players | Only DOM scan + play hook; blob/MSE players are skipped (`blob:` rejected) |
| Runs in **all frames** | Main frame only (injection default) → embedded players are missed |
| HLS master: variants, **audio groups**, subtitles, duration, AES vs DRM | Variants only; no audio groups, no subtitles; duration estimated from `BANDWIDTH` |
| DASH: periods, adaptation sets, templates | Regex over `<Representation>` + `<BaseURL>` only; `SegmentTemplate/SegmentList/SegmentBase` ignored |
| DRM: flags `SAMPLE-AES*`, Widevine/PlayReady; **AES-128 is supported** | Flags `SAMPLE-AES`, Widevine, any `com.apple`; AES-128 not handled |
| Site extractors for 16 sites (section 5.4) | Two stubs (`playerConfig` for Vimeo, `ytcfg` for YouTube) that rarely work |
| Same headers for probing and downloading | `document.cookie` only (no HttpOnly), guessed `Referer`/`Origin` |
| Dedupe by content hash | Dedupe by raw URL (query strings change → duplicates) |
| Per-tab media store | One global list that is cleared when the active tab changes and ignores messages from background tabs |
| Resolution default | Invents `'720p'` when unknown |

### 5.3 Target architecture

Two layers, because a JS-only WebView cannot see response headers of every request:

**Layer A — JS (all platforms), injected in all frames at document start**
- Wrap `fetch` and `XMLHttpRequest` and, on completion, read `response.headers` / `getResponseHeader` (`content-type`, `content-length`, `content-range`, `accept-ranges`, `content-disposition`) and feed them to the **same rule engine** as section 5.1 (steps 2, 6–9).
- Hook `URL.createObjectURL`, `MediaSource.prototype.addSourceBuffer` and `HTMLMediaElement.src` to catch MSE/blob players, and associate them with the manifest URL that was fetched just before.
- Keep the DOM scan (`video`, `source`, `audio`, `track`, `<link rel=image_src>`) and `PerformanceObserver('resource')` as a backup, but pass every candidate through the same filter (no segments, size rules, content-type).
- Send messages with `frameUrl`, `tabId` and the page URL. The native side stores media **per tab**.

**Layer B — native request observer (Android, strongly recommended)**
- Android `WebViewClient.shouldInterceptRequest` sees every sub-resource URL and its **request headers**. `react-native-webview` does not expose it *(verify for the installed version)*. Add it through a small patch (`patch-package`) or a local Expo config plugin/native module that emits `{tabId, url, method, requestHeaders, resourceType}` to JS. JS then performs a `HEAD` / `Range: bytes=0-0` probe **using those exact headers** to obtain `Content-Type`, `Content-Length`, `Accept-Ranges` (this replaces `webRequest.onResponseStarted`).
- Read cookies for the media host from the native cookie store (includes HttpOnly) when starting a download.
- iOS cannot intercept `http(s)` sub-resources with `WKWebView`; iOS stays on Layer A plus probing. State this limitation in the docs.

Put the shared rule engine in plain TypeScript (`src/video/detection/rules.ts`) with **no React/Expo imports**, so it is unit-testable and the injected JS can be generated from the same source (or kept in sync by a test).