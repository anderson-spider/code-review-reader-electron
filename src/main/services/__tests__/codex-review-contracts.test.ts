import { describe, expect, it, vi } from 'vitest';
import {
  CodexOutputError,
  filterReviewChanges,
  numberDiffLines,
  parseRefinementOutput,
  parseReviewOutput,
  REVIEW_OUTPUT_JSON_SCHEMA,
} from '../codex-review-contracts';
import {
  mockBinaryFile,
  mockDeletedFile,
  mockModifiedFile,
  mockTestFile,
} from '../../../test/fixtures';

vi.mock('uuid', () => ({ v4: vi.fn(() => 'codex-comment-id') }));

describe('Codex review contracts', () => {
  it('filters unsupported changes and includes tests only when requested', () => {
    // Given
    const changes = [mockModifiedFile, mockTestFile, mockBinaryFile];

    // When
    const withoutTests = filterReviewChanges(changes, false);
    const withTests = filterReviewChanges(changes, true);

    // Then
    expect(withoutTests.map((change) => change.new_path)).toEqual(['src/example.ts']);
    expect(withTests.map((change) => change.new_path)).toEqual([
      'src/example.ts',
      'src/example.test.ts',
    ]);
  });

  it('keeps deleted source files reviewable from their diff', () => {
    expect(filterReviewChanges([mockDeletedFile], false)).toEqual([mockDeletedFile]);
  });

  it('maps diff lines to exact new-file line numbers', () => {
    // Given
    const diff = '@@ -9,3 +20,4 @@\n unchanged\n-old\n+new\n tail';

    // When
    const numbered = numberDiffLines(diff);

    // Then
    expect(numbered).toBe('@@ -9,3 +20,4 @@\n20:  unchanged\n[DEL]old\n21: new\n22:  tail');
  });

  it('marks lines from deletion-only hunks without inventing new-file numbers', () => {
    expect(numberDiffLines('@@ -1,2 +0,0 @@\n-old\n-code'))
      .toBe('@@ -1,2 +0,0 @@\n[DEL]old\n[DEL]code');
  });

  it('parses a structured review', () => {
    // Given
    const output = JSON.stringify({
      summary: 'Resumo',
      comments: [{
        filePath: 'src/example.ts',
        lineNumber: 21,
        severity: 'warning',
        comment: 'Comentário',
        codeSnippet: null,
      }],
      overallAssessment: 'Avaliação',
    });

    // When
    const review = parseReviewOutput(output, 'general');

    // Then
    expect(review).toEqual({
      summary: 'Resumo',
      comments: [{
        id: 'codex-comment-id',
        filePath: 'src/example.ts',
        lineNumber: 21,
        severity: 'warning',
        comment: 'Comentário',
        analysisSource: 'general',
      }],
      overallAssessment: 'Avaliação',
    });
  });

  it.each([
    ['malformed JSON', '{invalid'],
    ['prose-wrapped JSON', 'Result: {"summary":"x","comments":[],"overallAssessment":"y"}'],
    ['missing summary', '{"comments":[],"overallAssessment":"y"}'],
    ['invalid severity', '{"summary":"x","comments":[{"filePath":"a.ts","lineNumber":1,"severity":"major","comment":"x","codeSnippet":null}],"overallAssessment":"y"}'],
  ])('rejects invalid structured output: %s', (_caseName, output) => {
    // Given / When / Then
    expect(() => parseReviewOutput(output, 'general')).toThrow(CodexOutputError);
  });

  it('parses a structured refinement with a nullable snippet', () => {
    // Given
    const output = '{"refinedComment":"Melhorado","refinedCodeSnippet":null}';

    // When
    const refinement = parseRefinementOutput(output);

    // Then
    expect(refinement).toEqual({ refinedComment: 'Melhorado' });
  });

  it('publishes a machine-consumable review output schema', () => {
    // Given / When
    const schema = REVIEW_OUTPUT_JSON_SCHEMA;

    // Then
    expect(schema).toMatchObject({
      type: 'object',
      required: ['summary', 'comments', 'overallAssessment'],
    });
  });
});
