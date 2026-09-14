/**
 * Injected Video Detection Script (VID-1, VID-2, VID-3, VID-6, VID-8)
 * Ported and enhanced from Video Download Helper extension logic:
 * - DOM inspection of video / audio / source / iframe tags
 * - Network interception of media URLs (.mp4, .m3u8, .mpd, .webm, streaming endpoints) via fetch, XHR & PerformanceObserver
 * - HTMLMediaElement.prototype.play hook
 * - Safe relative-to-absolute URL conversion
 * - Robust error handling around MutationObserver and lifecycle events
 * - DRM detection via EME hooks and manifest tags
 */

export const INJECTED_VIDEO_DETECTOR_SCRIPT = `
(function() {
  if (window.__PB_DETECTOR_INSTALLED) {
    if (window.__pb_scan) {
      try { window.__pb_scan(); } catch(e) {}
    }
    return;
  }
  window.__PB_DETECTOR_INSTALLED = true;

  var reportedMediaUrls = new Set();

  function toAbsoluteUrl(url) {
    if (!url || typeof url !== 'string') return '';
    try {
      return new URL(url, window.location.href).href;
    } catch(e) {
      return url;
    }
  }

  var SEGMENT_REGEX = /\.(?:ts|m4s|m2ts)(?:[?#]|$)/i;

  function isMediaUrl(url) {
    if (!url || typeof url !== 'string') return false;
    var u = url.trim();
    if (u.indexOf('blob:') === 0 || u.indexOf('data:') === 0 || u.indexOf('javascript:') === 0) return false;
    if (SEGMENT_REGEX.test(u)) return false;

    var clean = u.split('?')[0].split('#')[0].toLowerCase();
    if (clean.endsWith('.mp4') || clean.endsWith('.m3u8') || clean.endsWith('.mpd') ||
        clean.endsWith('.webm') || clean.endsWith('.m4v') || clean.endsWith('.mov') ||
        clean.endsWith('.ogv') || clean.endsWith('.mkv') || clean.endsWith('.flv') || clean.endsWith('.avi')) {
      return true;
    }

    if (u.indexOf('/videoplayback') !== -1) return true;
    if (u.indexOf('.m3u8') !== -1 || u.indexOf('.mpd') !== -1) return true;
    if (u.indexOf('mime=video') !== -1 || u.indexOf('mime%2Fvideo') !== -1 || u.indexOf('mime=audio%2Fmp4') !== -1) return true;

    return false;
  }

  function guessFormat(url) {
    if (!url) return 'MP4';
    var clean = url.split('?')[0].split('#')[0].toLowerCase();
    if (clean.endsWith('.m3u8') || url.indexOf('.m3u8') !== -1) return 'HLS';
    if (clean.endsWith('.mpd') || url.indexOf('.mpd') !== -1) return 'DASH';
    if (clean.endsWith('.webm') || url.indexOf('mime=video/webm') !== -1) return 'WebM';
    if (clean.endsWith('.m4v')) return 'M4V';
    if (clean.endsWith('.mov')) return 'MOV';
    return 'MP4';
  }

  function getBestPageTitle() {
    try {
      var ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
      if (ogTitle && ogTitle.trim()) return ogTitle.trim();
      var twTitle = document.querySelector('meta[name="twitter:title"]')?.getAttribute('content');
      if (twTitle && twTitle.trim()) return twTitle.trim();
      var h1 = document.querySelector('h1')?.innerText;
      if (h1 && h1.trim().length > 3) return h1.trim();
      return document.title || 'Video';
    } catch(e) {
      return document.title || 'Video';
    }
  }

  function getBestThumbnail() {
    try {
      var ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
      if (ogImage) return toAbsoluteUrl(ogImage);
      var twImage = document.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
      if (twImage) return toAbsoluteUrl(twImage);
      var itemImage = document.querySelector('meta[itemprop="thumbnailUrl"], meta[itemprop="image"]')?.getAttribute('content');
      if (itemImage) return toAbsoluteUrl(itemImage);
      var linkImage = document.querySelector('link[rel="image_src"]')?.getAttribute('href');
      if (linkImage) return toAbsoluteUrl(linkImage);
      var poster = document.querySelector('video[poster]')?.getAttribute('poster');
      if (poster) return toAbsoluteUrl(poster);
      return null;
    } catch(e) {
      return null;
    }
  }

  var lastManifestUrl = null;

  function postVideo(data) {
    if (!data || !data.mediaUrl || typeof data.mediaUrl !== 'string') return;
    var absUrl = toAbsoluteUrl(data.mediaUrl.trim());
    if (!absUrl || absUrl.indexOf('blob:') === 0 || absUrl.indexOf('data:') === 0 || absUrl.indexOf('javascript:') === 0) {
      return;
    }
    if (SEGMENT_REGEX.test(absUrl)) return;
    if (reportedMediaUrls.has(absUrl)) return;
    reportedMediaUrls.add(absUrl);

    var format = data.format || guessFormat(absUrl);
    if (format === 'HLS' || format === 'DASH') {
      lastManifestUrl = absUrl;
    }

    try {
      var payload = {
        type: 'pb_video_detected',
        data: {
          mediaUrl: absUrl,
          title: data.title || getBestPageTitle(),
          thumbnail: data.thumbnail || getBestThumbnail(),
          format: format,
          resolution: data.resolution || 'Auto',
          hasDrm: !!data.hasDrm,
          sourcePageUrl: window.location.href,
          frameUrl: window.location.href,
          duration: data.duration || 0,
          sizeBytes: data.sizeBytes || 0,
          cookies: document.cookie || '',
          userAgent: navigator.userAgent || '',
          headers: data.headers || undefined,
        }
      };

      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      } else {
        setTimeout(function() {
          try {
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify(payload));
            }
          } catch(e) {}
        }, 500);
      }
    } catch(e) {}
  }

  // --- 1. DOM Video & Audio Elements Inspection (VID-1) ---
  function scanDomVideos() {
    try {
      var videos = document.querySelectorAll('video');
      videos.forEach(function(v) {
        var src = v.currentSrc || v.src;
        if (!src) {
          var firstSource = v.querySelector('source');
          if (firstSource) src = firstSource.src || firstSource.getAttribute('src');
        }

        var vThumb = v.poster || v.getAttribute('poster') || getBestThumbnail();
        if (vThumb) vThumb = toAbsoluteUrl(vThumb);

        if (src) {
          if (src.indexOf('blob:') === 0 && lastManifestUrl) {
            // Associated MSE blob with last detected manifest
            postVideo({
              mediaUrl: lastManifestUrl,
              title: v.getAttribute('title') || v.getAttribute('aria-label') || getBestPageTitle(),
              thumbnail: vThumb,
              hasDrm: !!(v.mediaKeys),
            });
          } else if (src.indexOf('blob:') !== 0 && !SEGMENT_REGEX.test(src)) {
            postVideo({
              mediaUrl: src,
              title: v.getAttribute('title') || v.getAttribute('aria-label') || getBestPageTitle(),
              thumbnail: vThumb,
              resolution: v.videoWidth && v.videoHeight ? (v.videoHeight + 'p') : undefined,
              duration: v.duration,
              hasDrm: !!(v.mediaKeys),
            });
          }
        }

        var sources = v.querySelectorAll('source');
        sources.forEach(function(s) {
          var sSrc = s.src || s.getAttribute('src');
          if (sSrc && sSrc.indexOf('blob:') !== 0 && !SEGMENT_REGEX.test(sSrc)) {
            postVideo({
              mediaUrl: sSrc,
              title: v.getAttribute('title') || getBestPageTitle(),
              thumbnail: vThumb,
              resolution: s.getAttribute('size') ? (s.getAttribute('size') + 'p') : undefined,
            });
          }
        });

        if (!v.__pb_listened) {
          v.__pb_listened = true;
          var handler = function() {
            var s = v.currentSrc || v.src;
            if (s && s.indexOf('blob:') !== 0 && !SEGMENT_REGEX.test(s)) {
              postVideo({
                mediaUrl: s,
                thumbnail: v.poster || v.getAttribute('poster') || getBestThumbnail(),
                resolution: v.videoHeight ? (v.videoHeight + 'p') : undefined,
                hasDrm: !!(v.mediaKeys),
              });
            }
          };
          ['play', 'playing', 'loadedmetadata', 'loadeddata', 'canplay'].forEach(function(ev) {
            v.addEventListener(ev, handler, { passive: true });
          });
        }
      });

      var standaloneSources = document.querySelectorAll('source[src]');
      standaloneSources.forEach(function(s) {
        var sSrc = s.src || s.getAttribute('src');
        if (sSrc && isMediaUrl(sSrc)) {
          postVideo({ mediaUrl: sSrc });
        }
      });

      var iframes = document.querySelectorAll('iframe');
      iframes.forEach(function(ifr) {
        try {
          var src = ifr.src || ifr.getAttribute('src');
          if (src && (src.indexOf('vimeo.com') !== -1 || src.indexOf('youtube.com/embed') !== -1 || src.indexOf('player.') !== -1)) {
            postVideo({
              mediaUrl: src,
              title: ifr.title || getBestPageTitle(),
              format: 'Embed',
            });
          }
        } catch(e) {}
      });
    } catch(e) {}
  }

  // --- 2. Network Sniffing: Fetch & XMLHttpRequest Hooks (VID-2, VID-5) ---
  try {
    var origFetch = window.fetch;
    if (origFetch) {
      window.fetch = function(input, init) {
        var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
        var promise = origFetch.apply(this, arguments);
        if (url && typeof url === 'string') {
          promise.then(function(resp) {
            try {
              if (resp && resp.status >= 200 && resp.status <= 299) {
                var ctype = resp.headers.get('content-type') || '';
                var clen = resp.headers.get('content-length') || '';
                var crange = resp.headers.get('content-range') || '';
                var cdisp = resp.headers.get('content-disposition') || '';
                var arange = resp.headers.get('accept-ranges') || '';

                var isMediaHeader = /video|audio|mpegurl|dash/i.test(ctype);
                if (isMediaUrl(url) || isMediaHeader) {
                  var headersMap = {};
                  if (ctype) headersMap['content-type'] = ctype;
                  if (clen) headersMap['content-length'] = clen;
                  if (crange) headersMap['content-range'] = crange;
                  if (cdisp) headersMap['content-disposition'] = cdisp;
                  if (arange) headersMap['accept-ranges'] = arange;

                  var size = clen ? parseInt(clen, 10) : undefined;
                  postVideo({ mediaUrl: url, headers: headersMap, sizeBytes: size });
                }
              }
            } catch(e) {}
          }).catch(function() {});
        }
        return promise;
      };
    }
  } catch(e) {}

  try {
    var origXhrOpen = XMLHttpRequest.prototype.open;
    var origXhrSend = XMLHttpRequest.prototype.send;
    if (origXhrOpen && origXhrSend) {
      XMLHttpRequest.prototype.open = function(method, url) {
        try {
          this.__pb_req_url = typeof url === 'string' ? url : '';
        } catch(e) {}
        return origXhrOpen.apply(this, arguments);
      };

      XMLHttpRequest.prototype.send = function() {
        var xhr = this;
        try {
          xhr.addEventListener('load', function() {
            try {
              var url = xhr.__pb_req_url;
              if (url && xhr.status >= 200 && xhr.status <= 299) {
                var ctype = xhr.getResponseHeader('content-type') || '';
                var clen = xhr.getResponseHeader('content-length') || '';
                var crange = xhr.getResponseHeader('content-range') || '';
                var cdisp = xhr.getResponseHeader('content-disposition') || '';
                var arange = xhr.getResponseHeader('accept-ranges') || '';

                if (isMediaUrl(url) || /video|audio|mpegurl|dash/i.test(ctype)) {
                  var headersMap = {};
                  if (ctype) headersMap['content-type'] = ctype;
                  if (clen) headersMap['content-length'] = clen;
                  if (crange) headersMap['content-range'] = crange;
                  if (cdisp) headersMap['content-disposition'] = cdisp;
                  if (arange) headersMap['accept-ranges'] = arange;

                  var size = clen ? parseInt(clen, 10) : undefined;
                  postVideo({ mediaUrl: url, headers: headersMap, sizeBytes: size });
                }
              }
            } catch(e) {}
          }, { passive: true });
        } catch(e) {}
        return origXhrSend.apply(this, arguments);
      };
    }
  } catch(e) {}

  // --- 3. HTMLMediaElement.prototype.play Hook ---
  try {
    if (window.HTMLMediaElement && window.HTMLMediaElement.prototype.play) {
      var origPlay = window.HTMLMediaElement.prototype.play;
      window.HTMLMediaElement.prototype.play = function() {
        try {
          var src = this.currentSrc || this.src;
          if (src && src.indexOf('blob:') !== 0) {
            postVideo({
              mediaUrl: src,
              title: this.getAttribute('title') || getBestPageTitle(),
              thumbnail: this.poster || this.getAttribute('poster') || getBestThumbnail(),
            });
          }
        } catch(e) {}
        return origPlay.apply(this, arguments);
      };
    }
  } catch(e) {}

  // --- 4. PerformanceObserver for Background Network Requests (VID-2) ---
  try {
    if (window.PerformanceObserver) {
      var observer = new PerformanceObserver(function(list) {
        try {
          list.getEntries().forEach(function(entry) {
            var name = entry.name;
            if (name && isMediaUrl(name)) {
              var size = (entry.encodedBodySize && entry.encodedBodySize > 0)
                ? entry.encodedBodySize
                : ((entry.decodedBodySize && entry.decodedBodySize > 0)
                  ? entry.decodedBodySize
                  : (entry.transferSize || 0));
              postVideo({ mediaUrl: name, sizeBytes: size > 0 ? size : undefined });
            }
          });
        } catch(e) {}
      });
      observer.observe({ entryTypes: ['resource'] });
    }
  } catch(e) {}

  // --- 5. Specialized Site Extractors (Vimeo, YouTube, etc.) ---
  function scanSiteConfigs() {
    try {
      if (window.playerConfig && window.playerConfig.request && window.playerConfig.request.files) {
        var files = window.playerConfig.request.files;
        if (files.hls && files.hls.cdns) {
          Object.values(files.hls.cdns).forEach(function(cdn) {
            if (cdn && cdn.url) postVideo({ mediaUrl: cdn.url, format: 'HLS', title: window.playerConfig.video?.title });
          });
        }
        if (Array.isArray(files.progressive)) {
          files.progressive.forEach(function(p) {
            if (p && p.url) postVideo({
              mediaUrl: p.url,
              format: 'MP4',
              resolution: p.quality,
              title: window.playerConfig.video?.title
            });
          });
        }
      }
    } catch(e) {}

    try {
      if (window.ytcfg && window.ytcfg.data_ && window.ytcfg.data_.PLAYER_VARS) {
        var pvars = window.ytcfg.data_.PLAYER_VARS;
        if (pvars.embedded_player_response) {
          var parsed = JSON.parse(pvars.embedded_player_response);
          var formats = parsed?.streamingData?.formats;
          if (Array.isArray(formats)) {
            formats.forEach(function(f) {
              if (f.url) postVideo({ mediaUrl: f.url, resolution: f.qualityLabel, format: 'MP4' });
            });
          }
        }
      }
    } catch(e) {}
  }

  // --- 6. DRM Detection EME Hooks (VID-8) ---
  try {
    if (navigator.requestMediaKeySystemAccess) {
      var origRequestMediaKey = navigator.requestMediaKeySystemAccess;
      navigator.requestMediaKeySystemAccess = function(keySystem, supportedConfigurations) {
        if (keySystem && (keySystem.indexOf('widevine') !== -1 || keySystem.indexOf('playready') !== -1 || keySystem.indexOf('clearkey') !== -1 || keySystem.indexOf('fairplay') !== -1)) {
          try {
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'pb_drm_detected',
                keySystem: keySystem
              }));
            }
          } catch(e) {}
        }
        return origRequestMediaKey.apply(this, arguments);
      };
    }
  } catch(e) {}

  // --- 7. Lifecycle & Observers ---
  function startObserver() {
    try {
      var target = document.documentElement || document.body;
      if (target && !window.__pb_observer_started) {
        window.__pb_observer_started = true;
        var mutObserver = new MutationObserver(function() {
          scanDomVideos();
          scanSiteConfigs();
        });
        mutObserver.observe(target, { childList: true, subtree: true });
      }
    } catch(e) {}
  }

  window.__pb_scan = function() {
    scanDomVideos();
    scanSiteConfigs();
    startObserver();
  };

  scanDomVideos();
  scanSiteConfigs();
  startObserver();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      scanDomVideos();
      scanSiteConfigs();
      startObserver();
    });
  }
  window.addEventListener('load', function() {
    scanDomVideos();
    scanSiteConfigs();
    startObserver();
  });

  window.addEventListener('click', function() {
    setTimeout(scanDomVideos, 400);
  }, { passive: true });

  var interval = setInterval(function() {
    scanDomVideos();
    scanSiteConfigs();
    startObserver();
  }, 2500);
})();
`;
