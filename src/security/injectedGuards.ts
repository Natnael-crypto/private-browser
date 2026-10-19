/**
 * Injected Security Guards
 * Document-start JavaScript guards for identity spoofing, fingerprint neutralization,
 * content control, permission gates, and safety warnings.
 */

export interface SecurityGuardOptions {
  currentHost?: string;
  userAgent?: string;
  language?: string;
  timezone?: string;
  roundScreen?: boolean;
  reduceFingerprinting?: boolean;
  blockThirdPartyScripts?: boolean;
  blockAutoplay?: boolean;
  blockLocalNetwork?: boolean;
  blockImages?: boolean;
  blockWebFonts?: boolean;
  blockServiceWorkers?: boolean;
  blockBeacons?: boolean;
  blockClipboardRead?: boolean;
  detectInsecureForms?: boolean;
}

export function buildInjectedSecurityGuards(options: SecurityGuardOptions): string {
  const currentHost = options.currentHost || '';
  const lang = options.language || 'en-US';
  const tz = options.timezone || 'UTC';
  const roundScreen = Boolean(options.roundScreen);
  const reduceFingerprinting = Boolean(options.reduceFingerprinting);
  const blockThirdPartyScripts = Boolean(options.blockThirdPartyScripts);
  const blockLocalNetwork = Boolean(options.blockLocalNetwork);
  const blockImages = Boolean(options.blockImages);
  const blockWebFonts = Boolean(options.blockWebFonts);
  const blockServiceWorkers = Boolean(options.blockServiceWorkers);
  const blockBeacons = Boolean(options.blockBeacons);
  const blockClipboardRead = Boolean(options.blockClipboardRead);
  const detectInsecureForms = Boolean(options.detectInsecureForms);

  return `
    (function() {
      try {
        const HOST = "${currentHost.replace(/"/g, '\\"')}";

        // --- IDN-6: Language Spoofing ---
        ${
          options.language
            ? `
          try {
            const spoofLang = "${lang.replace(/"/g, '\\"')}";
            Object.defineProperty(navigator, 'language', { get: () => spoofLang, configurable: true });
            Object.defineProperty(navigator, 'languages', { get: () => [spoofLang, 'en'], configurable: true });
          } catch(e) {}
        `
            : ''
        }

        // --- IDN-7: Timezone Spoofing ---
        ${
          options.timezone
            ? `
          try {
            const targetTz = "${tz.replace(/"/g, '\\"')}";
            const OrigDateTimeFormat = Intl.DateTimeFormat;
            Intl.DateTimeFormat = function(locales, dtfOptions) {
              const opts = Object.assign({}, dtfOptions);
              if (!opts.timeZone) {
                opts.timeZone = targetTz;
              }
              return new OrigDateTimeFormat(locales, opts);
            };
            Intl.DateTimeFormat.prototype = OrigDateTimeFormat.prototype;
            Intl.DateTimeFormat.supportedLocalesOf = OrigDateTimeFormat.supportedLocalesOf;
          } catch(e) {}
        `
            : ''
        }

        // --- IDN-8: Screen Resolution Rounding ---
        ${
          roundScreen
            ? `
          try {
            const roundTo100 = (val) => Math.round(val / 100) * 100;
            const w = roundTo100(window.screen.width || 390);
            const h = roundTo100(window.screen.height || 844);
            Object.defineProperty(screen, 'width', { get: () => w });
            Object.defineProperty(screen, 'height', { get: () => h });
            Object.defineProperty(screen, 'availWidth', { get: () => w });
            Object.defineProperty(screen, 'availHeight', { get: () => h });
            Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
            Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
          } catch(e) {}
        `
            : ''
        }

        // --- FPH-1 & FPH-2 & FPH-3: Fingerprint Hardening ---
        ${
          reduceFingerprinting
            ? `
          try {
            // Hardware Concurrency & Memory
            if ('hardwareConcurrency' in navigator) {
              Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4, configurable: true });
            }
            if ('deviceMemory' in navigator) {
              Object.defineProperty(navigator, 'deviceMemory', { get: () => 8, configurable: true });
            }

            // Neutralize Battery API
            if ('getBattery' in navigator) {
              navigator.getBattery = undefined;
            }

            // Neutralize Sensors
            delete window.AmbientLightSensor;
            delete window.Accelerometer;
            delete window.Gyroscope;
            delete window.Magnetometer;

            // Neutralize Media Devices Enumeration (FPH-3)
            if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
              navigator.mediaDevices.enumerateDevices = async function() {
                return [
                  { deviceId: 'default', kind: 'audioinput', label: 'Microphone', groupId: 'group1' },
                  { deviceId: 'default', kind: 'videoinput', label: 'Camera', groupId: 'group2' }
                ];
              };
            }

            // AudioContext noise
            if (window.AudioBuffer && window.AudioBuffer.prototype.getChannelData) {
              const origGetChannelData = AudioBuffer.prototype.getChannelData;
              AudioBuffer.prototype.getChannelData = function(channel) {
                const data = origGetChannelData.call(this, channel);
                if (data && data.length > 0) {
                  data[data.length - 1] += 0.0000001;
                }
                return data;
              };
            }
          } catch(e) {}
        `
            : ''
        }

        // --- SCR-2: Block Third-Party Scripts ---
        ${
          blockThirdPartyScripts
            ? `
          try {
            function isThirdParty(src) {
              if (!src) return false;
              try {
                const u = new URL(src, window.location.href);
                const pageDomain = window.location.hostname.split('.').slice(-2).join('.');
                const scriptDomain = u.hostname.split('.').slice(-2).join('.');
                return pageDomain && scriptDomain && pageDomain !== scriptDomain;
              } catch(e) {
                return false;
              }
            }

            const origCreateElement = document.createElement;
            document.createElement = function(tagName, options) {
              const el = origCreateElement.call(document, tagName, options);
              if (tagName && String(tagName).toLowerCase() === 'script') {
                const origSetAttr = el.setAttribute;
                el.setAttribute = function(name, val) {
                  if (name && name.toLowerCase() === 'src' && isThirdParty(val)) {
                    return;
                  }
                  return origSetAttr.apply(this, arguments);
                };
                Object.defineProperty(el, 'src', {
                  set: function(val) {
                    if (isThirdParty(val)) {
                      return;
                    }
                    el.setAttribute('src', val);
                  },
                  get: function() {
                    return el.getAttribute('src') || '';
                  }
                });
              }
              return el;
            };
          } catch(e) {}
        `
            : ''
        }

        // --- SCR-3: Autoplay handled via WebView prop mediaPlaybackRequiresUserAction ---

        // --- SCR-4: Block Local Network Access ---
        ${
          blockLocalNetwork
            ? `
          try {
            function isLocalHost(host) {
              if (!host) return false;
              const h = host.toLowerCase().trim();
              if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]') return true;
              if (h.startsWith('10.') || h.startsWith('192.168.') || h.startsWith('169.254.')) return true;
              if (/^172\\.(1[6-9]|2[0-9]|3[0-1])\\./.test(h)) return true;
              if (h.endsWith('.local') || h.endsWith('.internal')) return true;
              return false;
            }

            // Intercept fetch
            if (window.fetch) {
              const origFetch = window.fetch;
              window.fetch = function(resource, init) {
                try {
                  const urlStr = typeof resource === 'string' ? resource : (resource && resource.url) || '';
                  const u = new URL(urlStr, window.location.href);
                  if (isLocalHost(u.hostname)) {
                    return Promise.reject(new Error('Blocked local network access for security (SCR-4)'));
                  }
                } catch(e) {}
                return origFetch.apply(this, arguments);
              };
            }

            // Intercept XMLHttpRequest
            if (window.XMLHttpRequest) {
              const origOpen = XMLHttpRequest.prototype.open;
              XMLHttpRequest.prototype.open = function(method, url) {
                let isBlocked = false;
                try {
                  const u = new URL(url, window.location.href);
                  if (isLocalHost(u.hostname)) {
                    isBlocked = true;
                  }
                } catch(e) {}
                if (isBlocked) {
                  throw new Error('Blocked local network access for security (SCR-4)');
                }
                return origOpen.apply(this, arguments);
              };
            }

            // Intercept WebSocket
            if (window.WebSocket) {
              const OrigWS = window.WebSocket;
              window.WebSocket = function(url, protocols) {
                try {
                  const u = new URL(url, window.location.href);
                  if (isLocalHost(u.hostname)) {
                    throw new Error('Blocked local network access for security (SCR-4)');
                  }
                } catch(e) {
                  if (e.message && e.message.includes('SCR-4')) throw e;
                }
                return new OrigWS(url, protocols);
              };
              window.WebSocket.prototype = OrigWS.prototype;
            }
          } catch(e) {}
        `
            : ''
        }

        // --- SCR-5: Block Images (img & picture only, keep SVG icons & Video players intact) ---
        ${
          blockImages
            ? `
          try {
            const imgStyle = document.createElement('style');
            imgStyle.innerHTML = 'img, picture { display: none !important; opacity: 0 !important; visibility: hidden !important; }';
            (document.head || document.documentElement).appendChild(imgStyle);
          } catch(e) {}
        `
            : ''
        }

        // --- SCR-6: Block Remote Web Fonts ---
        ${
          blockWebFonts
            ? `
          try {
            const fontStyle = document.createElement('style');
            fontStyle.innerHTML = '@font-face { font-family: none !important; src: none !important; }';
            (document.head || document.documentElement).appendChild(fontStyle);
          } catch(e) {}
        `
            : ''
        }

        // --- SCR-7: Block Service Workers (preserve window.Worker for site functionality) ---
        ${
          blockServiceWorkers
            ? `
          try {
            if (navigator.serviceWorker) {
              navigator.serviceWorker.register = function() {
                return Promise.reject(new Error('Service workers blocked for privacy (SCR-7)'));
              };
            }
          } catch(e) {}
        `
            : ''
        }

        // --- SCR-9: Block Beacon & Ping API ---
        ${
          blockBeacons
            ? `
          try {
            if (navigator.sendBeacon) {
              navigator.sendBeacon = function() { return false; };
            }
            // Strip ping attributes
            document.addEventListener('click', function(e) {
              var t = e.target;
              while (t && t !== document) {
                if (t.tagName === 'A' && t.hasAttribute('ping')) {
                  t.removeAttribute('ping');
                }
                t = t.parentElement;
              }
            }, true);
          } catch(e) {}
        `
            : ''
        }

        // --- PRM-3: Protect Clipboard Read ---
        ${
          blockClipboardRead
            ? `
          try {
            if (navigator.clipboard) {
              navigator.clipboard.readText = function() {
                if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'pb_clipboard_read_blocked',
                    host: window.location.hostname
                  }));
                }
                return Promise.reject(new DOMException('Clipboard read access denied.', 'NotAllowedError'));
              };
              navigator.clipboard.read = function() {
                return Promise.reject(new DOMException('Clipboard read access denied.', 'NotAllowedError'));
              };
            }
          } catch(e) {}
        `
            : ''
        }

        // --- SAF-2: Detect Insecure Form Submissions ---
        ${
          detectInsecureForms
            ? `
          try {
            document.addEventListener('submit', function(e) {
              var form = e.target;
              if (form && form.tagName === 'FORM') {
                var action = form.getAttribute('action') || window.location.href;
                try {
                  var actUrl = new URL(action, window.location.href);
                  if (actUrl.protocol === 'http:' || window.location.protocol === 'http:') {
                    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'pb_insecure_form_detected',
                        host: window.location.hostname,
                        action: actUrl.toString()
                      }));
                    }
                  }
                } catch(err) {}
              }
            }, true);
          } catch(e) {}
        `
            : ''
        }

      } catch(outerErr) {}
    })();
  `;
}
