/**
 * GitHub Flavored Markdown Heading ID Extension for Marked
 *
 * Forked from: https://github.com/markedjs/marked-gfm-heading-id (v4.1.3)
 * Original license: MIT
 *
 * Changes from original:
 * - Converted to TypeScript
 * - Simplified API (removed globalSlugs option - we always reset per document)
 * - Improved entity handling (decode before slugging, not after)
 * - Added HeadingData export for TOC generation
 */

import GithubSlugger from 'github-slugger';
import type { MarkedExtension, Tokens } from 'marked';

export interface HeadingData {
  level: number;
  /** The heading text (may contain HTML entities from marked) */
  text: string;
  /** The raw heading text (HTML tags stripped, entities decoded) */
  raw: string;
  /** The generated slug ID */
  id: string;
}

let slugger = new GithubSlugger();
let headings: HeadingData[] = [];

/**
 * Decode HTML entities to their original characters.
 * Marked escapes special chars in heading text, we need to decode for slugging.
 */
function decodeHtmlEntities(html: string): string {
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
 * Strip HTML tags from text.
 * Used to get plain text from heading content.
 */
function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/**
 * Create a marked extension that adds GitHub-style heading IDs.
 *
 * @param options.prefix - Optional prefix for all heading IDs
 * @returns MarkedExtension to pass to marked.use()
 *
 * @example
 * ```typescript
 * const marked = new Marked(gfmHeadingId());
 * marked.parse('# Hello World');
 * // <h1 id="hello-world">Hello World</h1>
 * ```
 */
export function gfmHeadingId({ prefix = '' } = {}): MarkedExtension {
  return {
    hooks: {
      preprocess(src: string): string {
        // Always reset for each document (we process one doc at a time)
        resetHeadings();
        return src;
      },
    },
    renderer: {
      heading({ tokens, depth }: Tokens.Heading): string {
        // Get the rendered HTML text (may contain HTML entities and tags)
        // @ts-ignore - 'this' context is provided by marked at runtime
        const text: string = this.parser.parseInline(tokens);

        // Get raw text: decode entities, strip HTML tags
        const raw = stripHtmlTags(decodeHtmlEntities(text)).trim();

        const level = depth;
        const id = `${prefix}${slugger.slug(raw)}`;

        headings.push({ level, text, id, raw });

        return `<h${level} id="${id}">${text}</h${level}>\n`;
      },
    },
  };
}

/**
 * Get the list of headings collected during the last parse.
 * Call this after marked.parse() to get heading data for TOC generation.
 */
export function getHeadingList(): HeadingData[] {
  return headings;
}

/**
 * Reset the heading list and slugger.
 * Called automatically in preprocess hook, but can be called manually if needed.
 */
export function resetHeadings(): void {
  headings = [];
  slugger = new GithubSlugger();
}
