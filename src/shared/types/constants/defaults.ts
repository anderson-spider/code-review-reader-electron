// -----------------------------------------------------------------------------
// Default Value Constants
// -----------------------------------------------------------------------------

import type { ProxySettings } from '../proxy';
import type { ParallelAnalysisOptions } from '../review';
import type { LocalCheckoutOptions } from '../repository';
import type { AppearanceSettings } from '../settings';
import type { RefinementState } from '../review';

export const DEFAULT_PROXY_SETTINGS: ProxySettings = {
  enabled: false,
  type: 'none',
  host: '',
  port: 1080,
};

export const DEFAULT_PARALLEL_ANALYSIS_OPTIONS: ParallelAnalysisOptions = {
  enabled: false,
  timeoutPerSpecialist: 120000,
  specialists: ['security', 'performance', 'architecture', 'testing', 'best-practices'],
};

export const DEFAULT_LOCAL_CHECKOUT_OPTIONS: LocalCheckoutOptions = {
  enabled: false,
  maxRelatedDepth: 2,
  maxFileSize: 100 * 1024, // 100KB
};

export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  theme: 'system',
  fontSize: 'medium',
};

/** Initial refinement state */
export const INITIAL_REFINEMENT_STATE: RefinementState = {
  commentId: null,
  isLoading: false,
  error: null,
};
