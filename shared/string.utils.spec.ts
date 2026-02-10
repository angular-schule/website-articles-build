import { describe, it, expect } from 'vitest';
import { levenshtein, findSimilar } from './string.utils';

describe('levenshtein', () => {
  describe('identical strings', () => {
    it('should return 0 for empty strings', () => {
      expect(levenshtein('', '')).toBe(0);
    });

    it('should return 0 for identical strings', () => {
      expect(levenshtein('hello', 'hello')).toBe(0);
      expect(levenshtein('introduction', 'introduction')).toBe(0);
    });
  });

  describe('empty string cases', () => {
    it('should return length of other string when one is empty', () => {
      expect(levenshtein('', 'abc')).toBe(3);
      expect(levenshtein('hello', '')).toBe(5);
    });
  });

  describe('single character edits', () => {
    it('should detect single insertion', () => {
      expect(levenshtein('ac', 'abc')).toBe(1);
      expect(levenshtein('hell', 'hello')).toBe(1);
    });

    it('should detect single deletion', () => {
      expect(levenshtein('abc', 'ac')).toBe(1);
      expect(levenshtein('hello', 'helo')).toBe(1);
    });

    it('should detect single substitution', () => {
      expect(levenshtein('abc', 'adc')).toBe(1);
      expect(levenshtein('cat', 'bat')).toBe(1);
    });
  });

  describe('multiple edits', () => {
    it('should count transposition as 2 edits', () => {
      // Levenshtein counts transposition as 2 edits (delete + insert)
      expect(levenshtein('ab', 'ba')).toBe(2);
      expect(levenshtein('intro', 'intor')).toBe(2);
    });

    it('should handle classic example: kitten → sitting', () => {
      // kitten → sitten (substitute k→s)
      // sitten → sittin (substitute e→i)
      // sittin → sitting (insert g)
      expect(levenshtein('kitten', 'sitting')).toBe(3);
    });

    it('should handle complete replacement', () => {
      expect(levenshtein('abc', 'xyz')).toBe(3);
    });
  });

  describe('real-world anchor examples', () => {
    it('should detect typo: fazti → fazit', () => {
      expect(levenshtein('fazti', 'fazit')).toBe(2);
    });

    it('should detect missing letter: instalation → installation', () => {
      expect(levenshtein('instalation', 'installation')).toBe(1);
    });

    it('should detect extra letter: intrroduction → introduction', () => {
      expect(levenshtein('intrroduction', 'introduction')).toBe(1);
    });

    it('should detect wrong letter: getting-startet → getting-started', () => {
      expect(levenshtein('getting-startet', 'getting-started')).toBe(1);
    });

    it('should handle German umlauts', () => {
      expect(levenshtein('über-uns', 'uber-uns')).toBe(1);
      expect(levenshtein('übersicht', 'übersicht')).toBe(0);
    });
  });

  describe('symmetry', () => {
    it('should be symmetric: d(a,b) = d(b,a)', () => {
      expect(levenshtein('abc', 'def')).toBe(levenshtein('def', 'abc'));
      expect(levenshtein('hello', 'hallo')).toBe(levenshtein('hallo', 'hello'));
      expect(levenshtein('short', 'muchlonger')).toBe(levenshtein('muchlonger', 'short'));
    });
  });

  describe('triangle inequality', () => {
    it('should satisfy: d(a,c) ≤ d(a,b) + d(b,c)', () => {
      const a = 'abc';
      const b = 'abd';
      const c = 'acd';
      const dAB = levenshtein(a, b);
      const dBC = levenshtein(b, c);
      const dAC = levenshtein(a, c);
      expect(dAC).toBeLessThanOrEqual(dAB + dBC);
    });
  });
});

describe('findSimilar', () => {
  const candidates = [
    'introduction',
    'getting-started',
    'installation',
    'configuration',
    'conclusion',
    'fazit',
    'über-uns'
  ];

  describe('typo detection', () => {
    it('should find similar for typo: intrduction → introduction', () => {
      const result = findSimilar('intrduction', candidates);
      expect(result).toContain('introduction');
    });

    it('should find similar for typo: instalation → installation', () => {
      const result = findSimilar('instalation', candidates);
      expect(result).toContain('installation');
    });

    it('should find similar for typo: fazti → fazit', () => {
      const result = findSimilar('fazti', candidates);
      expect(result).toContain('fazit');
    });
  });

  describe('sorting by distance', () => {
    it('should return results sorted by distance (most similar first)', () => {
      // 'intro' has distance 7 to 'introduction' and higher to others
      const testCandidates = ['abc', 'ab', 'abcd', 'abcde'];
      const result = findSimilar('abc', testCandidates, 5);

      // ab=1, abcd=1, abcde=2 (abc is exact match, excluded)
      expect(result[0]).toBe('ab');
      // ab and abcd both have distance 1, order may vary
      expect(result).toContain('abcd');
    });
  });

  describe('maxDistance threshold', () => {
    it('should respect maxDistance parameter', () => {
      const result = findSimilar('xyz', candidates, 2);
      // All candidates are far from 'xyz', none within distance 2
      expect(result).toHaveLength(0);
    });

    it('should include matches at exactly maxDistance', () => {
      // 'fazit' → 'fazti' has distance 2
      const result = findSimilar('fazti', ['fazit'], 2);
      expect(result).toContain('fazit');
    });

    it('should exclude matches beyond maxDistance', () => {
      const result = findSimilar('fazti', ['fazit'], 1);
      expect(result).not.toContain('fazit');
    });
  });

  describe('exact matches', () => {
    it('should not include exact matches (not useful as suggestions)', () => {
      const result = findSimilar('fazit', candidates);
      expect(result).not.toContain('fazit');
    });
  });

  describe('empty cases', () => {
    it('should return empty array for empty candidates', () => {
      const result = findSimilar('test', []);
      expect(result).toHaveLength(0);
    });

    it('should return empty array when nothing is similar', () => {
      const result = findSimilar('xyzabc123', candidates, 3);
      expect(result).toHaveLength(0);
    });
  });

  describe('default maxDistance', () => {
    it('should use default maxDistance of 3', () => {
      // 'intro' to 'fazit' is distance 5, should not match with default
      const result = findSimilar('intro', ['fazit']);
      expect(result).toHaveLength(0);

      // 'fazi' to 'fazit' is distance 1, should match
      const result2 = findSimilar('fazi', ['fazit']);
      expect(result2).toContain('fazit');
    });
  });
});
