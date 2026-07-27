import test from 'node:test';
import assert from 'node:assert';
import { SpeedMeter } from '../src/downloads/engine/SpeedMeter.ts';

test('SpeedMeter: records bytes and produces immediate non-zero speed', () => {
  const meter = new SpeedMeter(100 * 1024 * 1024); // 100 MB
  const t0 = 100000;
  meter.recordBytes(0, t0);
  // After 500ms, 2 MB transferred -> 4 MB/s instant speed
  meter.recordBytes(2 * 1024 * 1024, t0 + 500);

  const prog = meter.getProgress();
  assert.ok(prog.speedBytesPerSec > 0, 'Speed must be non-zero after first sample');
  assert.ok(prog.formattedSpeed.includes('MB/s') || prog.formattedSpeed.includes('KB/s'));
  assert.ok(prog.etaSeconds !== null && prog.etaSeconds > 0, 'ETA must be calculated when totalBytes is known');
});

test('SpeedMeter: accurately formats speed and Mbps', () => {
  assert.strictEqual(SpeedMeter.formatSpeed(500), '500 B/s');
  assert.strictEqual(SpeedMeter.formatSpeed(50 * 1024), '50.0 KB/s');
  assert.strictEqual(SpeedMeter.formatSpeed(5 * 1024 * 1024), '5.00 MB/s');
});

test('SpeedMeter: formats ETA cleanly', () => {
  assert.strictEqual(SpeedMeter.formatEta(null), '--:--');
  assert.strictEqual(SpeedMeter.formatEta(45), '0:45');
  assert.strictEqual(SpeedMeter.formatEta(90), '1:30');
  assert.strictEqual(SpeedMeter.formatEta(3665), '1h 1m');
});

test('SpeedMeter: throttles emits to ~4 times per second', () => {
  const meter = new SpeedMeter();
  const t0 = 100000;
  assert.strictEqual(meter.shouldEmit(t0), true);
  assert.strictEqual(meter.shouldEmit(t0 + 100), false, 'Should throttle within 250ms');
  assert.strictEqual(meter.shouldEmit(t0 + 260), true, 'Should emit after 250ms');
});
