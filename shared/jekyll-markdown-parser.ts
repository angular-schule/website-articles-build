import { posix as path } from 'path';
import { load } from 'js-yaml';
import { Marked, Renderer, Tokens } from 'marked';
import { markedHighlight } from 'marked-highlight';
import { gfmHeadingId, getHeadingList, resetHeadings } from './gfm-heading-id';
import hljs from 'highlight.js';

/**
 * Placeholder for image base URL. Replaced at runtime by the Angular app.
 * See "URL TRANSFORMATION SYSTEM" below for details.
 */
export const MARKDOWN_BASE_URL_PLACEHOLDER = '%%MARKDOWN_BASE_URL%%';

/**
 * Marker for automatic table of contents generation.
 * Place [[toc]] in your markdown and it will be replaced with a generated TOC.
 */
export const TOC_MARKER = '[[toc]]';

/**
 * ============================================================================
 * MODIFIED PARSER - Based on bouzuya/jekyll-markdown-parser
 * ============================================================================
 *
 * Original source: https://github.com/bouzuya/jekyll-markdown-parser
 * Repository archived on Jun 28, 2020 (read-only, no longer maintained)
 *
 * ============================================================================
 * URL TRANSFORMATION SYSTEM
 * ============================================================================
 *
 * This parser handles two types of URL transformations:
 *
 * 1. IMAGES (baseUrl with MARKDOWN_BASE_URL_PLACEHOLDER)
 * -------------------------------------------------------
 * Images use a placeholder that gets replaced at runtime by the Angular app.
 * This allows serving images from different origins (CDN, local dev, etc.).
 *
 *   Markdown:  ![Alt](image.png)
 *   Build:     <img src="%%MARKDOWN_BASE_URL%%/blog/my-slug/image.png">
 *   Runtime:   <img src="https://cdn.example.com/blog/my-slug/image.png">
 *
 * The placeholder is replaced in the Angular app based on environment config.
 * This decouples the build from the deployment target.
 *
 * 2. LINKS (linkBasePath for relative → absolute transformation)
 * ---------------------------------------------------------------
 * Links are transformed from relative paths to absolute paths at build time.
 * This is necessary because Angular uses <base href="/"> which breaks
 * relative anchor links (e.g., #section would navigate to /#section).
 *
 *   Markdown:  [Section](#section)
 *   Build:     <a href="/blog/my-slug#section">
 *
 *   Markdown:  [Other Post](../other-slug)
 *   Build:     <a href="/blog/other-slug">
 *
 *   Markdown:  [Other Section](../other-slug#intro)
 *   Build:     <a href="/blog/other-slug#intro">
 *
 * The linkBasePath is derived from the folder structure:
 *   blog/my-slug/README.md → linkBasePath = "/blog/my-slug"
 *
 * WHY TWO DIFFERENT APPROACHES?
 * - Images: Need runtime flexibility (CDN on prod, proxy during development)
 * - Links: The Angular website mimics the folder structure of this repo.
 *          blog/ content is served at /blog/, material/ at /material/.
 *          That's why build-time resolution works: folder path = URL path.
 *
 * ============================================================================
 * SECURITY NOTE
 * ============================================================================
 *
 * This parser does NOT sanitize or escape HTML content. Raw HTML in markdown
 * is passed through intentionally. This is a FEATURE, not a bug.
 *
 * WE TRUST OUR OWN REPOSITORY 100%.
 *
 * All markdown content comes from our own Git repository. There is no
 * user-generated content. XSS is not a concern in this context.
 *
 * ============================================================================
 * CHANGES FROM ORIGINAL
 * ============================================================================
 *
 * 1. BUG FIX: Regex in separate() had typo `/^---s*$/` instead of `/^---\s*$/`.
 *    This bug exists in the original bouzuya source code (never fixed).
 *    The literal `s*` matches zero or more 's' characters, not whitespace.
 *    It worked accidentally because most files use `---\n` without trailing chars.
 *
 * 2. FEATURE: Added imageRenderer() to transform relative image paths to
 *    absolute URLs using baseUrl (for CDN/deployment support).
 *
 * 3. FEATURE: Added transformRelativeImagePaths() to handle raw HTML <img>
 *    tags that bypass the markdown renderer.
 *
 * 4. FEATURE: Added transformRelativeLinks() to convert relative links to
 *    absolute paths, fixing <base href="/"> issues in Angular.
 *
 * 5. CHANGE: Converted from CommonJS module to ES6 class with constructor
 *    for baseUrl and linkBasePath injection.
 *
 * 6. UPGRADE: marked v4 → v17 migration
 *    - Using Marked class instance instead of global marked
 *    - marked-highlight extension for syntax highlighting
 *    - marked-gfm-heading-id extension for heading IDs
 *    - Token-based renderer API (token object instead of separate params)
 * ============================================================================
 */
export class JekyllMarkdownParser {

  private marked: Marked;

  /**
   * @param baseUrl - Base URL for images (e.g., '%%MARKDOWN_BASE_URL%%/blog/my-slug/')
   * @param linkBasePath - Absolute path for links (e.g., '/blog/my-slug')
   */
  constructor(
    private baseUrl: string,
    private linkBasePath: string
  ) {
    this.marked = this.createMarkedInstance();
  }

  private createMarkedInstance(): Marked {
    const renderer = new Renderer();
    renderer.image = this.imageRenderer.bind(this);

    return new Marked(
      markedHighlight({
        highlight: (code) => hljs.highlightAuto(code).value
      }),
      gfmHeadingId(),
      { renderer }
    );
  }

  /**
   * Check if a URL is absolute (should not be transformed).
   * Matches: protocols (mailto:, tel:, https:, etc.), protocol-relative (//),
   * absolute paths (/), asset paths, and placeholder URLs.
   */
  private isAbsoluteUrl(url: string): boolean {
    // Protocol pattern: word characters followed by colon (mailto:, tel:, https:, http:, ftp:, data:, etc.)
    if (/^\w+:/.test(url)) {
      return true;
    }
    return url.startsWith('//') ||
           url.startsWith('/') ||
           url.startsWith('assets/') ||
           url.startsWith(MARKDOWN_BASE_URL_PLACEHOLDER);
  }

  /**
   * Normalize a relative URL by stripping ./ prefix.
   */
  private normalizeRelativeUrl(url: string): string {
    return url.startsWith('./') ? url.slice(2) : url;
  }

  /**
   * Escape special HTML characters in attribute values.
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Decode common HTML entities back to their original characters.
   * Used for TOC generation where we need plain text from marked's escaped output.
   */
  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  /**
   * Generate a table of contents as Markdown from the document's headings.
   * Uses getHeadingList() from marked-gfm-heading-id to get heading IDs.
   *
   * @param markdown - The markdown content to extract headings from
   * @returns Markdown list with links to headings, or empty string if no headings
   */
  private generateToc(markdown: string): string {
    // Parse markdown to collect headings (result is discarded, we only need side effect)
    resetHeadings();
    this.marked.parse(markdown);
    const headings = getHeadingList();

    // Filter to h2 and h3, skip headings that appear before [[toc]] marker
    const tocIndex = markdown.indexOf(TOC_MARKER);
    const headingsAfterMarker = headings.filter(h => {
      // Only include h2 and h3
      if (h.level < 2 || h.level > 3) return false;
      // Skip the heading that contains the TOC (usually "Inhalt" or "Contents")
      const headingPattern = new RegExp(`^#{${h.level}}\\s+${this.escapeRegex(this.decodeHtmlEntities(h.text))}`, 'm');
      const match = markdown.match(headingPattern);
      if (match && match.index !== undefined && match.index < tocIndex) {
        return false;
      }
      return true;
    });

    if (headingsAfterMarker.length === 0) {
      return '';
    }

    // Generate markdown list
    return headingsAfterMarker
      .map(h => {
        const indent = h.level === 3 ? '  ' : '';
        const text = this.decodeHtmlEntities(h.text);
        return `${indent}* [${text}](#${h.id})`;
      })
      .join('\n');
  }

  /**
   * Escape special regex characters in a string.
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Custom image renderer that transforms relative URLs to absolute URLs.
   * marked v17 uses token-based API: renderer receives a token object.
   *
   * NOTE: In marked v17, the token contains RAW unescaped text.
   * We MUST escape special characters to prevent broken HTML.
   */
  private imageRenderer(token: Tokens.Image): string {
    let src = token.href;

    if (!this.isAbsoluteUrl(token.href)) {
      src = this.baseUrl + this.normalizeRelativeUrl(token.href);
    }

    const escapedAlt = this.escapeHtml(token.text);
    let out = `<img src="${src}" alt="${escapedAlt}"`;
    if (token.title) {
      out += ` title="${this.escapeHtml(token.title)}"`;
    }
    out += '>';
    return out;
  }

  // Transform relative paths in raw HTML <img> tags to absolute URLs
  // Supports both double quotes (src="...") and single quotes (src='...')
  private transformRelativeImagePaths(html: string): string {
    return html.replace(/<img([^>]*)\ssrc=(["'])([^"']+)\2/g, (match, attrs, quote, src) => {
      if (this.isAbsoluteUrl(src)) {
        return match;
      }
      return `<img${attrs} src=${quote}${this.baseUrl}${this.normalizeRelativeUrl(src)}${quote}`;
    });
  }

  /**
   * Transform relative links to absolute paths.
   * Fixes <base href="/"> issue where #anchor resolves to /#anchor.
   *
   * Uses path.posix.resolve() for proper relative path resolution:
   * - #section → /blog/my-slug#section
   * - ../other-slug → /blog/other-slug
   * - ../other-slug#section → /blog/other-slug#section
   */
  private transformRelativeLinks(html: string): string {
    return html.replace(/<a([^>]*)\shref=(["'])([^"']+)\2/g, (match, attrs, quote, href) => {
      if (this.isAbsoluteUrl(href)) {
        return match;
      }

      const hasHash = href.includes('#');
      const [pathPart, hash] = hasHash ? href.split('#') : [href, ''];

      const resolved = pathPart
        ? path.resolve(this.linkBasePath + '/', pathPart)
        : this.linkBasePath;

      const newHref = hasHash ? resolved + '#' + hash : resolved;
      return `<a${attrs} href=${quote}${newHref}${quote}`;
    });
  }

  private separate(jekyllMarkdown: string): {
    markdown: string;
    yaml: string;
  } {
    // BUG FIX: Original had '\s' which becomes literal 's' in string context.
    // Using '[ \\t]*' (space/tab only) instead of '\\s*' to avoid matching newlines,
    // which would change behavior when there's a blank line after the separator.
    const re = new RegExp('^---[ \\t]*$\\r?\\n', 'm');
    const m1 = jekyllMarkdown.match(re); // first separator

    if (m1 === null) {
      return { markdown: jekyllMarkdown, yaml: '' };
    }

    const s1 = jekyllMarkdown.substring((m1.index ?? 0) + m1[0].length);
    const m2 = s1.match(re); // second separator

    if (m2 === null) {
      return { markdown: jekyllMarkdown, yaml: '' };
    }

    const yaml = s1.substring(0, m2.index);
    const markdown = s1.substring((m2.index ?? 0) + m2[0].length);
    return { markdown, yaml };
  }

  private compileMarkdown(markdown: string): string {
    // Generate TOC if marker is present
    let processedMarkdown = markdown;
    if (markdown.includes(TOC_MARKER)) {
      const toc = this.generateToc(markdown);
      processedMarkdown = markdown.replace(TOC_MARKER, toc);
    }

    // Reset headings and parse (generateToc already parsed once, but we need fresh state)
    resetHeadings();
    const html = this.marked.parse(processedMarkdown) as string;
    const withImages = this.transformRelativeImagePaths(html);
    return this.transformRelativeLinks(withImages);
  }

  private parseYaml(yaml: string): Record<string, unknown> {
    const parsed = load(yaml) as Record<string, unknown> | undefined;
    if (!parsed) {
      throw new Error('YAML frontmatter is required but was empty or invalid');
    }
    return parsed;
  }

  public parse(jekyllMarkdown: string): {
    html: string;
    yaml: string;
    parsedYaml: Record<string, unknown>;
    markdown: string;
  } {
    const { yaml, markdown } = this.separate(jekyllMarkdown);
    const parsedYaml = this.parseYaml(yaml);
    const html = this.compileMarkdown(markdown);

    return {
      html,
      markdown,
      parsedYaml,
      yaml
    };
  }
}
