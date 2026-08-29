export class CodexAppServerTransportError extends Error {
  readonly name = 'CodexAppServerTransportError';

  constructor(
    readonly category: string,
    options?: ErrorOptions & { readonly details?: Readonly<Record<string, unknown>> },
  ) {
    super(options?.details?.message === undefined
      ? `Codex App Server transport failed: ${category}`
      : String(options.details.message), options);
  }
}
