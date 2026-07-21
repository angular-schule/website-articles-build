import * as path from 'path';
import * as emoji from 'node-emoji'
import { imageSizeFromFile } from 'image-size/fromFile';
import { readdir, readFile } from 'fs/promises';
import { copy, remove, writeJson, mkdirp } from 'fs-extra';

import { JekyllMarkdownParser } from './jekyll-markdown-parser';
import { EntryBase, ImageDimensions } from './base.types';
import { registerAnchors, registerHtmlAnchors, registerLinks } from './link-validator';
import { optimizeImagesInFolder, rewriteImageReferences } from './image-optimizer';

const README_FILE = 'README.md';
const ENTRY_FILE = 'entry.json';

/** Read all subdirectory names from a base path (excluding those starting with _) */
export async function readFolders(basePath: string): Promise<string[]> {
  const folderContents = await readdir(basePath, { withFileTypes: true });
  return folderContents
    .filter(dirent => dirent.isDirectory())
    .filter(dirent => !dirent.name.startsWith('_'))
    .map(dirent => dirent.name);
}

/** Read a markdown file from disk */
export async function readMarkdownFile(filePath: string): Promise<string> {
  return readFile(filePath, 'utf8');
}

/** Get width and height of an image. Throws if dimensions cannot be determined. */
export async function getImageDimensions(imagePath: string): Promise<ImageDimensions> {
  const { width, height } = await imageSizeFromFile(imagePath);
  if (width === undefined || height === undefined) {
    throw new Error(`Could not determine dimensions for image: ${imagePath}`);
  }
  return { width, height };
}

/**
 * Copy folder entries to dist, optimize their images to WebP, remove the README,
 * and write entry.json.
 *
 * Image optimization mutates `entry.meta.header` (url + dimensions) and `entry.html`
 * in place, so a `list.json` generated AFTER this call reflects the WebP references.
 */
export async function copyEntriesToDist<T extends { slug: string }>(
  entries: T[],
  sourceFolder: string,
  distFolder: string,
): Promise<void> {
  // Process sequentially to fail fast on first error
  for (const entry of entries) {
    const entryDistFolder = path.join(distFolder, entry.slug);

    await mkdirp(entryDistFolder);
    await copy(path.join(sourceFolder, entry.slug), entryDistFolder);
    await remove(path.join(entryDistFolder, README_FILE));

    // jpg/png → resized WebP (in dist); rewrite header + html references to it.
    const optimized = await optimizeImagesInFolder(entryDistFolder);
    rewriteImageReferences(entry as { html?: unknown; meta?: unknown }, optimized);

    const entryJsonPath = path.join(entryDistFolder, ENTRY_FILE);
    await writeJson(entryJsonPath, entry);
    console.log('Generated post file:', entryJsonPath);
  }
}

/**
 * Compare two entries for sorting.
 *
 * Order of criteria:
 * 1. sortKey: entries with a sortKey come first, sorted ascending.
 * 2. Sticky: sticky entries come before non-sticky.
 * 3. Published date (newest first).
 * 4. Slug (descending) as tiebreaker.
 *
 * @returns negative if a comes first, positive if b comes first
 */
function compareEntries(a: EntryBase, b: EntryBase): number {
  // 1. sortKey: entries with a sortKey come first, sorted ascending
  const aHasKey = typeof a.meta.sortKey === 'number';
  const bHasKey = typeof b.meta.sortKey === 'number';
  if (aHasKey && bHasKey) {
    return a.meta.sortKey! - b.meta.sortKey!;
  }
  if (aHasKey !== bHasKey) {
    return aHasKey ? -1 : 1;
  }
  // 2. Sticky entries first (treat undefined and false the same)
  const aSticky = !!a.meta.sticky;
  const bSticky = !!b.meta.sticky;
  if (aSticky !== bSticky) {
    return aSticky ? -1 : 1;
  }
  // 3. Then by date (newest first) - ISO 8601 strings sort lexicographically
  const dateCompare = b.meta.published.localeCompare(a.meta.published);
  if (dateCompare !== 0) return dateCompare;
  // 4. Slug as tiebreaker (descending)
  return b.slug.localeCompare(a.slug);
}


/**
 * Convert markdown README to full blog post object.
 *
 * IMPORTANT: This function transforms raw YAML data into the target type T.
 * The generic T is a type ASSERTION - the function trusts that the YAML
 * contains all required properties. If YAML is incomplete, runtime errors
 * may occur elsewhere. This is acceptable because we control all blog posts.
 *
 * Transformation details:
 * - `header` (string in YAML) → `header` (object with url/width/height)
 * - Emojis in HTML are converted via node-emoji
 */
export async function markdownToEntry<T extends EntryBase>(
  markdown: string,
  folder: string,
  baseUrl: string,
  blogPostsFolder: string,
  linkBasePath: string
): Promise<T> {
  const imageBaseUrl = baseUrl + folder + '/';
  const parser = new JekyllMarkdownParser(imageBaseUrl, linkBasePath);
  const { html, parsedYaml, headingIds } = parser.parse(markdown);

  // Register anchors and links for validation
  registerAnchors(linkBasePath, headingIds);
  registerHtmlAnchors(linkBasePath, html);
  registerLinks(linkBasePath, html);

  const meta: Record<string, unknown> = parsedYaml;

  // Convert Date objects from js-yaml to ISO strings
  // js-yaml parses unquoted dates (e.g., `published: 2024-01-15`) as Date objects
  if (meta.published instanceof Date) {
    meta.published = meta.published.toISOString();
  }
  if (meta.lastModified instanceof Date) {
    meta.lastModified = meta.lastModified.toISOString();
  }

  // Transform header from string (YAML) to object with dimensions
  if (typeof meta.header === 'string') {
    const url = meta.header;
    let width: number;
    let height: number;

    if (typeof meta.headerWidth === 'number' && typeof meta.headerHeight === 'number') {
      // Use manually provided dimensions (e.g. for video formats unsupported by image-size)
      width = meta.headerWidth;
      height = meta.headerHeight;
      delete meta.headerWidth;
      delete meta.headerHeight;
    } else {
      const imagePath = path.join(blogPostsFolder, folder, meta.header);
      ({ width, height } = await getImageDimensions(imagePath));
    }

    meta.header = { url, width, height };
  }

  // Type assertion: we trust that YAML contains all required properties for T
  return {
    slug: folder,
    html: emoji.emojify(html),
    meta
  } as unknown as T;
}

/** Read metadata and contents for all entries as list */
export async function getEntryList<T extends EntryBase>(entriesFolder: string, markdownBaseUrl: string): Promise<T[]> {
  const entryDirs = await readFolders(entriesFolder);
  const entries: T[] = [];

  // Content type from folder structure: ../blog → blog, ../material → material
  const contentType = path.basename(entriesFolder);

  for (const entryDir of entryDirs) {
    const readmePath = path.join(entriesFolder, entryDir, README_FILE);
    const readme = await readMarkdownFile(readmePath);
    const linkBasePath = '/' + contentType + '/' + entryDir;
    const entry = await markdownToEntry<T>(readme, entryDir, markdownBaseUrl, entriesFolder, linkBasePath);
    entries.push(entry);
  }

  return entries.sort(compareEntries);
}
