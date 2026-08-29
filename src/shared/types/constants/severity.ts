// -----------------------------------------------------------------------------
// Severity Constants
// -----------------------------------------------------------------------------

import type { Severity, AnalysisSource } from '../severity';

export const ANALYSIS_SOURCE_CONFIG: Record<AnalysisSource, { icon: string; label: string; color: string }> = {
  security: { icon: '🔒', label: 'Security', color: 'red' },
  performance: { icon: '⚡', label: 'Performance', color: 'orange' },
  architecture: { icon: '🏗️', label: 'Architecture', color: 'purple' },
  testing: { icon: '🧪', label: 'Testing', color: 'cyan' },
  'best-practices': { icon: '📚', label: 'Best Practices', color: 'blue' },
  general: { icon: '📋', label: 'General', color: 'gray' },
};

export const SEVERITY_CONFIG: Record<Severity, { icon: string; label: string; color: string; blocksApproval: boolean }> = {
  info: { icon: '📝', label: 'Info', color: 'blue', blocksApproval: false },
  suggestion: { icon: '💡', label: 'Suggestion', color: 'green', blocksApproval: false },
  warning: { icon: '⚠️', label: 'Warning', color: 'yellow', blocksApproval: true },
  critical: { icon: '🚨', label: 'Critical', color: 'red', blocksApproval: true },
};
