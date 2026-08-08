import { SearchEngine } from './browserStore';

/**
 * Suggestions Service (Privacy-Honoring Search Autocomplete)
 * Fetches suggestions from the user's SELECTED search engine only,
 * and is OFF by default to prevent leaking keystrokes.
 */
export class SuggestionsService {
  private static cache: Map<string, string[]> = new Map();
