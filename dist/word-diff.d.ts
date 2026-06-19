/**
 * Word-level diff utility for Pattern 5 (selective adoption from expressive-code).
 *
 * Computes a per-word diff between two lines of code using a simple LCS-based
 * algorithm. Used to highlight the specific words that changed within `+`/`-`
 * diff lines, so readers can see exactly what was added/removed rather than
 * just which lines changed.
 *
 * Algorithm: split each line into tokens (words + whitespace + punctuation),
 * compute the LCS (Longest Common Subsequence) between the two token arrays,
 * then walk both arrays emitting add/remove/equal markers.
 *
 * No external dependencies — this is ~80 lines of self-contained code.
 */
/** A diff token: the text content + whether it was added, removed, or unchanged. */
export interface DiffToken {
    text: string;
    type: 'add' | 'del' | 'equal';
}
/**
 * Compute a word-level diff between two strings.
 * Returns an array of DiffToken entries; concatenating all `.text` values
 * reconstructs the union of both inputs. The `.type` field indicates whether
 * each token was added, removed, or unchanged relative to the other string.
 *
 * @param oldStr The "before" line (typically the `-` line, without the prefix)
 * @param newStr The "after" line (typically the `+` line, without the prefix)
 * @returns Array of diff tokens
 *
 * @example
 *   wordDiff('const x = 1', 'const y = 2')
 *   // → [
 *   //   { text: 'const ', type: 'equal' },
 *   //   { text: 'x', type: 'del' },
 *   //   { text: 'y', type: 'add' },
 *   //   { text: ' = ', type: 'equal' },
 *   //   { text: '1', type: 'del' },
 *   //   { text: '2', type: 'add' },
 *   // ]
 */
export declare function wordDiff(oldStr: string, newStr: string): DiffToken[];
/**
 * Check if a diff result has any changes (i.e., at least one add or del token).
 * Used to skip wrapping when the lines are identical.
 */
export declare function hasChanges(tokens: DiffToken[]): boolean;
//# sourceMappingURL=word-diff.d.ts.map