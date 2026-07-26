import test from 'node:test';
import assert from 'node:assert';
import {
  evaluateDetectionRules,
  mapContentTypeToExtension,
  parseContentDispositionFilename,
  resolveFilenameAndExtension,
  hashString,
} from '../src/video/detection/rules.ts';

test('Rule 1: Ignore non-2xx HTTP status codes', () => {
  const res = evaluateDetectionRules({
    url: 'https://example.com/video.mp4',
    statusCode: 404,
    headers: { 'content-type': 'video/mp4', 'content-length': '5000000' },
  });
  assert.strictEqual(res.matched, false);
  assert.strictEqual(res.reason, 'status_not_2xx');
});

test('Rule 2: Ignore segment URLs (.ts, .m4s, .m2ts)', () => {
  const tsRes = evaluateDetectionRules({
    url: 'https://cdn.example.com/stream/segment104.ts?token=abc',
    headers: { 'content-type': 'video/mp2t', 'content-length': '1500000' },
  });
  assert.strictEqual(tsRes.matched, false);
  assert.strictEqual(tsRes.reason, 'segment_ignored');

  const m4sRes = evaluateDetectionRules({
    url: 'https://cdn.example.com/dash/chunk_12.m4s',
    headers: { 'content-type': 'video/iso.segment', 'content-length': '800000' },
  });
  assert.strictEqual(m4sRes.matched, false);
  assert.strictEqual(m4sRes.reason, 'segment_ignored');
});

test('Rule 3: Special cases (Vimeo config and iQIYI dash)', () => {
  const vimeo = evaluateDetectionRules({
    url: 'https://player.vimeo.com/video/987654321/config',
    headers: { 'content-type': 'application/json' },
  });
  assert.strictEqual(vimeo.matched, true);
  assert.strictEqual(vimeo.specialExtractor, 'vimeo_config');

  const iqiyi = evaluateDetectionRules({
    url: 'https://intl-api.iq.com/player/v1/dash',
    headers: { 'content-type': 'application/json' },
  });
  assert.strictEqual(iqiyi.matched, true);
  assert.strictEqual(iqiyi.specialExtractor, 'iqiyi_config');
});

test('Rule 4: Domain exclusions for dedicated site extractors', () => {
  const yt = evaluateDetectionRules({
    url: 'https://rr2---sn-4g5ednks.googlevideo.com/videoplayback?id=123',
    pageUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    headers: { 'content-type': 'video/mp4', 'content-length': '15000000' },
  });
  assert.strictEqual(yt.matched, false);
  assert.strictEqual(yt.reason, 'handled_by_extractor_youtube.com');
});

test('Rule 6: HLS stream detection (Content-Type, URL, /api/playlist/master/)', () => {
  // Via Content-Type
  const hls1 = evaluateDetectionRules({
    url: 'https://video.host.com/live/stream?session=123',
    headers: { 'content-type': 'application/vnd.apple.mpegurl' },
  });
  assert.strictEqual(hls1.matched, true);
  assert.strictEqual(hls1.type, 'hls_master');

  // Via URL .m3u8
  const hls2 = evaluateDetectionRules({
    url: 'https://video.host.com/hls/master.m3u8?token=xyz',
    headers: { 'content-type': 'application/octet-stream' },
  });
  assert.strictEqual(hls2.matched, true);
  assert.strictEqual(hls2.type, 'hls_master');

  // Via master playlist API path
  const hls3 = evaluateDetectionRules({
    url: 'https://service.com/api/playlist/master/?id=456',
    headers: { 'content-type': 'application/octet-stream' },
  });
  assert.strictEqual(hls3.matched, true);
  assert.strictEqual(hls3.type, 'hls_master');
});

test('Rule 8: DASH stream detection (Content-Type and URL)', () => {
  const dash1 = evaluateDetectionRules({
    url: 'https://cdn.example.com/manifest.mpd',
    headers: { 'content-type': 'application/octet-stream' },
  });
  assert.strictEqual(dash1.matched, true);
  assert.strictEqual(dash1.type, 'dash');

  const dash2 = evaluateDetectionRules({
    url: 'https://cdn.example.com/stream/manifest',
    headers: { 'content-type': 'application/dash+xml' },
  });
  assert.strictEqual(dash2.matched, true);
  assert.strictEqual(dash2.type, 'dash');
});

test('Rule 9: Size filter (below 500,000 bytes ignored)', () => {
  const small = evaluateDetectionRules({
    url: 'https://cdn.example.com/clip.mp4',
    headers: { 'content-type': 'video/mp4', 'content-length': '499999' },
  });
  assert.strictEqual(small.matched, false);
  assert.strictEqual(small.reason, 'small_file_ignored');

  const allowedSmall = evaluateDetectionRules(
    {
      url: 'https://cdn.example.com/clip.mp4',
      headers: { 'content-type': 'video/mp4', 'content-length': '499999' },
    },
    { allowSmallFiles: true }
  );
  assert.strictEqual(allowedSmall.matched, true);
});

test('Rule 9: Anti-spam filter (files < 20MB ignored if page has manifest)', () => {
  const spam = evaluateDetectionRules(
    {
      url: 'https://cdn.example.com/subclip.mp4',
      headers: { 'content-type': 'video/mp4', 'content-length': '15000000' },
    },
    { hasManifestStream: true }
  );
  assert.strictEqual(spam.matched, false);
  assert.strictEqual(spam.reason, 'anti_spam_segment_ignored');

  const legit = evaluateDetectionRules(
    {
      url: 'https://cdn.example.com/fullmovie.mp4',
      headers: { 'content-type': 'video/mp4', 'content-length': '25000000' },
    },
    { hasManifestStream: true }
  );
  assert.strictEqual(legit.matched, true);
});

test('Rule 9: jm Content-Type table mapping and Content-Disposition filename', () => {
  assert.strictEqual(mapContentTypeToExtension('video/x-matroska; charset=binary'), 'mkv');
  assert.strictEqual(mapContentTypeToExtension('video/mp4'), 'mp4');
  assert.strictEqual(mapContentTypeToExtension('audio/x-pn-wave'), 'wav');
  assert.strictEqual(mapContentTypeToExtension('video/webm'), 'webm');

  const filename = parseContentDispositionFilename('attachment; filename="trailer_hd_1080p.mp4"');
  assert.strictEqual(filename, 'trailer_hd_1080p.mp4');

  const utf8Filename = parseContentDispositionFilename("attachment; filename*=UTF-8''my%20cool%20movie.mkv");
  assert.strictEqual(utf8Filename, 'my cool movie.mkv');

  const resolved = resolveFilenameAndExtension(
    'https://server.com/download?id=123',
    'video/x-matroska',
    'attachment; filename="featured_documentary.mkv"'
  );
  assert.strictEqual(resolved.filename, 'featured_documentary');
  assert.strictEqual(resolved.extension, 'mkv');
});

test('Hash calculation produces consistent deduplication keys', () => {
  const hash1 = hashString('https://cdn.example.com/video.mp4');
  const hash2 = hashString('https://cdn.example.com/video.mp4');
  const hash3 = hashString('https://cdn.example.com/other.mp4');
  assert.strictEqual(hash1, hash2);
  assert.notStrictEqual(hash1, hash3);
});
