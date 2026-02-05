import { describe, it, expect } from 'vitest';
import { makeLightBlogList } from './blog.utils';
import { BlogEntryFull } from './blog.types';

describe('makeLightBlogList', () => {
  const createMockEntry = (overrides: Partial<BlogEntryFull> = {}): BlogEntryFull => {
    const defaultHtml = '<p>This is a test paragraph that is definitely longer than one hundred characters to ensure it gets extracted properly by the extractFirstBigParagraph function.</p>';
    return {
      slug: 'test-post',
      html: overrides.html ?? defaultHtml,
      meta: {
        title: 'Test Post',
        author: 'Test Author',
        mail: 'test@example.com',
        published: '2024-01-01T00:00:00.000Z',
        language: 'en',
        header: { url: 'header.jpg', width: 800, height: 400 },
        'darken-header': false,
        ...overrides.meta,
      },
      ...overrides,
    };
  };

  it('should filter out hidden entries', () => {
    const entries: BlogEntryFull[] = [
      createMockEntry({ slug: 'visible', meta: { ...createMockEntry().meta, hidden: false } }),
      createMockEntry({ slug: 'hidden', meta: { ...createMockEntry().meta, hidden: true } }),
    ];

    const result = makeLightBlogList(entries);
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('visible');
  });

  it('should filter out entries with hidden: true even when other entries have no hidden field', () => {
    const entries: BlogEntryFull[] = [
      createMockEntry({ slug: 'no-hidden-field' }), // hidden is undefined
      createMockEntry({ slug: 'explicitly-hidden', meta: { ...createMockEntry().meta, hidden: true } }),
    ];

    const result = makeLightBlogList(entries);
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('no-hidden-field');
  });

  it('should extract first big paragraph for html field', () => {
    const shortParagraph = '<p>Short</p>';
    const longParagraph = '<p>This is a much longer paragraph that contains more than one hundred characters to ensure it meets the minimum length requirement for extraction.</p>';

    const entries: BlogEntryFull[] = [
      createMockEntry({ html: shortParagraph + longParagraph }),
    ];

    const result = makeLightBlogList(entries);
    expect(result[0].html).toBe(longParagraph);
  });

  it('should include only required meta fields', () => {
    const publishedDate = '2024-01-01T00:00:00.000Z';
    const entries: BlogEntryFull[] = [
      createMockEntry({
        meta: {
          title: 'Test',
          author: 'Author',
          mail: 'mail@test.com',
          published: publishedDate,
          language: 'de',
          header: { url: 'img.jpg', width: 100, height: 50 },
          hidden: false,
          'darken-header': true,
          keywords: ['angular', 'test'],
          bio: 'Some bio',
          sticky: true,
        },
      }),
    ];

    const result = makeLightBlogList(entries);
    const meta = result[0].meta;

    // Required fields should be present with exact values
    expect(meta.title).toBe('Test');
    expect(meta.author).toBe('Author');
    expect(meta.mail).toBe('mail@test.com');
    expect(meta.published).toBe(publishedDate);
    expect(meta.language).toBe('de');
    expect(meta.header).toEqual({ url: 'img.jpg', width: 100, height: 50 });

    // These should NOT be included in light version
    expect((meta as any).hidden).toBeUndefined();
    expect((meta as any)['darken-header']).toBeUndefined();
    expect((meta as any).keywords).toBeUndefined();
    expect((meta as any).bio).toBeUndefined();
    expect((meta as any).sticky).toBeUndefined();
  });

  it('should include author2 and mail2 if present', () => {
    const entries: BlogEntryFull[] = [
      createMockEntry({
        meta: {
          ...createMockEntry().meta,
          author2: 'Second Author',
          mail2: 'author2@test.com',
        },
      }),
    ];

    const result = makeLightBlogList(entries);
    expect(result[0].meta.author2).toBe('Second Author');
    expect(result[0].meta.mail2).toBe('author2@test.com');
  });

  it('should not include author2/mail2 if not present in source', () => {
    const entries: BlogEntryFull[] = [createMockEntry()];

    const result = makeLightBlogList(entries);
    expect(result[0].meta.author2).toBeUndefined();
    expect(result[0].meta.mail2).toBeUndefined();
  });

  it('should include author2 only if mail2 is missing (and vice versa)', () => {
    const entriesWithAuthor2Only: BlogEntryFull[] = [
      createMockEntry({
        meta: { ...createMockEntry().meta, author2: 'Second Author' },
      }),
    ];
    const entriesWithMail2Only: BlogEntryFull[] = [
      createMockEntry({
        meta: { ...createMockEntry().meta, mail2: 'author2@test.com' },
      }),
    ];

    const result1 = makeLightBlogList(entriesWithAuthor2Only);
    expect(result1[0].meta.author2).toBe('Second Author');
    expect(result1[0].meta.mail2).toBeUndefined();

    const result2 = makeLightBlogList(entriesWithMail2Only);
    expect(result2[0].meta.author2).toBeUndefined();
    expect(result2[0].meta.mail2).toBe('author2@test.com');
  });

  it('should include isUpdatePost if present', () => {
    const entries: BlogEntryFull[] = [
      createMockEntry({
        meta: { ...createMockEntry().meta, isUpdatePost: true },
      }),
    ];

    const result = makeLightBlogList(entries);
    expect(result[0].meta.isUpdatePost).toBe(true);
  });

  it('should not include isUpdatePost if not present in source', () => {
    const entries: BlogEntryFull[] = [createMockEntry()];

    const result = makeLightBlogList(entries);
    expect(result[0].meta.isUpdatePost).toBeUndefined();
  });

  it('should return empty array for empty input', () => {
    const result = makeLightBlogList([]);
    expect(result).toEqual([]);
  });

  it('should preserve slug exactly', () => {
    const entries: BlogEntryFull[] = [
      createMockEntry({ slug: '2024-01-my-awesome-post' }),
    ];

    const result = makeLightBlogList(entries);
    expect(result[0].slug).toBe('2024-01-my-awesome-post');
  });

  it('should process multiple entries maintaining order', () => {
    const entries: BlogEntryFull[] = [
      createMockEntry({ slug: 'first-post', meta: { ...createMockEntry().meta, title: 'First' } }),
      createMockEntry({ slug: 'second-post', meta: { ...createMockEntry().meta, title: 'Second' } }),
      createMockEntry({ slug: 'third-post', meta: { ...createMockEntry().meta, title: 'Third' } }),
    ];

    const result = makeLightBlogList(entries);
    expect(result).toHaveLength(3);
    expect(result[0].slug).toBe('first-post');
    expect(result[0].meta.title).toBe('First');
    expect(result[1].slug).toBe('second-post');
    expect(result[1].meta.title).toBe('Second');
    expect(result[2].slug).toBe('third-post');
    expect(result[2].meta.title).toBe('Third');
  });
});
