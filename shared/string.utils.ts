/**
 * String utility functions.
 */

/**
 * Calculate the Levenshtein distance between two strings.
 *
 * The Levenshtein distance is the minimum number of single-character edits
 * (insertions, deletions, or substitutions) required to transform one string
 * into another.
 *
 * @example
 * ```typescript
 * levenshtein('kitten', 'sitting');  // 3 (k→s, e→i, +g)
 * levenshtein('intro', 'intor');     // 2 (transposition = 2 edits)
 * levenshtein('hello', 'hello');     // 0 (identical)
 * levenshtein('', 'abc');            // 3 (3 insertions)
 * ```
 *
 * Time complexity: O(m × n) where m = a.length, n = b.length
 * Space complexity: O(min(m, n)) using single-row optimization
 *
 * @param a - First string
 * @param b - Second string
 * @returns The edit distance (0 = identical, higher = more different)
 */
export function levenshtein(a: string, b: string): number {
  // Ensure a is the shorter string for space optimization
  if (a.length > b.length) {
    [a, b] = [b, a];
  }

  const m = a.length;
  const n = b.length;

  // Edge cases
  if (m === 0) return n;
  if (n === 0) return m;

  // Single-row DP: dp[i] = distance for a[0..i-1] vs b[0..j-1]
  // Initialize with distances for empty b (all insertions)
  const dp: number[] = Array.from({ length: m + 1 }, (_, i) => i);

  for (let j = 1; j <= n; j++) {
    let prev = dp[0]; // dp[i-1][j-1] from previous iteration
    dp[0] = j; // Distance for empty a vs b[0..j-1]

    for (let i = 1; i <= m; i++) {
      const temp = dp[i];

      if (a[i - 1] === b[j - 1]) {
        // Characters match: no edit needed
        dp[i] = prev;
      } else {
        // Minimum of: substitute, delete, insert
        dp[i] = 1 + Math.min(
          prev,     // substitute a[i-1] with b[j-1]
          dp[i],    // delete a[i-1]
          dp[i - 1] // insert b[j-1]
        );
      }

      prev = temp;
    }
  }

  return dp[m];
}

/**
 * Find strings similar to a query using Levenshtein distance.
 *
 * Returns candidates sorted by similarity (most similar first).
 * Only includes candidates within the maximum distance threshold.
 *
 * @example
 * ```typescript
 * const headings = ['introduction', 'getting-started', 'conclusion'];
 * findSimilar('intrduction', headings, 3);
 * // Returns: ['introduction'] (distance 1)
 *
 * findSimilar('start', headings, 10);
 * // Returns: ['getting-started'] (distance 9, but "start" is substring)
 * ```
 *
 * @param query - The string to find matches for
 * @param candidates - Array of strings to search in
 * @param maxDistance - Maximum edit distance to consider (default: 3)
 * @returns Array of similar strings, sorted by distance (ascending)
 */
export function findSimilar(
  query: string,
  candidates: string[],
  maxDistance: number = 3
): string[] {
  const matches: Array<{ candidate: string; distance: number }> = [];

  for (const candidate of candidates) {
    // Skip exact matches (not useful as suggestions)
    if (candidate === query) continue;

    const distance = levenshtein(query, candidate);

    if (distance <= maxDistance) {
      matches.push({ candidate, distance });
    }
  }

  // Sort by distance (most similar first)
  matches.sort((a, b) => a.distance - b.distance);

  return matches.map(m => m.candidate);
}
