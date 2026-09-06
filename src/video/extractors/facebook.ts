/**
 * Facebook & Instagram Site Extractor (Section 5.4)
 * Ported from Video DownloadHelper injected/facebook.js.
 * Scans page HTML / JSON responses for dash_manifests, video_dash_manifest,
 * and direct playable_url / playable_url_quality_hd video streams.
 */

export interface ExtractedMediaItem {
  mediaUrl: string;
  title: string;
  format: string;
  resolution: string;
  thumbnail?: string | null;
  duration?: number;
}

export class FacebookExtractor {
  public static matches(url: string): boolean {
    return /(?:facebook\.com|instagram\.com|fb\.watch)/i.test(url);
  }

  /**
   * Parse HTML or inline JSON script content for embedded video streams
   */
  public static parseHtml(html: string, pageUrl: string): ExtractedMediaItem[] {
    const items: ExtractedMediaItem[] = [];
    if (!html) return items;

    // 1. Check for HD and SD progressive playable URLs
    const hdMatch = html.match(/"(?:playable_url_quality_hd|browser_native_hd_url)":\s*"([^"]+)"/);
    if (hdMatch && hdMatch[1]) {
      const cleanUrl = hdMatch[1].replace(/\\\//g, '/');
      items.push({
        mediaUrl: cleanUrl,
        title: 'Facebook Video (HD)',
        format: 'MP4',
        resolution: '1080p',