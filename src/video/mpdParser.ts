/**
 * DASH MPD Manifest Parser (VID-5, VID-7, VID-8)
 * Extracts video representations, resolutions, and DRM ContentProtection tags.
 */

export interface MPDRepresentation {
  id?: string;
  bandwidth?: number;
  width?: number;
  height?: number;
  qualityLabel?: string;
  mimeType?: string;
  codecs?: string;
  mediaUri?: string;
}

export interface MPDParsedResult {
  variants: MPDRepresentation[];
  hasDrm: boolean;
}

export class MPDParser {
  public static parse(content: string, baseUrl: string): MPDParsedResult {
    const hasDrm = content.includes('ContentProtection') || content.includes('widevine') || content.includes('playready');
    const variants: MPDRepresentation[] = [];

    // Parse Representation tags using regex
    const repRegex = /<Representation\b([^>]*)>(?:([\s\S]*?)<\/Representation>)?/gi;
    let match;

    while ((match = repRegex.exec(content)) !== null) {
      const attrsStr = match[1];
      const innerContent = match[2] || '';

      const idMatch = attrsStr.match(/id=["']([^"']+)["']/i);
      const widthMatch = attrsStr.match(/width=["'](\d+)["']/i);
      const heightMatch = attrsStr.match(/height=["'](\d+)["']/i);
      const bandwidthMatch = attrsStr.match(/bandwidth=["'](\d+)["']/i);
      const mimeTypeMatch = attrsStr.match(/mimeType=["']([^"']+)["']/i);
      const codecsMatch = attrsStr.match(/codecs=["']([^"']+)["']/i);

      // BaseURL inside representation if any
      const baseUriMatch = innerContent.match(/<BaseURL>([^<]+)<\/BaseURL>/i);
      let mediaUri = baseUriMatch ? baseUriMatch[1].trim() : baseUrl;
      if (mediaUri && !mediaUri.startsWith('http')) {
        try {
          mediaUri = new URL(mediaUri, baseUrl).href;
        } catch {}
      }

      const height = heightMatch ? parseInt(heightMatch[1], 10) : undefined;
      const bandwidth = bandwidthMatch ? parseInt(bandwidthMatch[1], 10) : undefined;
      let qualityLabel = 'Auto';
      if (height) {
        qualityLabel = `${height}p`;
      } else if (bandwidth) {
        if (bandwidth > 4000000) qualityLabel = '1080p';
        else if (bandwidth > 2000000) qualityLabel = '720p';
        else if (bandwidth > 1000000) qualityLabel = '480p';
        else qualityLabel = '360p';
      }

      variants.push({
        id: idMatch ? idMatch[1] : undefined,
        width: widthMatch ? parseInt(widthMatch[1], 10) : undefined,
        height,
        bandwidth,
        qualityLabel,
        mimeType: mimeTypeMatch ? mimeTypeMatch[1] : undefined,
        codecs: codecsMatch ? codecsMatch[1] : undefined,
        mediaUri,
      });
    }

    return {
      variants,
      hasDrm,
    };
  }
}
