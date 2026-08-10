import { SearchEngine } from './browserStore';

/**
 * Suggestions Service (Privacy-Honoring Search Autocomplete)
 * Fetches suggestions from the user's SELECTED search engine only,
 * and is OFF by default to prevent leaking keystrokes.
 */
export class SuggestionsService {
  private static cache: Map<string, string[]> = new Map();

  /**
   * Fetch similar / related search queries for a given user input using selected search engine
   */
  public static async fetchSuggestions(query: string, engine: SearchEngine = 'DuckDuckGo'): Promise<string[]> {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return [];

    // Don't suggest for full URLs or schemes
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return [];

    const cacheKey = `${engine}:${trimmed.toLowerCase()}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    let url = '';
    switch (engine) {
      case 'DuckDuckGo':
        url = `https://duckduckgo.com/ac/?q=${encodeURIComponent(trimmed)}&type=list`;
        break;
      case 'Brave':
        url = `https://search.brave.com/api/suggest?q=${encodeURIComponent(trimmed)}`;
        break;
      case 'Bing':
        url = `https://api.bing.com/osjson.aspx?query=${encodeURIComponent(trimmed)}`;
        break;
      case 'Ecosia':
        url = `https://ac.ecosia.org/autocomplete?q=${encodeURIComponent(trimmed)}&type=list`;