// -----------------------------------------------------------------------------
// Utility Types
// -----------------------------------------------------------------------------

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T> {
  data: T | null;
  status: LoadingState;
  error: string | null;
}

// Helper to create initial async state
export function createAsyncState<T>(initialData: T | null = null): AsyncState<T> {
  return {
    data: initialData,
    status: 'idle',
    error: null,
  };
}
