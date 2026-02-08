import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerAnchors,
  registerLinks,
  validateLinks,
  resetValidator,
  getAnchors,
  getLinks
} from './link-validator';

describe('link-validator', () => {
  beforeEach(() => {
    resetValidator();
  });

  describe('registerAnchors', () => {
    it('should register anchors for a path', () => {
      registerAnchors('/blog/my-post', ['intro', 'fazit']);

      const anchors = getAnchors('/blog/my-post');
      expect(anchors).toBeDefined();
      expect(anchors!.has('intro')).toBe(true);
      expect(anchors!.has('fazit')).toBe(true);
    });

    it('should accumulate anchors for same path', () => {
      registerAnchors('/blog/my-post', ['intro']);
      registerAnchors('/blog/my-post', ['fazit']);

      const anchors = getAnchors('/blog/my-post');
      expect(anchors!.size).toBe(2);
    });

    it('should keep anchors separate per path', () => {
      registerAnchors('/blog/post-1', ['intro']);
      registerAnchors('/blog/post-2', ['fazit']);

      expect(getAnchors('/blog/post-1')!.has('intro')).toBe(true);
      expect(getAnchors('/blog/post-1')!.has('fazit')).toBe(false);
      expect(getAnchors('/blog/post-2')!.has('fazit')).toBe(true);
    });
  });

  describe('registerLinks', () => {
    it('should extract anchor links from HTML', () => {
      const html = '<a href="/blog/other#section">Link</a>';
      registerLinks('/blog/my-post', html);

      const links = getLinks();
      expect(links).toHaveLength(1);
      expect(links[0]).toEqual({
        fromPath: '/blog/my-post',
        toPath: '/blog/other',
        anchor: 'section',
        fullLink: '/blog/other#section'
      });
    });

    it('should handle same-document anchors', () => {
      const html = '<a href="#local-section">Link</a>';
      registerLinks('/blog/my-post', html);

      const links = getLinks();
      expect(links[0].toPath).toBe('/blog/my-post');
      expect(links[0].anchor).toBe('local-section');
    });

    it('should extract multiple links', () => {
      const html = `
        <a href="/blog/a#one">One</a>
        <a href="/blog/b#two">Two</a>
        <a href="#three">Three</a>
      `;
      registerLinks('/blog/my-post', html);

      expect(getLinks()).toHaveLength(3);
    });

    it('should ignore links without anchors', () => {
      const html = '<a href="/blog/other">No anchor</a>';
      registerLinks('/blog/my-post', html);

      expect(getLinks()).toHaveLength(0);
    });

    it('should handle both quote styles', () => {
      const html = `
        <a href="/blog/a#one">Double</a>
        <a href='/blog/b#two'>Single</a>
      `;
      registerLinks('/blog/my-post', html);

      expect(getLinks()).toHaveLength(2);
    });

    it('should skip external https links', () => {
      const html = '<a href="https://example.com/page#section">External</a>';
      registerLinks('/blog/my-post', html);

      expect(getLinks()).toHaveLength(0);
    });

    it('should skip external http links', () => {
      const html = '<a href="http://example.com/page#section">External</a>';
      registerLinks('/blog/my-post', html);

      expect(getLinks()).toHaveLength(0);
    });

    it('should skip protocol-relative links', () => {
      const html = '<a href="//example.com/page#section">External</a>';
      registerLinks('/blog/my-post', html);

      expect(getLinks()).toHaveLength(0);
    });

    it('should skip mailto links', () => {
      const html = '<a href="mailto:test@example.com#subject">Mail</a>';
      registerLinks('/blog/my-post', html);

      expect(getLinks()).toHaveLength(0);
    });
  });

  describe('validateLinks', () => {
    it('should return valid for matching links', () => {
      registerAnchors('/blog/post-1', ['intro', 'fazit']);
      registerAnchors('/blog/post-2', ['overview']);

      const html = `
        <a href="/blog/post-1#intro">Intro</a>
        <a href="/blog/post-2#overview">Overview</a>
      `;
      registerLinks('/blog/post-1', html);

      const result = validateLinks();
      expect(result.valid).toBe(true);
      expect(result.brokenLinks).toHaveLength(0);
    });

    it('should detect broken anchor in existing path', () => {
      registerAnchors('/blog/post-1', ['intro']);

      const html = '<a href="/blog/post-1#nonexistent">Broken</a>';
      registerLinks('/blog/my-post', html);

      const result = validateLinks();
      expect(result.valid).toBe(false);
      expect(result.brokenLinks).toHaveLength(1);
      expect(result.brokenLinks[0].anchor).toBe('nonexistent');
    });

    it('should detect link to nonexistent path', () => {
      registerAnchors('/blog/post-1', ['intro']);

      const html = '<a href="/blog/nonexistent#intro">Broken</a>';
      registerLinks('/blog/my-post', html);

      const result = validateLinks();
      expect(result.valid).toBe(false);
      expect(result.brokenLinks).toHaveLength(1);
      expect(result.brokenLinks[0].toPath).toBe('/blog/nonexistent');
    });

    it('should validate same-document links', () => {
      registerAnchors('/blog/my-post', ['existing']);

      const html = `
        <a href="#existing">Valid</a>
        <a href="#missing">Broken</a>
      `;
      registerLinks('/blog/my-post', html);

      const result = validateLinks();
      expect(result.valid).toBe(false);
      expect(result.brokenLinks).toHaveLength(1);
      expect(result.brokenLinks[0].anchor).toBe('missing');
    });

    it('should count total links', () => {
      registerAnchors('/blog/post', ['a', 'b']);

      const html = '<a href="#a">A</a><a href="#b">B</a><a href="#c">C</a>';
      registerLinks('/blog/post', html);

      const result = validateLinks();
      expect(result.totalLinks).toBe(3);
    });
  });

  describe('resetValidator', () => {
    it('should clear all data', () => {
      registerAnchors('/blog/post', ['intro']);
      registerLinks('/blog/post', '<a href="#intro">Link</a>');

      resetValidator();

      expect(getAnchors('/blog/post')).toBeUndefined();
      expect(getLinks()).toHaveLength(0);
    });
  });
});
