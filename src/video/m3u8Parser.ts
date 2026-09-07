/**
 * M3U8 HLS Parser (VID-5, VID-7, VID-8)
 * Parses master playlists, variant streams, resolutions, bandwidth, and DRM key tags.
 */

export interface M3U8Variant {
  uri: string;
  bandwidth?: number;
  resolution?: string; // e.g. "1920x1080"
  height?: number;
  qualityLabel?: string; // e.g. "1080p", "720p"
  codecs?: string;
  audioGroup?: string;
  hasDrm?: boolean;
}

export interface M3U8ParsedResult {
  isMaster: boolean;
  variants: M3U8Variant[];
  hasDrm: boolean;
  targetDuration?: number;
}

export class M3U8Parser {
  /**
   * Parse an M3U8 playlist content
   */
  public static parse(content: string, baseUrl: string): M3U8ParsedResult {
    const lines = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    const variants: M3U8Variant[] = [];
    let isMaster = false;
    let hasDrm = false;
    let currentStreamInf: Record<string, string> | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for DRM encryption keys
      if (line.startsWith('#EXT-X-KEY:')) {
        if (line.includes('SAMPLE-AES') || line.includes('com.widevine') || line.includes('com.apple')) {
          hasDrm = true;
        }
      }

      if (line.startsWith('#EXT-X-STREAM-INF:')) {
        isMaster = true;
        currentStreamInf = this.parseAttributes(line.slice('#EXT-X-STREAM-INF:'.length));
      } else if (line.startsWith('#') && !line.startsWith('#EXT-X-STREAM-INF:')) {
        // Other tags
        continue;
      } else if (currentStreamInf) {
        // This line is the URI for the stream variant
        const uri = this.resolveUrl(line, baseUrl);
        const bandwidth = currentStreamInf.BANDWIDTH ? parseInt(currentStreamInf.BANDWIDTH, 10) : undefined;
        const resolution = currentStreamInf.RESOLUTION;
        let qualityLabel = 'Default';
        let height: number | undefined;

        if (resolution) {
          const parts = resolution.split('x');
          if (parts.length === 2) {