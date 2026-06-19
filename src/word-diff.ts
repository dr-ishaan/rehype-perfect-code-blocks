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
 * Split a code line into tokens for diffing. Each token is either:
 *   - a run of whitespace
 *   - a run of word characters (alphanumeric + underscore)
 *   - a single punctuation character
 *
 * This produces reasonable word-level diffs for most code without being
 * overly granular (character-level) or too coarse (line-level).
 */
function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    // Whitespace run
    if (/\s/.test(ch)) {
      let j = i + 1;
      while (j < line.length && /\s/.test(line[j])) j++;
      tokens.push(line.slice(i, j));
      i = j;
      continue;
    }
    // Word character run (alphanumeric + underscore + dot for method chains)
    if (/[\w.]/.test(ch)) {
      let j = i + 1;
      while (j < line.length && /[\w.]/.test(line[j])) j++;
      tokens.push(line.slice(i, j));
      i = j;
      continue;
    }
    // Single punctuation character
    tokens.push(ch);
    i++;
  }
  return tokens;
}

/**
 * Compute the LCS table between two token arrays.
 * Returns a 2D array where table[i][j] = length of LCS of a[0..i) and b[0..j).
 */
function lcsTable(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const table: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        table[i][j] = table[i - 1][j - 1] + 1;
      } else {
        table[i][j] = Math.max(table[i - 1][j], table[i][j - 1]);
      }
    }
  }
  return table;
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
export function wordDiff(oldStr: string, newStr: string): DiffToken[] {
  const a = tokenize(oldStr);
  const b = tokenize(newStr);
  const table = lcsTable(a, b);

  // Backtrack through the LCS table to emit the diff.
  const result: DiffToken[] = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      result.push({ text: a[i - 1], type: 'equal' });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || table[i][j - 1] >= table[i - 1][j])) {
      result.push({ text: b[j - 1], type: 'add' });
      j--;
    } else {
      result.push({ text: a[i - 1], type: 'del' });
      i--;
    }
  }
  result.reverse();

  // Merge consecutive tokens of the same type to reduce output size.
  const merged: DiffToken[] = [];
  for (const token of result) {
    const last = merged[merged.length - 1];
    if (last && last.type === token.type) {
      last.text += token.text;
    } else {
      merged.push({ ...token });
    }
  }
  return merged;
}

/**
 * Check if a diff result has any changes (i.e., at least one add or del token).
 * Used to skip wrapping when the lines are identical.
 */
export function hasChanges(tokens: DiffToken[]): boolean {
  return tokens.some((t) => t.type !== 'equal');
}
