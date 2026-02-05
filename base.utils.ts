import * as path from 'path';
import * as emoji from 'node-emoji'
import { imageSizeFromFile } from 'image-size/fromFile';
import { readdir, readFile } from 'fs/promises';
import { copy, remove, writeJson, mkdirp } from 'fs-extra';

import { JekyllMarkdownParser } from './jekyll-markdown-parser';
import { EntryBase, ImageDimensionsRaw } from './base.types';

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

/** Get width and height of an image (raw, may be undefined for some formats) */
export async function getImageDimensions(imagePath: string): Promise<ImageDimensionsRaw> {
  const { width, height } = await imageSizeFromFile(imagePath);
  return { width, height };
}

/** Copy folder entries to dist, remove source file, and write entry.json */
export async function copyEntriesToDist<T extends { slug: string }>(
  entries: T[],
  sourceFolder: string,
  distFolder: string
): Promise<void> {
  // Process sequentially to fail fast on first error
  for (const entry of entries) {
    const entryDistFolder = path.join(distFolder, entry.slug);

    await mkdirp(entryDistFolder);
    await copy(path.join(sourceFolder, entry.slug), entryDistFolder);
    await remove(path.join(entryDistFolder, README_FILE));

    const entryJsonPath = path.join(entryDistFolder, ENTRY_FILE);
    await writeJson(entryJsonPath, entry);
    console.log('Generated post file:', entryJsonPath);
  }
}

/** Simple way to sort things: create a sort key that can be easily sorted */
function getSortKey(entry: EntryBase): string {
  // ISO 8601 strings sort correctly in lexicographic order
  return (entry.meta.sticky ? 'Z' : 'A') + '---' + entry.meta.published + '---' + entry.slug;
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
  blogPostsFolder: string
): Promise<T> {
  const parser = new JekyllMarkdownParser(baseUrl + folder + '/');
  const parsedJekyllMarkdown = parser.parse(markdown);

  const meta = parsedJekyllMarkdown.parsedYaml ?? {};

  // Convert Date objects from js-yaml to ISO strings
  // js-yaml parses unquoted dates (e.g., `published: 2024-01-15`) as Date objects
  if (meta.published instanceof Date) {
    meta.published = meta.published.toISOString();
  }
  if (meta.lastModified instanceof Date) {
    meta.lastModified = meta.lastModified.toISOString();
  }

  // Transform header from string (YAML) to object with dimensions
  if (meta.header) {
    const url = meta.header;  // Original string from YAML
    const imagePath = path.join(blogPostsFolder, folder, meta.header);
    const { width, height } = await getImageDimensions(imagePath);
    if (width === undefined || height === undefined) {
      throw new Error(`Could not determine dimensions for header image: ${imagePath}`);
    }
    meta.header = { url, width, height };
  }

  return {
    slug: folder,
    html: emoji.emojify(parsedJekyllMarkdown.html),
    meta
  } as T;
}

/** Read metadata and contents for all entries as list */
export async function getEntryList<T extends EntryBase>(entriesFolder: string, markdownBaseUrl: string): Promise<T[]> {
  const entryDirs = await readFolders(entriesFolder);
  const entries: T[] = [];

  for (const entryDir of entryDirs) {
    const readmePath = path.join(entriesFolder, entryDir, README_FILE);
    const readme = await readMarkdownFile(readmePath);
    const entry = await markdownToEntry<T>(readme, entryDir, markdownBaseUrl, entriesFolder);
    entries.push(entry);
  }

  return entries.sort((a, b) => getSortKey(b).localeCompare(getSortKey(a)));
}
