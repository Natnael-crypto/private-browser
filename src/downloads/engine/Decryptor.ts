/**
 * Decryptor (Section 6.1)
 * Hardware-accelerated AES-128 CBC decryption for HLS media segments.
 * Utilizes standard WebCrypto API (available in modern React Native/Expo and Node).
 */

export class Decryptor {
  /**
   * Decrypt AES-128 CBC encrypted segment
   * @param ciphertext Encrypted segment buffer
   * @param key Raw 16-byte AES key
   * @param iv Raw 16-byte initialization vector
   */
  public static async decryptAes128(
    ciphertext: Uint8Array | ArrayBuffer,
    key: Uint8Array | ArrayBuffer,
    iv: Uint8Array | ArrayBuffer
  ): Promise<Uint8Array> {
    let cryptoObj: any = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : undefined;
    if (!cryptoObj && typeof require !== 'undefined') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        cryptoObj = require('crypto').webcrypto;
      } catch {}
    }

    if (!cryptoObj?.subtle) {
      throw new Error('WebCrypto subtle is unavailable on this platform');
    }

    const cryptoKey = await cryptoObj.subtle.importKey(
      'raw',
      key,
      { name: 'AES-CBC' },
      false,
      ['decrypt']
    );

    const decrypted = await cryptoObj.subtle.decrypt(
      {
        name: 'AES-CBC',
        iv: iv instanceof Uint8Array ? iv : new Uint8Array(iv),
      },
      cryptoKey,
      ciphertext
    );

    return new Uint8Array(decrypted);
  }

  public static decryptSegment(
    ciphertext: Uint8Array | ArrayBuffer,
    key: Uint8Array | ArrayBuffer,
    iv: Uint8Array | ArrayBuffer
  ): Promise<Uint8Array> {
    return this.decryptAes128(ciphertext, key, iv);
  }

  /**
   * Helper to derive 16-byte IV from sequence number if IV is not explicitly specified in M3U8
   * Section 5.2 of RFC 8216: The sequence number is converted to a 16-byte big-endian integer.
   */
  public static sequenceToIv(seq: number): Uint8Array {
    const iv = new Uint8Array(16);
    const view = new DataView(iv.buffer);
    // Sequence numbers fit in 32 bits, placed in the last 4 bytes of 16-byte IV
    view.setUint32(12, seq, false); // big-endian
    return iv;
  }

  public static sequenceToIV(seq: number): Uint8Array {
    return this.sequenceToIv(seq);
  }
}
