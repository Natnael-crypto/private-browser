/**
 * Vimeo Site Extractor (Section 5.4)
 * Ported from Video DownloadHelper injected/vimeo.js and Vimeo JSON config rule (5.1 step 3).
 * Extracts progressive MP4 streams and HLS playlists from Vimeo player configurations.
 */

export interface VimeoConfigVideo {
  id?: number | string;
  title?: string;
  duration?: number;
  thumbs?: Record<string, string>;
  owner?: { name?: string };
}

export interface VimeoConfigFiles {
  hls?: {
    cdns?: Record<string, { url?: string; origin?: string }>;
    default_cdn?: string;
  };
  dash?: {
    cdns?: Record<string, { url?: string }>;
  };
  progressive?: {
    profile?: string | number;
    width?: number;
    height?: number;
    mime?: string;
    fps?: number;
    url?: string;
    quality?: string;
  }[];
}

export interface ExtractedMediaItem {
  mediaUrl: string;
  title: string;
  format: string; // 'MP4' | 'HLS' | 'DASH'
  resolution: string;
  thumbnail?: string | null;
  duration?: number;
}

export class VimeoExtractor {
  public static matches(url: string): boolean {
    return /vimeo\.com/i.test(url);
  }

  /**
   * Parse Vimeo config object (from playerConfig or /config JSON endpoint)
   */
  public static parseConfig(config: {
    video?: VimeoConfigVideo;
    request?: { files?: VimeoConfigFiles };
  }): ExtractedMediaItem[] {
    const items: ExtractedMediaItem[] = [];
    if (!config || !config.request || !config.request.files) return items;

    const files = config.request.files;
    const title = config.video?.title || 'Vimeo Video';
    const duration = config.video?.duration || 0;

    let thumbnail: string | null = null;
    if (config.video?.thumbs) {
      const thumbs = config.video.thumbs;
      thumbnail = thumbs['1280'] || thumbs['960'] || thumbs['640'] || thumbs['base'] || null;
    }

    // 1. Progressive MP4 streams
    if (Array.isArray(files.progressive)) {
      for (const prog of files.progressive) {
        if (prog && prog.url) {
          const res = prog.quality ? `${prog.quality}` : (prog.height ? `${prog.height}p` : 'Auto');
          items.push({
            mediaUrl: prog.url,
            title,
            format: 'MP4',
            resolution: res,
            thumbnail,
            duration,
          });
        }
      }
    }

    // 2. HLS streams
    if (files.hls?.cdns) {
      for (const [cdnName, cdn] of Object.entries(files.hls.cdns)) {
        if (cdn && cdn.url) {
          items.push({
            mediaUrl: cdn.url,
            title: `${title} (HLS ${cdnName})`,
            format: 'HLS',
            resolution: 'Auto',
            thumbnail,
            duration,
          });
        }
      }
    }

    return items;
  }

  /**
   * Extract video ID from Vimeo URL: vimeo.com/12345678 or player.vimeo.com/video/12345678
   */
  public static extractVideoId(url: string): string | null {
    const match = url.match(/(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d{5,})/i);
    return match ? match[1] : null;
  }
}
