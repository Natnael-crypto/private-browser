import test from 'node:test';
import assert from 'node:assert/strict';
import { SpeedMeter } from '../src/downloads/engine/SpeedMeter.ts';
import { SegmentPool } from '../src/downloads/engine/SegmentPool.ts';
import { Decryptor } from '../src/downloads/engine/Decryptor.ts';
import { VimeoExtractor } from '../src/video/extractors/vimeo.ts';
import { FacebookExtractor } from '../src/video/extractors/facebook.ts';

test('SpeedMeter: sliding window accurately computes transfer speed and ETA', () => {
  const totalBytes = 10_000_000; // 10 MB
  const meter = new SpeedMeter(totalBytes, 5000);

  const t0 = 10000;
  meter.recordBytes(1_000_000, t0);
  meter.recordBytes(3_000_000, t0 + 1000); // 2 MB in 1 second -> 2,000,000 B/s

  const progress = meter.getProgress(1, 10);
  assert.equal(progress.bytesDone, 3_000_000);
  assert.equal(progress.percent, 30);
  assert.ok(progress.speedBytesPerSec > 1_000_000);
  assert.ok(progress.formattedSpeed.includes('MB/s') || progress.formattedSpeed.includes('KB/s'));
  assert.ok(progress.etaSeconds !== null && progress.etaSeconds > 0);
});

test('SegmentPool: worker pool executes tasks with controlled concurrency', async () => {
  const pool = new SegmentPool({
    concurrency: 4,
    minConcurrency: 2,
    maxConcurrency: 8,
  });

  const executed = [];
  for (let i = 0; i < 12; i++) {
    const idx = i;
    pool.enqueue({
      id: idx,
      execute: async () => {
        executed.push(idx);
        return idx * 10;
      },
    });
  }

  const results = await pool.run();
  assert.equal(results.size, 12);
  assert.equal(results.get(5), 50);
  assert.equal(executed.length, 12);
});

test('Decryptor: generates standard RFC 8216 sequence IV', () => {
  const iv0 = Decryptor.sequenceToIv(0);
  assert.equal(iv0.length, 16);
  assert.equal(iv0[15], 0);

  const iv1 = Decryptor.sequenceToIv(1);
  assert.equal(iv1[15], 1);

  const iv256 = Decryptor.sequenceToIv(256);
  assert.equal(iv256[14], 1);
  assert.equal(iv256[15], 0);
});

test('VimeoExtractor: correctly extracts progressive MP4s and HLS playlists', () => {
  const sampleConfig = {
    video: {
      id: 12345,
      title: 'Sample Vimeo Video',
      duration: 120,
      thumbs: {
        '640': 'https://vimeo.com/thumb640.jpg',
        '1280': 'https://vimeo.com/thumb1280.jpg',
      },
    },
    request: {
      files: {
        progressive: [
          { quality: '1080p', url: 'https://vimeo.com/1080p.mp4', height: 1080 },
          { quality: '720p', url: 'https://vimeo.com/720p.mp4', height: 720 },
        ],
        hls: {
          cdns: {
            fastly: { url: 'https://vimeo.com/fastly.m3u8' },
          },
        },
      },
    },
  };

  const items = VimeoExtractor.parseConfig(sampleConfig);
  assert.equal(items.length, 3);
  assert.equal(items[0].format, 'MP4');
  assert.equal(items[0].resolution, '1080p');
  assert.equal(items[0].thumbnail, 'https://vimeo.com/thumb1280.jpg');
  assert.equal(items[2].format, 'HLS');
});

test('FacebookExtractor: extracts HD/SD streams and DASH manifests', () => {
  const sampleHtml = `
    <html>
      <script>
        var player_data = {
          "playable_url_quality_hd": "https:\\/\\/video.xx.fbcdn.net\\/v\\/hd.mp4",
          "playable_url": "https:\\/\\/video.xx.fbcdn.net\\/v\\/sd.mp4",
          "video_dash_manifest": "<MPD><Period></Period></MPD>"
        };
      </script>
    </html>
  `;

  const items = FacebookExtractor.parseHtml(sampleHtml, 'https://facebook.com/watch');
  assert.equal(items.length, 3);
  assert.equal(items[0].format, 'MP4');
  assert.equal(items[0].resolution, '1080p');
  assert.equal(items[1].resolution, '720p');
  assert.equal(items[2].format, 'DASH');
});
