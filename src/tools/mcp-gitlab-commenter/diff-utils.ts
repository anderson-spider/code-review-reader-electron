/**
 * Map a new-side line number to its old-side equivalent using unified diff.
 * Returns null if the line was added (no old equivalent).
 */
export function findOldLineNumber(diff: string, newLine: number): number | null {
  let currentOldLine = 0;
  let currentNewLine = 0;

  const lines = diff.split('\n');

  for (const line of lines) {
    const hunkMatch = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      currentOldLine = parseInt(hunkMatch[1], 10);
      currentNewLine = parseInt(hunkMatch[2], 10);
      continue;
    }

    if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('diff --git')) {
      continue;
    }

    if (line.startsWith('+')) {
      if (currentNewLine === newLine) {
        return null;
      }
      currentNewLine++;
    } else if (line.startsWith('-')) {
      currentOldLine++;
    } else if (line.length > 0) {
      if (currentNewLine === newLine) {
        return currentOldLine;
      }
      currentOldLine++;
      currentNewLine++;
    }
  }

  return null;
}
