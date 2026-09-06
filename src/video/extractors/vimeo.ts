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