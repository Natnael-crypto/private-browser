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

### 5.4 Site extractors to port from `injected/`

Create `src/video/extractors/<site>.ts`, selected by URL host. Each file in `injected/` is a content script (sometimes with an `_untrusted.js` twin that runs in the page's own JS world, which in a WebView means "inject into the page"). Read each, beautify it, and port the parsing logic; replace `chrome.runtime.sendMessage` with `window.ReactNativeWebView.postMessage`.

| File | Matches | Notes |
|---|---|---|
| `youtube.js` + `youtube_untrusted.js` | `*.youtube.com` | 1 MB bundle. **Ask the owner before porting** — it needs signature/n-parameter deciphering, breaks often, and YouTube's terms forbid downloading. Do last, optional. |
| `vimeo.js` + `vimeo_untrusted.js` | `*.vimeo.com` | Also uses the `player.vimeo.com/.../config` JSON rule (5.1 step 3). |
| `facebook.js` | `*.facebook.com`, `*.instagram.com` | Large bundle. |
| `vk.js` | `vk.com`, `vk.ru`, `vkvideo.ru`, `live.vkvideo.ru` | |
| `ok.js` | `ok.ru`, `m.ok.ru` | |
| `bilibili.js` + `_untrusted` | `bilibili.com`, `bilibili.tv` | |
| `kick.js` | `kick.com` | |
| `canva.js` | `canva.com` | |
| `iq.js` + `_untrusted` | `iq.com` | Uses the `/dash` config rule. |
| `twitcasting.js` | `twitcasting.tv` | |
| `osmosis.js` | `osmosis.org` | |
| `chaturbate.js`, `javrank.js` (+`_untrusted`), `taiav.js`, `xgplayer_crypto*.js` | adult sites | **Port only if the owner confirms** he wants them. |
| `activate.js`, `premium.js` | `downloadhelper.net` | **Do not port** (licensing). |

Order: Vimeo → Facebook/Instagram → VK/OK → Kick/Bilibili/others → (optional) YouTube.

### 5.5 Registry and UI fixes

- Store detected media **per tab** (`Map<tabId, Map<hash, MediaItem>>`); do not clear on tab switch; clear a tab's list on top-level navigation (and not on in-page SPA changes that keep the same player).
- Dedupe with the extension's hash (URL, or playlist text + URL).
- Item model must carry: `type` (`direct | hls_master | hls_media | dash | embed`), `sentHeaders`, `supportsByteRanges`, `duration`, `qualities[]`, `audioTracks[]`, `subtitles[]`, `hasDrm`, `needsDecrypt (AES-128)`, `sourcePageUrl`, `frameUrl`.
- Never show `Embed` items as downloadable. Show them as "Open player".
- DRM items: show as "Protected — can't be downloaded", with no download button.
- The floating video button and the "Videos on this page" sheet must show: title, thumbnail, type, resolution list, audio tracks, size if known, and **a per-item quality picker**.
- Remove the invented `'720p'` default; show "Auto" or hide.

### 5.6 Acceptance for Phase 3

- A unit test suite imports `rules.ts` and passes fixtures for every rule in 5.1 (segment ignored, 499,999-byte file ignored, 20 MB anti-spam, `Content-Type` mapping, filename from `Content-Disposition`, HLS by content-type/URL/`/api/playlist/master/`, DASH by content-type/URL).
- Detection works on: a plain `<video src>` MP4, an HLS master with separate audio, an HLS with AES-128, a DASH stream, a page where the player is inside an iframe, a blob/MSE player, and at least Vimeo + one more site extractor.
- `docs/extension-audit.md` is rewritten with an honest table: what is ported, what is not, and why.

---

## 6. Phase 4 — New download system

### 6.1 Design

Create `src/downloads/engine/` with these parts:

| Part | Responsibility |
|---|---|
| `DownloadQueue` | Max concurrent **jobs** (default 2), job states `queued → preparing → downloading → merging → completed / failed / paused / canceled`, persisted in the encrypted DB so jobs survive app restarts. |
| `SegmentPool` | Per job. A **worker pool with a semaphore**, not batches: as soon as one segment finishes the next starts. Default concurrency 6 (extension uses 4; make it configurable 2–16 and adapt: lower it after repeated errors). |
| `Fetcher` | Retry with exponential backoff (extension uses up to 6 attempts), `AbortController` per job so Pause/Cancel stop in-flight requests, honours `Range`, replays the stored request headers and native cookies. |
| `SegmentWriter` | **Writes each segment straight to its own temp file on the native side** (for example with the file-system module's native download API to `…/<job>/<index>.seg`), never through Base64 in JS. If the installed SDK offers a file-handle API with `Uint8Array` writes, that is an acceptable alternative. |
| `Decryptor` | AES-128 CBC decrypt per segment (key fetch + IV from `#EXT-X-KEY` / media sequence), natively or with WebCrypto-compatible code that does not run per-byte in JS. |
| `Muxer` | Joins video + audio (+ subtitles) into one MP4 without re-encoding. See 6.3. |
| `SpeedMeter` | See 6.2. |
| `Notifier` | Foreground service + notification with progress, speed, Pause/Cancel actions (Android), so downloads continue in the background. |

### 6.2 Speed indicator (required)

Implement `SpeedMeter` as a **sliding window**: keep `(timestamp, totalBytesDone)` samples for the last 5 seconds; `speed = Δbytes / Δtime` over the window, then smooth with an exponential moving average. Feed it from the **Fetcher** on every received chunk, not once per finished segment. Rules:

- Show speed from the first second (no "0 KB/s" while segments are in flight).
- Throttle UI notifications to about 4 per second per job.
- Show: `bytes done / total (or "unknown size")`, `speed` (MB/s and Mbps), `ETA`, `segments done/total`, `% progress`. If total size is unknown, show indeterminate progress based on segment count — **never invent a size**.
- Show it in **all** of these places: Downloads list rows, the "Videos on this page" sheet (inline progress under the item), a small floating pill in the browser when a download is active (tap → Downloads) with total speed, the Android notification, and a header row on the Downloads screen with total speed across jobs.

### 6.3 Output format and muxing

- ffmpeg-kit (the common React Native FFmpeg wrapper) **was retired upstream in 2025**; do not add it without checking a maintained fork and its licence *(verify)*.
- Preferred: a small **native module** that remuxes with platform APIs without re-encoding: Android `MediaMuxer` + `MediaExtractor`, iOS `AVMutableComposition` / `AVAssetExportSession` (passthrough). This handles: TS/fMP4 segments → MP4, separate audio + video → one MP4, subtitles → `mov_text` where supported.
- Fallback when remux fails or a codec/container is not supported: keep the concatenated `.ts` / `.m4s` with the **honest extension** (`.ts`), say so in the UI, and offer "Share" to an external player. Never name a `.ts` file `.mp4`.
- Direct MP4/WebM files: no remux needed; keep the real extension.

### 6.4 Per-type behaviour

| Type | Behaviour |
|---|---|
| Direct file | Native resumable download. If the server supports `Accept-Ranges`, split large files into 4 parallel ranges and join natively. Resume after restart using the partial file + `Range`. |
| HLS | Parse master (variants, `#EXT-X-MEDIA` audio/subtitle groups). User picks quality (+ audio language). Download the video playlist **and** the audio playlist, handle `#EXT-X-MAP`, `#EXT-X-BYTERANGE`, AES-128 keys, then mux. Skip live streams (no `#EXT-X-ENDLIST`) with a clear message, or offer "record until stopped" later. |
| DASH | Port the extension's MPD handling (`Df`) including `SegmentTemplate`, `SegmentList`, `SegmentBase`, multiple periods. Download video + audio tracks, then mux. |
| DRM / Embed | Not downloadable. No button. |

### 6.5 Data and privacy

- In-progress files use random names (already the case — keep it). Final name from title via the sanitiser, keep the original `sourcePageUrl` in the DB row, and keep the "open source page" action.
- "Delete record" and "Delete file + record" must also remove thumbnails and temp segment folders.
- No size guesses. Remove the `155189248` constant.
- Wi-Fi-only setting (currently unwired) must really block starting/continuing jobs on mobile data, and pause running jobs when Wi-Fi drops.

### 6.6 Optional but recommended: real network-level ad/tracker blocking (INJ-9)

If the owner wants "ad blocker" to mean what users expect, add Layer B (section 5.3) with a **block decision** in `shouldInterceptRequest` (return an empty response for matches) using a compiled hostname set (EasyList/EasyPrivacy-derived, bundled, updated through the app's own signed update path only). Count real blocks per tab. Per-site allow list uses the same host matching. Until this exists, do not claim "blocks ads".

### 6.7 Acceptance for Phase 4

- A 500 MB direct MP4 and a 200-segment HLS download on the same connection are at least **3× faster** than the old code (record numbers in `docs/CHANGELOG.md`).
- The speed indicator updates at least 3 times per second, is visible in every place listed in 6.2, and stays correct when paused/resumed.
- Kill the app mid-download → reopen → the job shows as paused and resumes.
- HLS with separate audio plays **with sound**; an AES-128 stream plays; a DASH stream downloads.
- Cancel really aborts network traffic (verify in logs).

---

## 7. Feature audit — broken, unfinished or fake (decide per row)

| Feature | Today | Action |
|---|---|---|
| Proxy (HTTP/HTTPS/SOCKS5, profiles, test, fail-closed) | UI only; no code uses it | Implement through the platform WebView proxy override (Android `androidx.webkit` ProxyController, iOS `WKWebsiteDataStore.proxyConfigurations`; both need a small native module *(verify)*), or hide the whole screen. "Block if proxy fails" must really block. |
| OpenVPN / WireGuard import, kill switch, per-app routing | UI + config validator only; no tunnel exists | A VPN needs an Android `VpnService` implementation (large native work). Until done: **remove the UI** or label it "Coming soon (not active)". Do not show a connect switch. |
| User agent presets / custom / per-site | Global UA is applied to the WebView; per-site not applied | Apply per-site through the new per-tab policy (3.3). Keep JS-visible values (`navigator.*`) consistent with the HTTP UA. |
| Language / timezone spoofing | Only `Intl.DateTimeFormat` is patched; `Date`, `getTimezoneOffset`, `toLocaleString` still reveal the real timezone | Patch consistently or remove the option. |
| Screen size rounding | Works partially (`screen.*` only; `innerWidth` etc. unchanged) | Document limits or remove. |
| Fingerprint hardening | Canvas noise harmful (INJ-3), `deviceMemory`/`hardwareConcurrency` fixed values, enumerateDevices fake | Fix canvas; keep simple spoofs; remove claims you can't prove. |
| Block cookies (`blockCookies`) | Not applied | Implement with isolation props + per-tab cookie clearing, or remove. |
| JS off globally / per site | Global prop works; per-site not applied; toggling needs a reload | Apply per-site; reload the tab after the change; show a banner "JavaScript is off for this site". |
| Block third-party scripts / images / fonts / beacons / autoplay / service workers | Partly cosmetic (INJ-1…INJ-8) | See 3.3. |
| Permissions (`defaultDenyPermissions`, per-site `site_permissions`) | UI only; mic/camera auto-granted | Implement per-site prompts (3.2). |
| `blockDriveByNav`, `confirmAppRedirects` | UI only | Wire into `onShouldStartLoadWithRequest`. |
| `wifiOnly` | UI only | Wire into the download queue (6.5). |
| `screenOffLock`, `privateKeyboard` | UI only | Wire (lock when screen turns off; `autoComplete="off"`, `importantForAutofill="no"`, no suggestions/learning on every `TextInput` in the address bar). |
| Desktop mode (`desktopMode`, `toggleDesktopMode`) | State exists, no UI, not used | Implement (desktop UA + viewport) or delete. |
| Per-site settings page (`site_settings`, `PolicyEngine.resolvePolicy`) | Saved, never applied | Apply (PERF-2). |
| Panic wipe / "Clear everything" / duress password / wipe after N failures | Wipes DB rows only | Use `WipeService` (section 4, item 4). |
| Biometric unlock | Works through `expo-local-authentication` | Keep; also bind biometric to a keystore key that unwraps the DB key. |
| Bookmarks | Stored in DB | Add edit, folders, delete-all, import/export (encrypted). |
| Tabs screen previews | Uses `og:image`, not a real snapshot | Capture a real snapshot on tab switch (cheap, low-res, memory only). |
| Search suggestions | Calls Google's suggest endpoint on every keystroke (150 ms) | This **leaks every keystroke to Google even if the user chose DuckDuckGo.** Use the selected engine's own suggest endpoint, make it **off by default** (privacy), and show a clear toggle. |
| Voice / camera search shortcuts | Navigate to engine pages and auto-click mic | Fragile selectors; keep only if they work, otherwise remove. Needs the permission flow in 3.2. |
| `docs/CHANGELOG.md`, `docs/extension-audit.md` | Claim exact/complete behaviour that does not exist | Rewrite after each phase with the real status. |
| `tests/*.test.mjs` | Test copies of logic, not the app (SEC-8) | Replace (section 8). |

---

## 8. Tests and quality

1. **Delete or rewrite** `tests/unit.test.mjs` and `tests/feature-register.test.mjs` so every test imports the real module (`src/...`). Put pure logic in files with no React/Expo imports so Node can test it: URL normalising, privacy URL cleaning, HLS/DASH parsers, detection `rules.ts`, `SpeedMeter`, segment pool, history/navigation reducer, policy resolution.
2. Add **fixtures**: real-world M3U8 (master with audio groups, AES-128, fMP4 with `EXT-X-MAP`, byte ranges), MPD (SegmentTemplate, SegmentList, multi-period), header sets for the media rules.
3. Add a **navigation reducer test**: random sequences of load/redirect/back/forward events never produce a state where Back and Forward disagree with the simulated native stack.
4. Add a **manual test matrix** file `docs/TEST_MATRIX.md` with the pages and cases listed in 3.5, 5.6, 6.7 and a place to record pass/fail per device (at least one Android phone; iOS if available).
5. Fix the `package.json` `test` script so it runs the real tests and fails when they fail.
6. Add `scripts/check-ui-settings.mjs`: fails the build if a setting in `browserStore` is not read anywhere outside the settings screens (catches future UI-only toggles).

---

## 9. Suggested order of work (one PR each)

1. **PR 1** — Step 0 reproduction + logging; NAV model rewrite (3.1); open-source-page fix.
2. **PR 2** — WebView handlers (3.2): errors, crash recovery, new-window, Stop button, `onShouldStartLoadWithRequest` fixes, permission fix (remove auto-grant).
3. **PR 3** — Injected scripts (3.3) + selectors/perf (3.4).
4. **PR 4** — Encrypted DB, settings persistence, real wipe, lock behaviour (section 4).
5. **PR 5** — Detection rule engine + tests (5.1, 5.5) and JS layer A in all frames.
6. **PR 6** — Native request observer for Android (layer B) + cookie/header replay.
7. **PR 7** — Download engine: queue, pool, fetcher, writer, speed meter, notification (6.1–6.2, 6.5).
8. **PR 8** — HLS audio/AES-128, DASH, muxer module (6.3–6.4).
9. **PR 9** — Site extractors (5.4), one site per commit.
10. **PR 10** — Feature audit decisions (section 7) and new features (section 10).
11. **PR 11** — Docs and tests cleanup (section 8).

---

## 10. New features that would make the app better

Ordered by value for a privacy-first browser. Implement only those the owner approves, and each must be fully working.

**Core browsing**
1. Find in page, Reader view, "Request desktop site" toggle per tab (wire the existing `desktopMode`).
2. Real offline error page, "Open in new tab", long-press link menu (open in new tab, copy link, download link).
3. Per-site shield panel (blocked count, JS on/off, images on/off, permissions, UA) using the already-built per-site settings.
4. Tab groups and "close all tabs" with undo; recently closed tabs are **not** stored (privacy).
5. Set as default browser (Android intent filters for `http/https`), and "Open with Private Browser" share target.

**Privacy**
6. HTTPS-first with fallback interstitial (3.2).
7. Cookie banner auto-dismiss (real rules, not only CSS hiding) and tracking-parameter stripping on link clicks (today it only runs on typed URLs).
8. Link-click referrer trimming (`Referrer-Policy: strict-origin` equivalent).
9. Privacy report per site and per session (local only).
10. Auto-wipe: clear cookies/cache when a tab closes, on app exit, or on a timer.
11. DNS-over-HTTPS *(only if the platform proxy/DNS layer allows it)*.

**Downloads and video**
12. Quality + audio language + subtitle picker before download; batch download of several items.
13. Download notification with speed, Pause/Cancel; resume after restart; Wi-Fi-only (working).
14. Built-in local player (already have `VideoPlayerModal`) with playback speed, resume position, and "play without saving".
15. Paste-a-link download: user pastes a media URL, the app probes it with the same rules.
16. Storage manager: show space used, delete by age/size, "delete file + record".
17. Export downloaded file to Downloads (SAF on Android) with progress, without loading the whole file into memory.

**Security**
18. Encrypted backup/export of settings and bookmarks (password protected, local file).
19. Secure keyboard flags, screenshot blocking toggle, auto-lock after screen off (wire existing).
20. Local crash log viewer (opt-in, never uploaded) — already selected by the owner.

---

## 11. Definition of done (whole project)

- No setting appears in the UI unless it works; the check in section 8.6 passes.
- Browsing test list (3.5) passes on a real Android device.
- Detection test list (5.6) passes; `rules.ts` tests pass.
- Download acceptance (6.7) passes with recorded numbers.
- DB cannot be opened without the key; wipe verified by test.
- `docs/` describes only what is true. `npx tsc --noEmit`, `npx expo lint`, `npm test` all pass.

---

## Appendix A — Extension function map (beautified `service.pretty.js`)

| Name | Meaning |
|---|---|
| `If` | registers `onSendHeaders` / `onResponseStarted` listeners |
| `NS` | main response handler (rules in 5.1) |
| `Ef` | HLS handler: fetch playlist with saved headers → master or media playlist → `on_media` |
| `Lm` / `Vm` / `Af` | HLS master parser, subtitle extraction, duration + DRM/AES check |
| `IS` | DASH handler |
| `Df` / `kf` | MPD parser, MPD subtitle extraction |
| `OS` | direct media handler (size filters, byte ranges, filename) |
| `Pf` | `Content-Type` → media type using table `jm` |
| `$S` | filename + extension from `Content-Disposition`, URL, content type; allowed set `bv` |
| `PS` | domains skipped because they have their own extractor |
| `sp`, `ap`, `lp`, `up` | per-host settings: `CONVERT_MPD_URL_TO_M3U8`, `FILTER_HTTP_M3U8_MEDIA`, `ALLOW_SMALL_FILE_DETECTION`, `DISABLE_PREVIEW_LOADING` |
| `Of` | reads page title + thumbnail through `scripting.executeScript` |
| `_p` | builds download arguments (strategy, headers, muxer, `will_use_jsfetch`) per media type |
| `ru` | runs a download/preview job |

Download worker (`download_worker/main.js`): segment semaphore `fn = 4` (1 when throttled), `MAX_FETCH_ATTEMPTS = 6`, `MAX_READ_ATTEMPTS = 6`, AES-128 decrypt with WebCrypto, libav (wasm ffmpeg) with `-c copy` for muxing HLS/DASH video + audio + subtitles into MP4, strategies such as `http_audio_video_one_source`, `http_audio_video_two_sources_jsfetch`, `m3u8_audio_video_two_sources`, `mpd_audio_video_one_source`.

## Appendix B — Small code sketches (illustrative; verify APIs for the installed versions)

**Segment pool (no batch barrier):**
```ts
async function runPool<T>(items: T[], limit: number, task: (item: T, i: number) => Promise<void>, signal: AbortSignal) {
  let next = 0;
  const worker = async () => {
    while (!signal.aborted) {
      const i = next++;
      if (i >= items.length) return;
      await task(items[i], i);          // retries and backoff live inside task
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}
```

**Speed meter (sliding window + EMA):**
```ts
class SpeedMeter {
  private samples: { t: number; bytes: number }[] = [];
  private ema = 0;
  add(totalBytes: number, now = Date.now()) {
    this.samples.push({ t: now, bytes: totalBytes });
    while (this.samples.length > 2 && now - this.samples[0].t > 5000) this.samples.shift();
    const a = this.samples[0], b = this.samples[this.samples.length - 1];
    const dt = (b.t - a.t) / 1000;
    if (dt > 0.2) {
      const inst = (b.bytes - a.bytes) / dt;
      this.ema = this.ema ? this.ema * 0.6 + inst * 0.4 : inst;
    }
    return this.ema;                    // bytes per second
  }
}
```

**One-time navigation request (the store never feeds URLs back to the WebView):**
```ts
navigate: (tabId, url) => set(s => ({
  tabs: s.tabs.map(t => t.id === tabId
    ? { ...t, isBlank: false, homeForward: false, loadRequest: { url, nonce: (t.loadRequest?.nonce ?? 0) + 1 } }
    : t),
})),
```
