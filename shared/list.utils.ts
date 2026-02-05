import { EntryBase } from './base.types';

/**
 * Extract the first "big" paragraph from HTML content.
 * A paragraph is considered "big" if its TEXT content (not HTML) is > 100 chars.
 * Falls back to first paragraph if no big paragraph exists.
 */
export function extractFirstBigParagraph(html: string): string {
  if (!html) {
    return '';
  }

  const withoutImageTags = html.replace(/<img[^>]*>/g, '');
  const matches = withoutImageTags.match(/<p[^>]*>([\s\S]*?)<\/p>/mg);

  if (!matches) {
    return '';
  }

  const stripHtmlTags = (s: string) => s.replace(/<[^>]*>/g, '');
  const bigParagraph = matches.find(m => m && stripHtmlTags(m).length > 100);
  const paragraph = bigParagraph || matches[0] || '';
  return paragraph.replace(/<a\s.*?>(.*?)<\/a>/g, '$1');
}

/**
 * Create a light list from full entries.
 * Filters hidden entries and reduces HTML to first paragraph.
 */
export function makeLightList<T extends EntryBase>(fullList: T[]): T[] {
  return fullList
    .filter(entry => !entry.meta.hidden)
    .map(entry => ({
      ...entry,
      html: extractFirstBigParagraph(entry.html),
    }));
}
