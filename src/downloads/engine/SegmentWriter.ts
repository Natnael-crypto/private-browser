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

    try {
      // In Expo SDK 58, File with writableStream provides binary stream writing without Base64
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { File } = require('expo-file-system');
      if (File && typeof File === 'function') {
        const file = new File(destinationUri);
        if (typeof file.writableStream === 'function') {
          const stream = file.writableStream();
          const writer = stream.getWriter();
          await writer.write(uint8);
          await writer.close();
          return;
        }
      }
    } catch {
      // Fallback to legacy chunked write if new File API not supported in current environment
    }

    // Binary to base64 chunked conversion (fallback)