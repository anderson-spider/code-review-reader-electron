// -----------------------------------------------------------------------------
// Code Review Types
// -----------------------------------------------------------------------------

import type { Severity, AnalysisSource } from './severity';

export interface ReviewComment {
  id: string;
  filePath: string;
  lineNumber: number | null;
  severity: Severity;
  comment: string;
  codeSnippet?: string;
  /** Source of analysis (which specialist found this issue) */
  analysisSource?: AnalysisSource;
}

export interface CodeReview {
  summary: string;
  comments: ReviewComment[];
  overallAssessment: string;
}

// Options for parallel code review analysis
export interface ParallelAnalysisOptions {
  /** Enable parallel analysis with specialist agents */
  enabled: boolean;
  /** Timeout per specialist in milliseconds (default: 120000 = 2 minutes) */
  timeoutPerSpecialist?: number;
  /** Which specialists to use (default: all) */
  specialists?: AnalysisSource[];
}

// -----------------------------------------------------------------------------
// Comment Refinement Types
// -----------------------------------------------------------------------------

/** State for tracking comment refinement UI */
export interface RefinementState {
  /** ID of the comment being refined (null if none) */
  commentId: string | null;
  /** Whether refinement is in progress */
  isLoading: boolean;
  /** Error message if refinement failed */
  error: string | null;
}

/** Request to refine a comment */
export interface RefineCommentRequest {
  /** The original comment to refine */
  originalComment: ReviewComment;
  /** User's refinement instructions */
  instructions: string;
}

/** Result of comment refinement */
export interface RefineCommentResult {
  /** The refined comment text */
  refinedComment: string;
  /** The refined code snippet (if applicable) */
  refinedCodeSnippet?: string;
}

// -----------------------------------------------------------------------------
// JSON Export Types (RN-APR-002)
// -----------------------------------------------------------------------------

export interface ReviewExportData {
  mr: {
    number: number;
    project: string;
    url: string;
    author: string;
    title: string;
  };
  summary: {
    files_analyzed: number;
    files_ignored: number;
    critical: number;
    warning: number;
    suggestion: number;
    approvable: boolean;
  };
  issues: Array<{
    id: string;
    severity: 'critical' | 'warning' | 'suggestion' | 'info';
    file: string;
    line: number | null;
    message: string;
    codeSnippet?: string;
  }>;
  generatedAt: string;
}
