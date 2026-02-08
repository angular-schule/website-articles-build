import { describe, it, expect } from 'vitest';
import { stripHtmlTags, decodeHtmlEntities, escapeHtml } from './html.utils';

describe('stripHtmlTags', () => {
  it('should return empty string for empty input', () => {
    expect(stripHtmlTags('')).toBe('');
  });

  it('should return text unchanged when no HTML tags present', () => {
    expect(stripHtmlTags('Hello World')).toBe('Hello World');
  });

  it('should strip simple HTML tags', () => {
    expect(stripHtmlTags('<p>Hello</p>')).toBe('Hello');
  });

  it('should strip tags with attributes', () => {
    expect(stripHtmlTags('<a href="https://example.com">Link</a>')).toBe('Link');
  });

  it('should strip multiple tags', () => {
    expect(stripHtmlTags('<div><p>Hello</p><span>World</span></div>')).toBe('HelloWorld');
  });

  it('should strip self-closing tags', () => {
    expect(stripHtmlTags('Before<br/>After')).toBe('BeforeAfter');
    expect(stripHtmlTags('Before<br>After')).toBe('BeforeAfter');
  });

  it('should strip img tags', () => {
    expect(stripHtmlTags('<img src="test.png" alt="Test">')).toBe('');
  });

  it('should preserve text between tags', () => {
    expect(stripHtmlTags('<strong>Bold</strong> and <em>italic</em>')).toBe('Bold and italic');
  });

  it('should handle nested tags', () => {
    expect(stripHtmlTags('<div><p><strong>Deep</strong></p></div>')).toBe('Deep');
  });

  it('should handle tags with multiple attributes', () => {
    expect(stripHtmlTags('<input type="text" name="field" value="test">')).toBe('');
  });

  it('should preserve whitespace between tags', () => {
    expect(stripHtmlTags('<p>Hello</p> <p>World</p>')).toBe('Hello World');
  });

  it('should handle HTML comments by stripping them', () => {
    expect(stripHtmlTags('Before<!-- comment -->After')).toBe('BeforeAfter');
  });
});

describe('decodeHtmlEntities', () => {
  it('should return empty string for empty input', () => {
    expect(decodeHtmlEntities('')).toBe('');
  });

  it('should return text unchanged when no entities present', () => {
    expect(decodeHtmlEntities('Hello World')).toBe('Hello World');
  });

  it('should decode &amp; to &', () => {
    expect(decodeHtmlEntities('Tom &amp; Jerry')).toBe('Tom & Jerry');
  });

  it('should decode &lt; to <', () => {
    expect(decodeHtmlEntities('a &lt; b')).toBe('a < b');
  });

  it('should decode &gt; to >', () => {
    expect(decodeHtmlEntities('a &gt; b')).toBe('a > b');
  });

  it('should decode &quot; to "', () => {
    expect(decodeHtmlEntities('He said &quot;hello&quot;')).toBe('He said "hello"');
  });

  it('should decode &#39; to single quote', () => {
    expect(decodeHtmlEntities("It&#39;s fine")).toBe("It's fine");
  });

  it('should decode &#x27; to single quote', () => {
    expect(decodeHtmlEntities("It&#x27;s fine")).toBe("It's fine");
  });

  it('should decode &#x2F; to /', () => {
    expect(decodeHtmlEntities('path&#x2F;to&#x2F;file')).toBe('path/to/file');
  });

  it('should decode multiple entities in one string', () => {
    expect(decodeHtmlEntities('&lt;div class=&quot;test&quot;&gt;')).toBe('<div class="test">');
  });

  it('should handle entities at start and end', () => {
    expect(decodeHtmlEntities('&amp;start and end&amp;')).toBe('&start and end&');
  });

  it('should handle multiple consecutive same entities', () => {
    expect(decodeHtmlEntities('&amp;&amp;&amp;')).toBe('&&&');
  });

  it('should decode Array<T> pattern (common in code)', () => {
    expect(decodeHtmlEntities('Array&lt;string&gt;')).toBe('Array<string>');
  });

  it('should decode generic TypeScript code pattern', () => {
    expect(decodeHtmlEntities('Map&lt;string, number&gt;')).toBe('Map<string, number>');
  });
});

describe('escapeHtml', () => {
  it('should return empty string for empty input', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('should return text unchanged when no special chars present', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });

  it('should escape & to &amp;', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('should escape " to &quot;', () => {
    expect(escapeHtml('He said "hello"')).toBe('He said &quot;hello&quot;');
  });

  it('should escape < to &lt;', () => {
    expect(escapeHtml('a < b')).toBe('a &lt; b');
  });

  it('should escape > to &gt;', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b');
  });

  it("should escape ' to &#39;", () => {
    expect(escapeHtml("It's fine")).toBe("It&#39;s fine");
  });

  it('should escape all special characters in one string', () => {
    expect(escapeHtml('<div class="test">&</div>')).toBe('&lt;div class=&quot;test&quot;&gt;&amp;&lt;/div&gt;');
  });

  it('should handle multiple ampersands correctly', () => {
    // Ampersands must be escaped first to avoid double-escaping
    expect(escapeHtml('a & b & c')).toBe('a &amp; b &amp; c');
  });

  it('should escape HTML tag patterns', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('should escape TypeScript generic syntax', () => {
    expect(escapeHtml('Array<string>')).toBe('Array&lt;string&gt;');
  });

  it('should be reversible with decodeHtmlEntities', () => {
    const original = 'Tom & Jerry <3 "quotes"';
    const escaped = escapeHtml(original);
    const decoded = decodeHtmlEntities(escaped);
    expect(decoded).toBe(original);
  });
});

describe('escapeHtml and decodeHtmlEntities roundtrip', () => {
  const testCases = [
    'Simple text',
    'Tom & Jerry',
    'a < b > c',
    'He said "hello"',
    "It's fine",
    '<div class="test">Content & more</div>',
    'Array<Map<string, number>>',
    '&amp; already encoded',
  ];

  testCases.forEach((input) => {
    it(`should roundtrip: ${input.substring(0, 30)}...`, () => {
      const escaped = escapeHtml(input);
      const decoded = decodeHtmlEntities(escaped);
      expect(decoded).toBe(input);
    });
  });
});
