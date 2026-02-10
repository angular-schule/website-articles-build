/**
 * Tests for gfm-heading-id.ts
 *
 * Adapted from: https://github.com/markedjs/marked-gfm-heading-id
 * Original tests by marked team, MIT license.
 *
 * Key behaviors tested:
 * 1. ID generation with github-slugger
 * 2. Heading list collection
 * 3. Reset functionality
 * 4. text (with HTML) vs raw (plain text) separation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Marked } from 'marked';
import { gfmHeadingId, getHeadingList, resetHeadings, HeadingData } from './gfm-heading-id';

describe('gfm-heading-id', () => {
  let marked: Marked;

  beforeEach(() => {
    resetHeadings();
    marked = new Marked(gfmHeadingId());
  });

  describe('ID generation', () => {
    it('should generate lowercase slugified IDs', () => {
      marked.parse('# Hello World');
      expect(getHeadingList()[0].id).toBe('hello-world');
    });

    it('should increment IDs for duplicate headings', () => {
      marked.parse('# foo\n\n# foo\n\n# foo');
      const headings = getHeadingList();

      expect(headings[0].id).toBe('foo');
      expect(headings[1].id).toBe('foo-1');
      expect(headings[2].id).toBe('foo-2');
    });

    it('should handle heading text that looks like an ID suffix', () => {
      // "foo 1" as text should not conflict with "foo-1" as auto-suffix
      marked.parse('# foo 1\n\n# foo\n\n# foo');
      const headings = getHeadingList();

      expect(headings[0].id).toBe('foo-1');   // "foo 1" → "foo-1"
      expect(headings[1].id).toBe('foo');     // first "foo"
      expect(headings[2].id).toBe('foo-2');   // second "foo" → "foo-2" (not foo-1!)
    });

    it('should support prefix option', () => {
      marked = new Marked(gfmHeadingId({ prefix: 'custom-' }));
      marked.parse('# Test');
      expect(getHeadingList()[0].id).toBe('custom-test');
    });

    it('should handle German umlauts (github-slugger behavior)', () => {
      marked.parse('# Über uns');
      expect(getHeadingList()[0].id).toBe('über-uns');
    });

    it('should handle special characters in headings', () => {
      marked.parse('# FAQ & Hilfe');
      // github-slugger removes & but keeps surrounding chars
      expect(getHeadingList()[0].id).toBe('faq--hilfe');
    });
  });

  describe('getHeadingList()', () => {
    it('should collect all headings with correct levels', () => {
      marked.parse('# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6');
      const headings = getHeadingList();

      expect(headings).toHaveLength(6);
      expect(headings.map(h => h.level)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('should return HeadingData with all required properties', () => {
      marked.parse('## Test Heading');
      const heading = getHeadingList()[0];

      expect(heading).toMatchObject<HeadingData>({
        level: 2,
        text: 'Test Heading',
        raw: 'Test Heading',
        id: 'test-heading'
      });
    });

    it('should clear list on each new parse (preprocess hook)', () => {
      marked.parse('# First');
      expect(getHeadingList()).toHaveLength(1);

      marked.parse('# Second\n## Third');
      expect(getHeadingList()).toHaveLength(2);
      expect(getHeadingList()[0].raw).toBe('Second');
    });
  });

  describe('resetHeadings()', () => {
    it('should clear heading list when called manually', () => {
      marked.parse('# Test');
      expect(getHeadingList()).toHaveLength(1);

      resetHeadings();
      expect(getHeadingList()).toHaveLength(0);
    });

    it('should reset slugger counter', () => {
      marked.parse('# foo\n\n# foo');
      expect(getHeadingList()[1].id).toBe('foo-1');

      resetHeadings();
      // Slug counter should start fresh
      marked.parse('# foo\n\n# foo');
      expect(getHeadingList()[1].id).toBe('foo-1'); // NOT foo-3
    });
  });

  describe('text vs raw separation (OUR KEY IMPROVEMENT)', () => {
    /**
     * This is the main value of our fork:
     * - text: preserves HTML as rendered by marked (for display)
     * - raw: plain text with HTML stripped and entities decoded (for TOC)
     */

    it('should preserve HTML in text but strip from raw', () => {
      marked.parse('# Hello **world**');
      const heading = getHeadingList()[0];

      expect(heading.text).toBe('Hello <strong>world</strong>');
      expect(heading.raw).toBe('Hello world');
    });

    it('should strip inline code tags from raw', () => {
      marked.parse('# Using `npm install`');
      const heading = getHeadingList()[0];

      expect(heading.text).toContain('<code>npm install</code>');
      expect(heading.raw).toBe('Using npm install');
    });

    it('should strip nested HTML tags from raw', () => {
      marked.parse('# <samp>Hello <ins>world!</ins></samp>');
      const heading = getHeadingList()[0];

      expect(heading.text).toContain('<samp>');
      expect(heading.text).toContain('<ins>');
      expect(heading.raw).toBe('Hello world!');
    });

    it('should decode &amp; entities in raw', () => {
      // When marked renders bold, it may produce entities
      marked.parse('# Tom **&** Jerry');  // literal & in markdown
      const heading = getHeadingList()[0];

      // The & should be decoded in raw, not show as &amp;
      expect(heading.raw).toBe('Tom & Jerry');
    });

    it('should decode &quot; entities in raw', () => {
      // Test actual entity handling - marked escapes quotes in certain contexts
      marked.parse('# Title with **"quotes"**');
      const heading = getHeadingList()[0];

      expect(heading.raw).toBe('Title with "quotes"');
    });

    it('should decode &#39; and &#x27; entities (single quotes)', () => {
      // Create a heading where marked produces &#39;
      marked.parse("# It's **fine**");
      const heading = getHeadingList()[0];

      expect(heading.raw).toBe("It's fine");
    });
  });

  describe('edge cases', () => {
    it('should handle empty heading', () => {
      marked.parse('# ');
      const heading = getHeadingList()[0];

      expect(heading.raw).toBe('');
      expect(heading.id).toBe('');
    });

    it('should handle HTML comment in heading (stripped by marked)', () => {
      marked.parse('# visible <!-- hidden --> text');
      const heading = getHeadingList()[0];

      // marked v17 strips comments entirely, including surrounding whitespace
      expect(heading.raw).toBe('visible  text');
    });

    it('should handle raw HTML that looks like a tag (treated as HTML)', () => {
      // <em> is valid HTML, so marked treats it as such
      marked.parse('# Text with <em>emphasis</em>');
      const heading = getHeadingList()[0];

      expect(heading.text).toContain('<em>');
      expect(heading.raw).toBe('Text with emphasis');
    });

    it('should handle invalid HTML-like content', () => {
      // <invalid is not closed, marked escapes the <
      marked.parse('# Text with <invalid');
      const heading = getHeadingList()[0];

      // marked escapes the < to &lt; in text, we decode it in raw
      expect(heading.raw).toBe('Text with <invalid');
    });
  });

  describe('HTML output format', () => {
    it('should produce heading with id attribute', () => {
      const html = marked.parse('# Test');
      expect(html).toContain('<h1 id="test">Test</h1>');
    });

    it('should include newline after heading', () => {
      const html = marked.parse('# Test');
      expect(html).toBe('<h1 id="test">Test</h1>\n');
    });

    it('should preserve inline HTML in output', () => {
      const html = marked.parse('# Hello **world**');
      expect(html).toContain('<strong>world</strong>');
    });
  });
});
