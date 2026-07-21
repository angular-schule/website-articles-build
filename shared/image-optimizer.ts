import * as path from 'path';
import { readdir, unlink } from 'fs/promises';
import sharp from 'sharp';

/**
 * Image optimization for article assets.
 *
 * Raster images (jpg/jpeg/png) in an entry folder are converted to resized WebP.
 * The original files are removed from the dist folder, so the CDN only serves the
 * optimized variant. SVG, GIF and existing WebP files are left untouched.
 *
 * Every consuming website (angular.schule, angular-buch.com, agentic.schule, …)
 * benefits automatically, because they all read the same generated JSON/images.
 */

/** Max width in px; larger images are downscaled (never upscaled). */
export const MAX_WIDTH = 1600;
/** WebP quality (0-100). */
export const WEBP_QUALITY = 80;

const RASTER = /\.(jpe?g|png)$/i;

export interface OptimizedImage {
  /** New relative path, e.g. "header.webp" or "gallery/shot.webp" */
  webp: string;
  /** Dimensions of the generated WebP (after optional downscaling). */
  width: number;
  height: number;
}

/** Collect all file paths under `dir`, relative to `base` (recursive). */
async function collectFiles(dir: string, base: string): Promise<string[]> {
  const dirents = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const dirent of dirents) {
    const full = path.join(dir, dirent.name);
    if (dirent.isDirectory()) {
      files.push(...(await collectFiles(full, base)));
    } else {
      files.push(path.relative(base, full));
    }
  }
  return files;
}

/**
 * Convert all jpg/jpeg/png files in `folder` (recursively, incl. subfolders like
 * `.../gallery/shot.jpg`) to resized WebP in place, deleting the originals.
 * Returns a map: original relative path → optimized info. Empty when nothing to do.
 */
export async function optimizeImagesInFolder(
  folder: string,
): Promise<Map<string, OptimizedImage>> {
  const optimized = new Map<string, OptimizedImage>();
  const files = await collectFiles(folder, folder);

  for (const rel of files) {
    if (!RASTER.test(rel)) continue;

    const source = path.join(folder, rel);
    const webpRel = rel.replace(RASTER, '.webp');
    const target = path.join(folder, webpRel);

    const info = await sharp(source)
      .rotate() // respektiert EXIF-Orientierung
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toFile(target);

    optimized.set(rel, { webp: webpRel, width: info.width, height: info.height });
    await unlink(source);
  }

  return optimized;
}

/**
 * Rewrite image references in an entry after optimization (mutates in place):
 *  - `meta.header` (object with url/width/height) → WebP url + new dimensions
 *  - `html` → every reference to a converted file name is pointed at the WebP
 */
export function rewriteImageReferences(
  entry: { html?: unknown; meta?: unknown },
  optimized: Map<string, OptimizedImage>,
): void {
  if (optimized.size === 0) return;

  // Header (used by both entry.json and the light list.json).
  const meta = entry.meta as
    | { header?: { url?: string; width?: number; height?: number } }
    | undefined;
  const header = meta?.header;
  if (header && typeof header.url === 'string') {
    const opt = optimized.get(header.url);
    if (opt) {
      header.url = opt.webp;
      header.width = opt.width;
      header.height = opt.height;
    }
  }

  // Content images inside the rendered HTML. Replace longer file names first so
  // that a short name is never a partial match inside a longer one.
  if (typeof entry.html === 'string') {
    let html = entry.html;
    const names = [...optimized.keys()].sort((a, b) => b.length - a.length);
    for (const original of names) {
      html = html.split(original).join(optimized.get(original)!.webp);
    }
    entry.html = html;
  }
}
