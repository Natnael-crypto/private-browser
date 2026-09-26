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