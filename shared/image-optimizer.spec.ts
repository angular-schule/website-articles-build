import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import sharp from 'sharp';
import * as fs from 'fs/promises';
import * as path from 'path';
import { optimizeImagesInFolder, rewriteImageReferences, MAX_WIDTH } from './image-optimizer';

describe('image-optimizer', () => {
  const dir = '/tmp/test-img-opt-' + Date.now();

  beforeEach(async () => {
    await fs.mkdir(dir, { recursive: true });
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  describe('optimizeImagesInFolder', () => {
    it('converts jpg/png to webp, downscales wide images, removes originals', async () => {
      await sharp({ create: { width: 2000, height: 800, channels: 3, background: '#123456' } })
        .jpeg()
        .toFile(path.join(dir, 'big.jpg'));
      await sharp({ create: { width: 100, height: 100, channels: 3, background: '#abcdef' } })
        .png()
        .toFile(path.join(dir, 'small.png'));
      // Image in a subfolder (recursion).
      await fs.mkdir(path.join(dir, 'gallery'), { recursive: true });
      await sharp({ create: { width: 300, height: 200, channels: 3, background: '#00ff00' } })
        .jpeg()
        .toFile(path.join(dir, 'gallery', 'shot.jpg'));
      await fs.writeFile(path.join(dir, 'logo.svg'), '<svg></svg>');

      const map = await optimizeImagesInFolder(dir);

      // Wide image downscaled to MAX_WIDTH, small one not upscaled.
      expect(map.get('big.jpg')?.webp).toBe('big.webp');
      expect(map.get('big.jpg')?.width).toBe(MAX_WIDTH);
      expect(map.get('small.png')?.webp).toBe('small.webp');
      expect(map.get('small.png')?.width).toBe(100);

      // Subfolder image converted too (recursive), keyed by relative path.
      expect(map.get(path.join('gallery', 'shot.jpg'))?.webp).toBe(path.join('gallery', 'shot.webp'));
      await expect(fs.access(path.join(dir, 'gallery', 'shot.webp'))).resolves.toBeUndefined();
      await expect(fs.access(path.join(dir, 'gallery', 'shot.jpg'))).rejects.toThrow();

      // Originals removed, webp present.
      await expect(fs.access(path.join(dir, 'big.jpg'))).rejects.toThrow();
      await expect(fs.access(path.join(dir, 'big.webp'))).resolves.toBeUndefined();
      await expect(fs.access(path.join(dir, 'small.webp'))).resolves.toBeUndefined();

      // SVG untouched and not in the map.
      await expect(fs.access(path.join(dir, 'logo.svg'))).resolves.toBeUndefined();
      expect(map.has('logo.svg')).toBe(false);
    });

    it('returns an empty map when there is nothing to optimize', async () => {
      await fs.writeFile(path.join(dir, 'notes.txt'), 'hello');
      const map = await optimizeImagesInFolder(dir);
      expect(map.size).toBe(0);
    });
  });

  describe('rewriteImageReferences', () => {
    it('rewrites header (url + dimensions) and html references, leaving others alone', () => {
      const map = new Map([['header.jpg', { webp: 'header.webp', width: 800, height: 400 }]]);
      const entry = {
        html: '<img src="x/header.jpg"> und <img src="x/other.svg">',
        meta: { header: { url: 'header.jpg', width: 2000, height: 1000 } },
      };

      rewriteImageReferences(entry, map);

      expect(entry.meta.header.url).toBe('header.webp');
      expect(entry.meta.header.width).toBe(800);
      expect(entry.meta.header.height).toBe(400);
      expect(entry.html).toContain('header.webp');
      expect(entry.html).not.toContain('header.jpg');
      expect(entry.html).toContain('other.svg');
    });
  });
});
