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