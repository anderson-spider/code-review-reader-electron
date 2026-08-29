import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { CommentCard } from './CommentCard';
import { ApprovabilityBadge } from './ApprovabilityBadge';
import { MRInfoHeader } from './MRInfoHeader';
import { ReviewSummaryModal } from './ReviewSummaryModal';
import type { CodeReview, PostResult, GitLabComment, ReviewComment, ReviewExportData, FileChange, MergeRequest, ParsedMRUrl, RefinementState, Severity } from '../../shared/types';
import { INITIAL_REFINEMENT_STATE } from '../../shared/types';

interface ReviewDisplayViewProps {
  review: CodeReview;
  onReviewUpdate?: (updatedReview: CodeReview) => void;
}

/**
 * Format comment for GitLab according to APP_RULES.md RN-COM-003
 * @param comment - The review comment to format
 * @returns Formatted markdown string
 */
function formatCommentForGitLab(comment: ReviewComment): string {
  let formatted = comment.comment;

  // Add code snippet block if available (for context)
  if (comment.codeSnippet) {
    formatted += `\n\n\`\`\`\n${comment.codeSnippet}\n\`\`\``;
  }

  return formatted;
}

/**
 * Build GitLab line URL according to APP_RULES.md RN-OUT-003
 * Format: https://{gitlab_url}/{project}/-/blob/{source_branch}/{file}#L{line}
 */
function buildGitLabLineUrl(
  gitlabBaseURL: string,
  projectPath: string,
  sourceBranch: string,
  filePath: string,
  lineNumber: number
): string {
  // Convert API URL (https://gitlab.com/api/v4) to base URL (https://gitlab.com)
  const baseUrl = gitlabBaseURL.replace(/\/api\/v4\/?$/, '');

  // Encode the branch and file path for URL safety
  const encodedBranch = encodeURIComponent(sourceBranch);
  const encodedFile = filePath.split('/').map(encodeURIComponent).join('/');

  return `${baseUrl}/${projectPath}/-/blob/${encodedBranch}/${encodedFile}#L${lineNumber}`;
}

/**
 * Build JSON export data according to APP_RULES.md RN-APR-002
 * @param review - The code review data
 * @param currentMR - The merge request data
 * @param parsedUrl - The parsed MR URL
 * @param currentChanges - The file changes
 * @returns ReviewExportData object
 */
function buildExportData(
  review: CodeReview,
  currentMR: MergeRequest,
  parsedUrl: ParsedMRUrl,
  currentChanges: FileChange[]
): ReviewExportData {
  // Count files by category
  const filesAnalyzed = currentChanges.length;
  // For now, assume files_ignored is 0 (can be extended to track ignored files)
  const filesIgnored = 0;

  // Count issues by severity
  const severityCounts = review.comments.reduce(
    (acc, comment) => {
      acc[comment.severity] = (acc[comment.severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Calculate approvability (RN-APV-001)
  const critical = severityCounts.critical || 0;
  const warning = severityCounts.warning || 0;
  const approvable = critical === 0 && warning === 0;

  return {
    mr: {
      number: parsedUrl.mrIID,
      project: parsedUrl.projectPath,
      url: currentMR.web_url,
      author: currentMR.author.username,
      title: currentMR.title,
    },
    summary: {
      files_analyzed: filesAnalyzed,
      files_ignored: filesIgnored,
      critical,
      warning: warning,
      suggestion: severityCounts.suggestion || 0,
      approvable,
    },
    issues: review.comments.map((comment) => ({
      id: comment.id,
      severity: comment.severity,
      file: comment.filePath,
      line: comment.lineNumber,
      message: comment.comment,
      codeSnippet: comment.codeSnippet,
    })),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Download JSON data as a file using browser's download API
 * @param data - The JSON data to download
 * @param filename - The filename for the download
 */
function downloadJSON(data: ReviewExportData, filename: string): void {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ReviewDisplayView({ review, onReviewUpdate }: ReviewDisplayViewProps) {
  const { currentMR, parsedUrl, currentChanges, gitlabBaseURL, updateCommentSeverity } = useAppStore();
  const [isPosting, setIsPosting] = useState(false);
  const [postResult, setPostResult] = useState<PostResult | null>(null);
  const [showPostDialog, setShowPostDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  // Track selected comments (RN-COM-001: allow user to select which comments to post)
  const [selectedComments, setSelectedComments] = useState<Set<string>>(new Set());

  // Refinement state
  const [refinementState, setRefinementState] = useState<RefinementState>(INITIAL_REFINEMENT_STATE);

  // Initialize all non-info comments as selected by default
  useEffect(() => {
    const postableComments = review.comments
      .filter((c) => c.severity !== 'info')
      .map((c) => c.id);
    setSelectedComments(new Set(postableComments));
  }, [review.comments]);

  // Toggle comment selection
  const toggleComment = (id: string) => {
    setSelectedComments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select/deselect all postable comments
  const selectAllComments = () => {
    const postableComments = review.comments
      .filter((c) => c.severity !== 'info')
      .map((c) => c.id);
    setSelectedComments(new Set(postableComments));
  };

  const deselectAllComments = () => {
    setSelectedComments(new Set());
  };

  // Count of selected postable comments
  const selectedCount = review.comments.filter(
    (c) => c.severity !== 'info' && selectedComments.has(c.id)
  ).length;

  const totalPostableCount = review.comments.filter((c) => c.severity !== 'info').length;

  // Group comments by file
  const groupedComments = useMemo(() => {
    const grouped = new Map<string, typeof review.comments>();

    for (const comment of review.comments) {
      const existing = grouped.get(comment.filePath) || [];
      existing.push(comment);
      grouped.set(comment.filePath, existing);
    }

    return Array.from(grouped.entries())
      .map(([file, comments]) => ({ file, comments }))
      .sort((a, b) => a.file.localeCompare(b.file));
  }, [review]);

  // Post review to GitLab
  const handlePostReview = async () => {
    if (!parsedUrl || !currentMR) {
      setPostResult({ success: false, message: 'MR information not available' });
      return;
    }

    setShowPostDialog(false);
    setIsPosting(true);

    try {
      // Create file changes lookup
      const fileChangesMap = new Map(currentChanges?.map((c) => [c.new_path, c]) || []);

      // Fetch existing comments to avoid duplicates
      const existingComments = await window.electronAPI.gitlab.fetchExistingComments(
        parsedUrl.projectPath,
        parsedUrl.mrIID
      );

      let successCount = 0;
      let failureCount = 0;
      let skippedCount = 0;

      // Post only selected comments (skip info and unselected)
      for (const comment of review.comments) {
        try {
          // Skip info comments and unselected comments
          if (comment.severity === 'info' || !selectedComments.has(comment.id)) {
            skippedCount++;
            continue;
          }

          // Check for duplicates
          const isDuplicate = existingComments.some(
            (existing: GitLabComment) =>
              existing.position?.new_path === comment.filePath &&
              existing.position?.new_line === comment.lineNumber &&
              existing.body.includes(comment.comment.substring(0, 50))
          );

          if (isDuplicate) {
            skippedCount++;
            continue;
          }

          // Format comment according to RN-COM-003
          const formattedComment = formatCommentForGitLab(comment);

          // Post comment
          if (comment.lineNumber) {
            const fileChange = fileChangesMap.get(comment.filePath);
            await window.electronAPI.gitlab.postLineComment(
              parsedUrl.projectPath,
              parsedUrl.mrIID,
              comment.filePath,
              comment.lineNumber,
              formattedComment,
              fileChange
            );
          } else {
            await window.electronAPI.gitlab.postComment(
              parsedUrl.projectPath,
              parsedUrl.mrIID,
              `**${comment.filePath}**\n\n${formattedComment}`
            );
          }

          successCount++;

          // Rate limit delay
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          console.error('Failed to post comment:', error);
          failureCount++;
        }
      }

      let message = `${successCount} comments posted`;
      if (skippedCount > 0) message += `, ${skippedCount} skipped`;
      if (failureCount > 0) message += `, ${failureCount} failed`;

      setPostResult({
        success: failureCount === 0,
        message,
        successCount,
        failureCount,
        skippedCount,
      });

      // Show summary modal after posting completes
      setShowSummaryModal(true);
    } catch (error) {
      setPostResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsPosting(false);
    }
  };

  // Delete user's comments
  const handleDeleteComments = async () => {
    if (!parsedUrl) {
      setPostResult({ success: false, message: 'MR information not available' });
      return;
    }

    setShowDeleteDialog(false);
    setIsPosting(true);

    try {
      const deletedCount = await window.electronAPI.gitlab.deleteMyComments(
        parsedUrl.projectPath,
        parsedUrl.mrIID
      );

      setPostResult({
        success: true,
        message: `${deletedCount} comment(s) deleted successfully`,
      });
    } catch (error) {
      setPostResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsPosting(false);
    }
  };

  // Approve MR (RN-APV-002/003)
  const handleApproveMR = async () => {
    if (!parsedUrl || !currentMR) {
      setPostResult({ success: false, message: 'MR information not available' });
      return;
    }

    setShowApproveDialog(false);
    setIsApproving(true);

    try {
      await window.electronAPI.gitlab.approveMR(parsedUrl.projectPath, parsedUrl.mrIID);

      setPostResult({
        success: true,
        message: `✅ MR !${parsedUrl.mrIID} aprovado com sucesso`,
      });
    } catch (error) {
      setPostResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to approve MR',
      });
    } finally {
      setIsApproving(false);
    }
  };

  // Export review as JSON (RN-APR-002)
  const handleExportJSON = () => {
    if (!currentMR || !parsedUrl || !currentChanges) {
      setPostResult({ success: false, message: 'MR information not available for export' });
      return;
    }

    try {
      const exportData = buildExportData(review, currentMR, parsedUrl, currentChanges);
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `review-MR${parsedUrl.mrIID}-${timestamp}.json`;
      downloadJSON(exportData, filename);

      setPostResult({
        success: true,
        message: 'Review exported successfully',
      });
    } catch (error) {
      setPostResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to export review',
      });
    }
  };

  // =========================================================================
  // Refinement Handlers (memoized to prevent unnecessary re-renders)
  // =========================================================================

  // Start refining a comment
  const handleStartRefine = useCallback((commentId: string) => {
    setRefinementState({
      commentId,
      isLoading: false,
      error: null,
    });
  }, []);

  // Cancel refinement
  const handleCancelRefine = useCallback(() => {
    setRefinementState(INITIAL_REFINEMENT_STATE);
  }, []);

  // Submit refinement
  const handleSubmitRefine = useCallback(async (instructions: string) => {
    if (!refinementState.commentId) return;

    const comment = review.comments.find((c) => c.id === refinementState.commentId);
    if (!comment) {
      setRefinementState(INITIAL_REFINEMENT_STATE);
      return;
    }

    setRefinementState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await window.electronAPI.review.refineComment(comment, instructions);

      // Update the comment in the review
      const updatedComments = review.comments.map((c) =>
        c.id === refinementState.commentId
          ? {
              ...c,
              comment: result.refinedComment,
              codeSnippet: result.refinedCodeSnippet ?? c.codeSnippet,
            }
          : c
      );

      const updatedReview: CodeReview = {
        ...review,
        comments: updatedComments,
      };

      // Notify parent about the update
      onReviewUpdate?.(updatedReview);

      // Show success toast
      setPostResult({
        success: true,
        message: 'Comment refined successfully',
      });

      // Reset refinement state
      setRefinementState(INITIAL_REFINEMENT_STATE);
    } catch (error) {
      console.error('Failed to refine comment:', error);
      setRefinementState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to refine comment',
      }));

      setPostResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to refine comment',
      });
    }
  }, [refinementState.commentId, review, onReviewUpdate]);

  // Handle severity change
  const handleSeverityChange = (id: string, severity: Severity) => {
    updateCommentSeverity(id, severity);
  };

  return (
    <div className="h-full overflow-auto">
      <div className="p-4 space-y-4">
        {/* MR Info Header */}
        {currentMR && <MRInfoHeader mr={currentMR} changes={currentChanges || []} />}

        {/* Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="font-semibold text-gray-900 dark:text-white">Summary</h3>
          </div>
          <p className="text-gray-700 dark:text-gray-300">{review.summary}</p>
        </div>

        {/* Comments by File */}
        {groupedComments.map(({ file, comments }) => (
          <div
            key={file}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <h3 className="font-semibold text-gray-900 dark:text-white font-mono text-sm truncate">
                {file}
              </h3>
            </div>
            <div className="space-y-2">
              {comments.map((comment) => {
                // Build GitLab line URL if we have all required data (RN-OUT-003)
                const lineUrl =
                  comment.lineNumber && currentMR && parsedUrl
                    ? buildGitLabLineUrl(
                        gitlabBaseURL,
                        parsedUrl.projectPath,
                        currentMR.source_branch,
                        comment.filePath,
                        comment.lineNumber
                      )
                    : undefined;

                const isRefining = refinementState.commentId === comment.id;

                return (
                  <CommentCard
                    key={comment.id}
                    comment={comment}
                    selected={comment.severity === 'info' ? undefined : selectedComments.has(comment.id)}
                    onToggle={comment.severity === 'info' ? undefined : toggleComment}
                    lineUrl={lineUrl}
                    onRefine={handleStartRefine}
                    isRefining={isRefining}
                    isRefineLoading={isRefining && refinementState.isLoading}
                    onRefineCancel={handleCancelRefine}
                    onRefineSubmit={handleSubmitRefine}
                    onSeverityChange={handleSeverityChange}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {/* Overall Assessment */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="font-semibold text-gray-900 dark:text-white">Overall Assessment</h3>
          </div>
          <p className="text-gray-700 dark:text-gray-300">{review.overallAssessment}</p>
        </div>

        {/* Approvability Verdict */}
        <ApprovabilityBadge
          comments={review.comments}
          onApprove={() => setShowApproveDialog(true)}
        />

        {/* Selection Controls */}
        {totalPostableCount > 0 && (
          <div className="flex items-center justify-between py-2 border-t border-gray-200 dark:border-gray-700">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {selectedCount} of {totalPostableCount} comments selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={selectAllComments}
                disabled={selectedCount === totalPostableCount}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 disabled:no-underline"
              >
                Select All
              </button>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <button
                onClick={deselectAllComments}
                disabled={selectedCount === 0}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 disabled:no-underline"
              >
                Deselect All
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleExportJSON}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export JSON
          </button>

          <button
            onClick={() => setShowDeleteDialog(true)}
            disabled={isPosting}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear My Comments
          </button>

          <button
            onClick={() => setShowPostDialog(true)}
            disabled={isPosting || selectedCount === 0}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {isPosting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Posting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                </svg>
                Post Review ({selectedCount})
              </>
            )}
          </button>
        </div>
      </div>

      {/* Post Confirmation Dialog */}
      {showPostDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Post Review to GitLab?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {selectedCount} selected comment{selectedCount !== 1 ? 's' : ''} will be posted
              as inline code comments.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPostDialog(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handlePostReview}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Post Comments
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Clear My Comments?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              This will delete ALL your comments and discussion threads on this MR.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteComments}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete Comments
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve MR Confirmation Dialog (RN-APV-002/003) */}
      {showApproveDialog && currentMR && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Approve MR !{currentMR.iid}?
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              You are about to approve this merge request.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
              This action indicates that you have reviewed the changes and consider them ready to merge.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowApproveDialog(false)}
                disabled={isApproving}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveMR}
                disabled={isApproving}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isApproving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Approve MR
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result Toast */}
      {postResult && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50">
          <div
            className={`px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 ${
              postResult.success
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {postResult.success ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
            <span>{postResult.message}</span>
            {(postResult.successCount !== undefined || postResult.failureCount !== undefined) && (
              <button
                onClick={() => setShowSummaryModal(true)}
                className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-sm transition-colors"
              >
                View Details
              </button>
            )}
            <button
              type="button"
              onClick={() => setPostResult(null)}
              title="Close notification"
              className="hover:opacity-75"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Review Summary Modal (RN-OUT-002) */}
      {currentMR && postResult && (
        <ReviewSummaryModal
          isOpen={showSummaryModal}
          onClose={() => setShowSummaryModal(false)}
          postedCount={postResult.successCount || 0}
          skippedCount={postResult.skippedCount || 0}
          failedCount={postResult.failureCount || 0}
          comments={review.comments}
          mrUrl={currentMR.web_url}
        />
      )}
    </div>
  );
}
