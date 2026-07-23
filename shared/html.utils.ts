/**
 * Shared HTML utility functions.
 */

/**
 * Strip all HTML tags from a string, leaving only text content.
 */
export function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/**
 * Decode common HTML entities to their original characters.
 */
export function decodeHtmlEntities(html: string): string {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

/**
 * Escape special HTML characters for use in attribute values.
 * Escapes: & " ' < >
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Ensure every <img> has an alt attribute.
 *
 * Images reach the HTML two ways: from Markdown (the renderer always emits an alt, even an
 * empty one) and as manual raw <img> tags (which frequently lack alt). A missing alt makes
 * screen readers announce the file name, so any <img> without an alt gets a decorative
 * empty alt="". Images that already carry an alt (including alt="") are left untouched.
 *
 * Apply this LATE, on the final HTML, so both image sources are covered uniformly.
 */
export function ensureImageAlt(html: string): string {
  return html.replace(/<img\b[^>]*>/gi, (tag) =>
    /\balt\s*=/i.test(tag) ? tag : tag.replace(/\s*(\/?)>$/, ' alt=""$1>'),
  );
}
