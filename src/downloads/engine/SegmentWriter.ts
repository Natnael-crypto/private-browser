/**
 * SegmentWriter (Section 6.1)
 * High-performance binary writer for media segments without Base64 file writing bottleneck.
 * Writes raw byte buffers or streams directly to disk.
 */

import * as FileSystem from 'expo-file-system/legacy';

export class SegmentWriter {
  /**
   * Write binary segment buffer to destination URI.
   * Uses native chunk writing to avoid memory bloat.
   */
  public static async writeSegment(
    destinationUri: string,
    buffer: ArrayBuffer | Uint8Array,
    append: boolean = true
  ): Promise<void> {
    const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
