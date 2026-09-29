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
    const base64 = SegmentWriter.uint8ArrayToBase64(uint8);
    await FileSystem.writeAsStringAsync(destinationUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
      append,
    });
  }

  /**
   * Fast Uint8Array to base64 fallback
   */
  public static uint8ArrayToBase64(bytes: Uint8Array): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let base64 = '';
    const len = bytes.length;
    const remainder = len % 3;
    const mainLength = len - remainder;

    for (let i = 0; i < mainLength; i += 3) {
      const chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];