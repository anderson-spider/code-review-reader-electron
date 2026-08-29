import { describe, it, expect } from 'vitest';
import { findOldLineNumber } from '../diff-utils';

const sampleDiff = `diff --git a/src/index.ts b/src/index.ts
--- a/src/index.ts
+++ b/src/index.ts
@@ -10,7 +10,9 @@ import { foo } from './foo';
 const a = 1;
 const b = 2;
 const c = 3;
-const d = 4;
+const d = 40;
+const e = 50;
+const f = 60;
 const g = 7;
 const h = 8;
`;

describe('findOldLineNumber', () => {
  // V9: parse hunk headers correctly
  it('should parse hunk header and map context lines', () => {
    const result = findOldLineNumber(sampleDiff, 10);
    expect(result).toBe(10);
  });

  it('should map unchanged line after hunk header', () => {
    const result = findOldLineNumber(sampleDiff, 11);
    expect(result).toBe(11);
  });

  it('should map context line before change', () => {
    const result = findOldLineNumber(sampleDiff, 12);
    expect(result).toBe(12);
  });

  // V4: added line returns null
  it('should return null for added line (no old equivalent)', () => {
    const result = findOldLineNumber(sampleDiff, 13);
    expect(result).toBeNull();
  });

  it('should return null for second added line', () => {
    const result = findOldLineNumber(sampleDiff, 14);
    expect(result).toBeNull();
  });

  it('should return null for third added line', () => {
    const result = findOldLineNumber(sampleDiff, 15);
    expect(result).toBeNull();
  });

  // V9: context line after additions maps correctly
  it('should map context line after additions to correct old line', () => {
    const result = findOldLineNumber(sampleDiff, 16);
    expect(result).toBe(14);
  });

  it('should map second context line after additions', () => {
    const result = findOldLineNumber(sampleDiff, 17);
    expect(result).toBe(15);
  });

  // Edge: line not in diff returns null
  it('should return null for line beyond diff range', () => {
    const result = findOldLineNumber(sampleDiff, 999);
    expect(result).toBeNull();
  });

  // V9: multiple hunks
  it('should handle multiple hunks', () => {
    const multiHunkDiff = `@@ -5,3 +5,4 @@
 line5
 line6
+added
 line7
@@ -20,3 +21,3 @@
 line20
-removed
+replaced
 line22
`;
    // line 8 (after added) in new = line 7 in old
    expect(findOldLineNumber(multiHunkDiff, 8)).toBe(7);
    // line 22 is replaced (added line) → null
    expect(findOldLineNumber(multiHunkDiff, 22)).toBeNull();
    // line 23 is context after replacement
    expect(findOldLineNumber(multiHunkDiff, 23)).toBe(22);
  });

  // V9: pure deletion diff
  it('should handle pure deletion', () => {
    const deletionDiff = `@@ -10,4 +10,3 @@
 context
-deleted
 after
 more
`;
    // line 10 context → old 10
    expect(findOldLineNumber(deletionDiff, 10)).toBe(10);
    // line 11 (after) → old 12 (skipped deleted line)
    expect(findOldLineNumber(deletionDiff, 11)).toBe(12);
  });

  it('should return null for empty diff', () => {
    expect(findOldLineNumber('', 1)).toBeNull();
  });
});
