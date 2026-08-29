// -----------------------------------------------------------------------------
// Error Types
// -----------------------------------------------------------------------------

export type GitLabErrorType =
  | 'INVALID_URL'
  | 'INVALID_TOKEN'
  | 'MR_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'DECODING_ERROR';

export interface GitLabError {
  type: GitLabErrorType;
  message: string;
  retryAfter?: number;
}
