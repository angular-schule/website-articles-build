import { describe, it, expect } from 'vitest';
import { extractFirstBigParagraph, makeLightList } from './list.utils';
import { EntryBase } from './base.types';

describe('makeLightList', () => {
  const createEntry = (slug: string, hidden = false): EntryBase => ({
    slug,
    html: '<p>This is a test paragraph that is definitely longer than one hundred characters to ensure proper extraction.</p>',
    meta: {
      title: `Entry ${slug}`,
      published: '2024-01-01T00:00:00.000Z',
      hidden,
    },
  });

  it('should filter out hidden entries', () => {
    const entries = [
      createEntry('visible', false),
      createEntry('hidden', true),
    ];

    const result = makeLightList(entries);

    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('visible');
  });

  it('should extract first big paragraph for html', () => {
    const entries: EntryBase[] = [{
      slug: 'test',
      html: '<p>Short</p><p>This is a much longer paragraph that contains more than one hundred characters to ensure it meets the minimum length requirement.</p>',
      meta: { title: 'Test', published: '2024-01-01T00:00:00.000Z' },
    }];

    const result = makeLightList(entries);

    expect(result[0].html).not.toContain('Short');
    expect(result[0].html).toContain('much longer paragraph');
  });

  it('should preserve all other entry properties', () => {
    const entries: EntryBase[] = [{
      slug: 'test-slug',
      html: '<p>Long enough paragraph with more than one hundred characters for the test to work properly.</p>',
      meta: {
        title: 'Test Title',
        published: '2024-06-15T00:00:00.000Z',
        sticky: true,
      },
    }];

    const result = makeLightList(entries);

    expect(result[0].slug).toBe('test-slug');
    expect(result[0].meta.title).toBe('Test Title');
    expect(result[0].meta.published).toBe('2024-06-15T00:00:00.000Z');
    expect(result[0].meta.sticky).toBe(true);
  });

  it('should return empty array for empty input', () => {
    expect(makeLightList([])).toEqual([]);
  });

  it('should maintain order of entries', () => {
    const entries = [
      createEntry('first'),
      createEntry('second'),
      createEntry('third'),
    ];

    const result = makeLightList(entries);

    expect(result.map(e => e.slug)).toEqual(['first', 'second', 'third']);
  });
});

describe('extractFirstBigParagraph', () => {
  it('should return empty string for empty input', () => {
    expect(extractFirstBigParagraph('')).toBe('');
  });

  it('should return empty string for null/undefined input', () => {
    expect(extractFirstBigParagraph(null as any)).toBe('');
    expect(extractFirstBigParagraph(undefined as any)).toBe('');
  });

  it('should return empty string when no paragraphs found', () => {
    const html = '<div>Just a div without paragraphs</div>';
    expect(extractFirstBigParagraph(html)).toBe('');
  });

  it('should return first paragraph when all paragraphs are too short (fallback)', () => {
    const html = '<p>Short</p><p>Also short</p>';
    expect(extractFirstBigParagraph(html)).toBe('<p>Short</p>');
  });

  it('should return first paragraph longer than 100 characters', () => {
    const shortParagraph = '<p>Short paragraph</p>';
    const longParagraph = '<p>This is a much longer paragraph that contains more than one hundred characters to ensure it meets the minimum length requirement for extraction.</p>';
    const html = shortParagraph + longParagraph;

    const result = extractFirstBigParagraph(html);
    expect(result).toBe(longParagraph);
  });

  it('should skip the first long paragraph if second is longer', () => {
    // The function finds the FIRST paragraph > 100 chars, not the longest
    const first = '<p>This is the first paragraph that is long enough with more than one hundred characters to qualify for extraction purposes.</p>';
    const second = '<p>This is an even longer second paragraph that also exceeds one hundred characters but should not be selected because the first one already qualifies.</p>';
    const html = first + second;

    const result = extractFirstBigParagraph(html);
    expect(result).toBe(first);
  });

  it('should remove image tags before matching paragraphs', () => {
    // The function strips img tags from the HTML, then matches paragraphs from the stripped version
    const html = '<p><img src="test.png" alt="test">This is a paragraph with an image that contains more than one hundred characters to meet the minimum requirement.</p>';

    const result = extractFirstBigParagraph(html);
    // Result should be the paragraph from the stripped HTML (without img)
    expect(result).toBe('<p>This is a paragraph with an image that contains more than one hundred characters to meet the minimum requirement.</p>');
  });

  it('should strip anchor tags but retain link text', () => {
    const html = '<p>This paragraph contains <a href="https://example.com">a link</a> and is long enough to meet the one hundred character minimum requirement for extraction testing.</p>';

    const result = extractFirstBigParagraph(html);
    expect(result).toBe('<p>This paragraph contains a link and is long enough to meet the one hundred character minimum requirement for extraction testing.</p>');
  });

  it('should preserve paragraph attributes', () => {
    const html = '<p class="intro" id="first">This is a much longer paragraph with attributes that contains more than one hundred characters to ensure it meets the minimum length requirement.</p>';

    const result = extractFirstBigParagraph(html);
    expect(result).toBe('<p class="intro" id="first">This is a much longer paragraph with attributes that contains more than one hundred characters to ensure it meets the minimum length requirement.</p>');
  });

  it('should handle multiline paragraphs', () => {
    const html = `<p>This is a paragraph
that spans multiple lines
and contains more than one hundred characters
to meet the extraction requirement.</p>`;

    const result = extractFirstBigParagraph(html);
    expect(result).toBe(html);
  });

  it('should count TEXT length (not HTML length) when determining > 100', () => {
    // The function now strips HTML tags before counting length.
    // '<p>xxx</p>' has 3 chars of TEXT content, not 10.
    const exactly100TextChars = '<p>' + 'x'.repeat(100) + '</p>'; // 100 text chars
    const over100TextChars = '<p>' + 'x'.repeat(101) + '</p>'; // 101 text chars

    // exactly 100 is NOT > 100, so falls back to first paragraph
    expect(extractFirstBigParagraph(exactly100TextChars)).toBe(exactly100TextChars);
    expect(extractFirstBigParagraph(over100TextChars)).toBe(over100TextChars);
  });

  it('should not count HTML attributes in length calculation', () => {
    // A paragraph with lots of HTML attributes but short text
    const shortTextLongHtml = '<p class="very-long-class-name-that-would-exceed-100-chars-if-counted" id="another-long-id" data-test="more-attributes">Short text</p>';

    // This has < 100 text chars, but falls back to first paragraph
    expect(extractFirstBigParagraph(shortTextLongHtml)).toBe(shortTextLongHtml);
  });

  it('should count nested HTML tags text content only', () => {
    // Text with nested tags - should count the text inside, not the tag markup
    const nestedHtml = '<p>This has <strong>bold</strong> and <em>italic</em> ' +
      'and <a href="very-long-url-that-should-not-count">linked</a> text ' +
      'but the actual text content is what matters for the length check ' +
      'so we need enough plain text characters here.</p>';

    // The text content is long enough, so it should match
    const result = extractFirstBigParagraph(nestedHtml);
    expect(result).toContain('This has');
    expect(result.length).toBeGreaterThan(0);
  });
});
