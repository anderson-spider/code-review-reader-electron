export type PendingRequest = {
  readonly resolve: (result: Readonly<Record<string, unknown>>) => void;
  readonly reject: (error: Error) => void;
  readonly timer: ReturnType<typeof setTimeout>;
};

export type TurnState = {
  readonly threadId: string;
  readonly turnId: string;
  readonly deltas: string[];
  completedText?: string;
  outcome?: { readonly kind: 'completed' } | { readonly kind: 'failed'; readonly error: Error };
  waiter?: { readonly resolve: (text: string) => void; readonly reject: (error: Error) => void };
  timer?: ReturnType<typeof setTimeout>;
};
