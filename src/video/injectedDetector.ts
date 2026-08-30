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