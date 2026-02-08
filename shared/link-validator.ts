/**
 * Anchor Link Validator
 *
 * Validates that all internal anchor links point to existing headings.
 * Runs after all entries are parsed to catch broken links at build time.
 *
 * Features:
 * - Detects broken anchor links (missing target or missing anchor)
 * - Suggests similar anchors using Levenshtein distance (typo detection)
 * - Non-blocking: only warns, does not fail the build
 *
 * Usage:
 *   1. registerAnchors(path, headingIds) - call after parsing each entry
 *   2. registerLinks(path, html) - extracts and registers all anchor links
 *   3. validateLinks() - call at end of build to check for broken links
 */

import { findSimilar } from './string.utils';

/** Registry of all anchors per entry path */
const anchorRegistry = new Map<string, Set<string>>();

/** Registry of all anchor links found: { fromPath, toPath, anchor } */
interface AnchorLink {
  fromPath: string;
  toPath: string;
  anchor: string;
  fullLink: string;
}
const linkRegistry: AnchorLink[] = [];

// Regex to find href attributes with anchors: href="/blog/slug#anchor" or href="#anchor"
const ANCHOR_LINK_REGEX = /<a[^>]*\shref=(["'])([^"']*#[^"']+)\1/g;

/**
 * Extract all anchor links from HTML using matchAll().
 * Safer than exec() loop with global regex - no shared state issues.
 */
function extractAnchorLinks(html: string): Array<{ fullLink: string }> {
  return [...html.matchAll(ANCHOR_LINK_REGEX)].map(match => ({
    fullLink: match[2]
  }));
}

/**
 * Register heading anchors for an entry.
 * @param entryPath - Absolute path like "/blog/my-post"
 * @param headingIds - Array of heading IDs like ["intro", "fazit"]
 */
export function registerAnchors(entryPath: string, headingIds: string[]): void {
  const existing = anchorRegistry.get(entryPath) ?? new Set();
  for (const id of headingIds) {
    existing.add(id);
  }
  anchorRegistry.set(entryPath, existing);
}

/**
 * Check if a URL is external (should not be validated).
 */
function isExternalUrl(url: string): boolean {
  return /^https?:\/\//.test(url) ||
         url.startsWith('//') ||
         url.startsWith('mailto:') ||
         url.startsWith('tel:');
}

/**
 * Extract anchor links from HTML and register them.
 * Only registers internal links - external URLs are skipped.
 * @param fromPath - Entry path where links were found
 * @param html - HTML content to scan for links
 */
export function registerLinks(fromPath: string, html: string): void {
  for (const { fullLink } of extractAnchorLinks(html)) {
    // Skip external URLs
    if (isExternalUrl(fullLink)) continue;

    // Parse the link: "/blog/other#section" or "#section"
    const hashIndex = fullLink.indexOf('#');
    if (hashIndex === -1) continue;

    const pathPart = fullLink.substring(0, hashIndex);
    // URL-decode anchor (marked encodes special chars like ä → %C3%A4)
    const anchor = decodeURIComponent(fullLink.substring(hashIndex + 1));

    // Determine target path
    const toPath = pathPart || fromPath; // Empty path = same document

    linkRegistry.push({
      fromPath,
      toPath,
      anchor,
      fullLink
    });
  }
}

/**
 * Validate all registered links against registered anchors.
 * @returns Object with broken links and stats
 */
export function validateLinks(): {
  valid: boolean;
  totalLinks: number;
  brokenLinks: AnchorLink[];
} {
  const brokenLinks: AnchorLink[] = [];

  for (const link of linkRegistry) {
    const targetAnchors = anchorRegistry.get(link.toPath);

    if (!targetAnchors) {
      // Target entry doesn't exist
      brokenLinks.push(link);
    } else if (!targetAnchors.has(link.anchor)) {
      // Anchor doesn't exist in target entry
      brokenLinks.push(link);
    }
  }

  return {
    valid: brokenLinks.length === 0,
    totalLinks: linkRegistry.length,
    brokenLinks
  };
}

/**
 * Print validation results to console.
 * @returns true if all links are valid, false if there are broken links
 */
export function printValidationResults(): boolean {
  const { valid, totalLinks, brokenLinks } = validateLinks();

  if (valid) {
    console.log(`✓ All ${totalLinks} anchor links are valid`);
    return true;
  }

  console.warn(`\n⚠️  Found ${brokenLinks.length} broken anchor link(s):\n`);
  for (const link of brokenLinks) {
    console.warn(`  ${link.fromPath}`);
    console.warn(`    → ${link.fullLink}`);

    // Provide helpful context
    const targetAnchors = anchorRegistry.get(link.toPath);
    if (!targetAnchors) {
      console.warn(`    ✗ Target path "${link.toPath}" does not exist`);
    } else {
      console.warn(`    ✗ Anchor "#${link.anchor}" not found`);
      // Suggest similar anchors using fuzzy matching (Levenshtein distance ≤ 3)
      const similar = findSimilar(link.anchor, [...targetAnchors], 3);
      if (similar.length > 0) {
        console.warn(`    ? Did you mean: ${similar.slice(0, 3).map(a => '#' + a).join(', ')}`);
      }
    }
    console.warn('');
  }

  return false;
}

/**
 * Reset the validator (for testing).
 */
export function resetValidator(): void {
  anchorRegistry.clear();
  linkRegistry.length = 0;
}

/**
 * Get registered anchors for a path (for testing).
 */
export function getAnchors(entryPath: string): Set<string> | undefined {
  return anchorRegistry.get(entryPath);
}

/**
 * Get all registered links (for testing).
 */
export function getLinks(): AnchorLink[] {
  return [...linkRegistry];
}
