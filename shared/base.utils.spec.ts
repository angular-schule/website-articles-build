import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readMarkdownFile, readFolders, getImageDimensions, copyEntriesToDist, getEntryList, markdownToEntry } from './base.utils';
import { EntryBase } from './base.types';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('base.utils', () => {

  describe('readMarkdownFile', () => {
    it('should throw error for non-existent file', async () => {
      await expect(readMarkdownFile('/non/existent/path/README.md'))
        .rejects
        .toThrow();
    });

    it('should read existing file content', async () => {
      const testFile = '/tmp/test-read-' + Date.now() + '.md';
      await fs.writeFile(testFile, 'Hello World');

      const content = await readMarkdownFile(testFile);
      expect(content).toBe('Hello World');

      await fs.rm(testFile);
    });
  });

  describe('readFolders', () => {
    const testDir = '/tmp/test-readFolders-' + Date.now();

    beforeEach(async () => {
      await fs.mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
    });

    it('should return only directory names', async () => {
      await fs.mkdir(path.join(testDir, 'folder1'));
      await fs.mkdir(path.join(testDir, 'folder2'));
      await fs.writeFile(path.join(testDir, 'file.txt'), 'content');

      const folders = await readFolders(testDir);

      expect(folders).toContain('folder1');
      expect(folders).toContain('folder2');
      expect(folders).not.toContain('file.txt');
    });

    it('should exclude folders starting with underscore', async () => {
      await fs.mkdir(path.join(testDir, 'visible'));
      await fs.mkdir(path.join(testDir, '_hidden'));
      await fs.mkdir(path.join(testDir, '_drafts'));

      const folders = await readFolders(testDir);

      expect(folders).toContain('visible');
      expect(folders).not.toContain('_hidden');
      expect(folders).not.toContain('_drafts');
    });

    it('should return empty array for empty directory', async () => {
      const folders = await readFolders(testDir);
      expect(folders).toEqual([]);
    });
  });

  describe('getImageDimensions', () => {
    it('should return dimensions for valid image', async () => {
      // Create a minimal valid PNG (1x1 pixel)
      const testImage = '/tmp/test-image-' + Date.now() + '.png';
      // Minimal PNG: 1x1 red pixel
      const pngData = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
        0x54, 0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0x3F,
        0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC, 0x59,
        0xE7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
        0x44, 0xAE, 0x42, 0x60, 0x82
      ]);
      await fs.writeFile(testImage, pngData);

      const { width, height } = await getImageDimensions(testImage);

      expect(width).toBe(1);
      expect(height).toBe(1);

      await fs.rm(testImage);
    });

    it('should throw for non-existent image', async () => {
      await expect(getImageDimensions('/non/existent/image.png'))
        .rejects
        .toThrow();
    });

    it('should throw for invalid image file', async () => {
      // Create a text file that is not a valid image
      const invalidImage = '/tmp/test-invalid-image-' + Date.now() + '.png';
      await fs.writeFile(invalidImage, 'this is not an image');

      await expect(getImageDimensions(invalidImage))
        .rejects
        .toThrow();

      await fs.rm(invalidImage);
    });
  });

  describe('copyEntriesToDist', () => {
    const testDir = '/tmp/test-copyEntries-' + Date.now();
    const sourceDir = path.join(testDir, 'source');
    const distDir = path.join(testDir, 'dist');

    beforeEach(async () => {
      await fs.mkdir(sourceDir, { recursive: true });
      await fs.mkdir(distDir, { recursive: true });
    });

    afterEach(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
    });

    it('should copy entry folder to dist and create entry.json', async () => {
      // Create source entry
      const entrySlug = 'test-post';
      await fs.mkdir(path.join(sourceDir, entrySlug));
      await fs.writeFile(path.join(sourceDir, entrySlug, 'README.md'), '# Test');
      await fs.writeFile(path.join(sourceDir, entrySlug, 'image.png'), 'fake-image');

      const entries = [{ slug: entrySlug, html: '<p>Test</p>', meta: { title: 'Test' } }];
      await copyEntriesToDist(entries, sourceDir, distDir);

      // Check entry.json was created
      const entryJson = JSON.parse(
        await fs.readFile(path.join(distDir, entrySlug, 'entry.json'), 'utf8')
      );
      expect(entryJson.slug).toBe(entrySlug);
      expect(entryJson.html).toBe('<p>Test</p>');

      // Check README.md was removed
      await expect(fs.access(path.join(distDir, entrySlug, 'README.md')))
        .rejects.toThrow();

      // Check other files were copied
      const imageContent = await fs.readFile(path.join(distDir, entrySlug, 'image.png'), 'utf8');
      expect(imageContent).toBe('fake-image');
    });

    it('should handle multiple entries', async () => {
      await fs.mkdir(path.join(sourceDir, 'post-1'));
      await fs.mkdir(path.join(sourceDir, 'post-2'));
      await fs.writeFile(path.join(sourceDir, 'post-1', 'README.md'), '# 1');
      await fs.writeFile(path.join(sourceDir, 'post-2', 'README.md'), '# 2');

      const entries = [
        { slug: 'post-1', html: '<p>1</p>', meta: {} },
        { slug: 'post-2', html: '<p>2</p>', meta: {} },
      ];
      await copyEntriesToDist(entries, sourceDir, distDir);

      const json1 = JSON.parse(await fs.readFile(path.join(distDir, 'post-1', 'entry.json'), 'utf8'));
      const json2 = JSON.parse(await fs.readFile(path.join(distDir, 'post-2', 'entry.json'), 'utf8'));

      expect(json1.slug).toBe('post-1');
      expect(json2.slug).toBe('post-2');
    });
  });

  describe('getEntryList - Error Handling', () => {
    const testDir = '/tmp/test-blog-entries-' + Date.now();

    beforeEach(async () => {
      // Create test directory structure
      await fs.mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
      // Cleanup
      await fs.rm(testDir, { recursive: true, force: true });
    });

    it('should throw error when README.md is missing in entry folder', async () => {
      // Create folder without README.md
      await fs.mkdir(path.join(testDir, 'broken-entry'), { recursive: true });

      await expect(getEntryList<EntryBase>(testDir, 'https://example.com/'))
        .rejects
        .toThrow();
    });

    it('should throw error when folder contains invalid markdown', async () => {
      // Create folder with README.md that has invalid YAML
      const entryDir = path.join(testDir, 'invalid-yaml-entry');
      await fs.mkdir(entryDir, { recursive: true });
      await fs.writeFile(
        path.join(entryDir, 'README.md'),
        '---\ninvalid: yaml: syntax: here\n---\nContent'
      );

      await expect(getEntryList<EntryBase>(testDir, 'https://example.com/'))
        .rejects
        .toThrow();
    });

    it('should process valid entries without error', async () => {
      // Create valid entry
      const entryDir = path.join(testDir, 'valid-entry');
      await fs.mkdir(entryDir, { recursive: true });
      await fs.writeFile(
        path.join(entryDir, 'README.md'),
        '---\ntitle: Test\npublished: 2024-01-01\n---\n\n# Hello'
      );

      const result = await getEntryList<EntryBase>(testDir, 'https://example.com/');

      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('valid-entry');
    });

    it('should abort on first error, not continue with other entries', async () => {
      // Create two entries: first broken, second valid
      const brokenDir = path.join(testDir, 'aaa-broken'); // sorts first alphabetically
      const validDir = path.join(testDir, 'zzz-valid');

      await fs.mkdir(brokenDir, { recursive: true });
      await fs.mkdir(validDir, { recursive: true });

      // No README.md in broken dir
      await fs.writeFile(
        path.join(validDir, 'README.md'),
        '---\ntitle: Valid\npublished: 2024-01-01\n---\nContent'
      );

      // Should throw, not return partial results
      await expect(getEntryList<EntryBase>(testDir, 'https://example.com/'))
        .rejects
        .toThrow();
    });
  });

  describe('markdownToEntry', () => {
    it('should throw when header image does not exist', async () => {
      const markdown = '---\ntitle: Test\npublished: 2024-01-01\nheader: non-existent.jpg\n---\nContent';

      await expect(markdownToEntry<EntryBase>(
        markdown,
        'test-entry',
        'https://example.com/',
        '/non/existent/path'
      )).rejects.toThrow();
    });

    it('should convert emoji shortcodes to unicode emojis', async () => {
      const markdown = '---\ntitle: Test\npublished: 2024-01-01\n---\n\nHello :smile: World :rocket:';

      const result = await markdownToEntry<EntryBase>(
        markdown,
        'test-entry',
        'https://example.com/',
        '/tmp'
      );

      // node-emoji converts :smile: to 😄 and :rocket: to 🚀
      expect(result.html).toContain('😄');
      expect(result.html).toContain('🚀');
      expect(result.html).not.toContain(':smile:');
      expect(result.html).not.toContain(':rocket:');
    });

    it('should convert published date to ISO string', async () => {
      const markdown = '---\ntitle: Test\npublished: 2024-06-15\n---\nContent';

      const result = await markdownToEntry<EntryBase>(
        markdown,
        'test-entry',
        'https://example.com/',
        '/tmp'
      );

      // js-yaml parses unquoted dates as Date objects, but we convert to ISO string
      expect(typeof result.meta.published).toBe('string');
      expect(result.meta.published).toMatch(/^2024-06-15/);
    });

    it('should set slug from folder name', async () => {
      const markdown = '---\ntitle: Test\npublished: 2024-01-01\n---\nContent';

      const result = await markdownToEntry<EntryBase>(
        markdown,
        'my-awesome-post',
        'https://example.com/',
        '/tmp'
      );

      expect(result.slug).toBe('my-awesome-post');
    });
  });

  describe('getEntryList - Sorting', () => {
    const testDir = '/tmp/test-blog-sorting-' + Date.now();

    beforeEach(async () => {
      await fs.mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
    });

    /**
     * SORTING BEHAVIOR DOCUMENTATION:
     * --------------------------------
     * Dates are converted to ISO 8601 strings in markdownToEntry().
     * ISO strings sort correctly in lexicographic order (e.g., "2024-01-15" < "2025-01-15").
     */

    it('should sort entries by published date (newest first)', async () => {
      const entries = [
        { dir: 'middle-post', date: '2024-06-15' },
        { dir: 'oldest-post', date: '2023-01-01' },
        { dir: 'newest-post', date: '2025-12-31' },
      ];

      for (const e of entries) {
        const entryDir = path.join(testDir, e.dir);
        await fs.mkdir(entryDir, { recursive: true });
        await fs.writeFile(
          path.join(entryDir, 'README.md'),
          `---\ntitle: ${e.dir}\npublished: ${e.date}\n---\nContent`
        );
      }

      const result = await getEntryList<EntryBase>(testDir, 'https://example.com/');

      expect(result).toHaveLength(3);
      // Newest first (descending order)
      expect(result[0].slug).toBe('newest-post');   // 2025-12-31
      expect(result[1].slug).toBe('middle-post');   // 2024-06-15
      expect(result[2].slug).toBe('oldest-post');   // 2023-01-01
    });

    it('should sort sticky entries before non-sticky entries', async () => {
      const entries = [
        { dir: 'normal-new', date: '2025-01-01', sticky: false },
        { dir: 'sticky-old', date: '2020-01-01', sticky: true },
        { dir: 'normal-old', date: '2020-01-01', sticky: false },
      ];

      for (const e of entries) {
        const entryDir = path.join(testDir, e.dir);
        await fs.mkdir(entryDir, { recursive: true });
        const stickyLine = e.sticky ? 'sticky: true\n' : '';
        await fs.writeFile(
          path.join(entryDir, 'README.md'),
          `---\ntitle: ${e.dir}\npublished: ${e.date}\n${stickyLine}---\nContent`
        );
      }

      const result = await getEntryList<EntryBase>(testDir, 'https://example.com/');

      expect(result).toHaveLength(3);
      // Sticky first, then by date
      expect(result[0].slug).toBe('sticky-old');    // sticky, even though old
      expect(result[1].slug).toBe('normal-new');    // 2025-01-01
      expect(result[2].slug).toBe('normal-old');    // 2020-01-01
    });

    it('should use slug as tiebreaker for same date', async () => {
      const entries = [
        { dir: 'zzz-post', date: '2024-01-01' },
        { dir: 'aaa-post', date: '2024-01-01' },
        { dir: 'mmm-post', date: '2024-01-01' },
      ];

      for (const e of entries) {
        const entryDir = path.join(testDir, e.dir);
        await fs.mkdir(entryDir, { recursive: true });
        await fs.writeFile(
          path.join(entryDir, 'README.md'),
          `---\ntitle: ${e.dir}\npublished: ${e.date}\n---\nContent`
        );
      }

      const result = await getEntryList<EntryBase>(testDir, 'https://example.com/');

      expect(result).toHaveLength(3);
      // Same date, sorted by slug descending (Z first)
      expect(result[0].slug).toBe('zzz-post');
      expect(result[1].slug).toBe('mmm-post');
      expect(result[2].slug).toBe('aaa-post');
    });
  });
});
