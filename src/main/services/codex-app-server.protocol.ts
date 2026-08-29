import { z } from 'zod';

const RequestIdSchema = z.union([z.number().int(), z.string().min(1)]);
const EnvelopeSchema = z.record(z.string(), z.unknown());

export const ThreadStartResultSchema = z.object({ thread: z.object({ id: z.string().min(1) }) });
export const TurnStartResultSchema = z.object({ turn: z.object({ id: z.string().min(1) }) });

const ResponseSchema = z.object({
  id: RequestIdSchema,
  result: z.record(z.string(), z.unknown()),
});

const ErrorResponseSchema = z.object({
  id: RequestIdSchema,
  error: z.object({ code: z.number().int(), message: z.string() }),
});

const AgentMessageDeltaSchema = z.object({
  method: z.literal('item/agentMessage/delta'),
  params: z.object({
    threadId: z.string().min(1),
    turnId: z.string().min(1),
    itemId: z.string().min(1),
    delta: z.string(),
  }),
});

const ItemCompletedSchema = z.object({
  method: z.literal('item/completed'),
  params: z.object({
    threadId: z.string().min(1),
    turnId: z.string().min(1),
    item: z.object({
      id: z.string().min(1),
      type: z.string().min(1),
      text: z.string().optional(),
    }),
  }),
});

const TurnCompletedSchema = z.object({
  method: z.literal('turn/completed'),
  params: z.object({
    threadId: z.string().min(1),
    turn: z.object({
      id: z.string().min(1),
      status: z.enum(['completed', 'failed', 'interrupted']),
      items: z.array(z.unknown()),
      error: z.unknown().optional(),
    }),
  }),
});

export type AppServerMessage =
  | { readonly kind: 'response'; readonly id: string | number; readonly result: Readonly<Record<string, unknown>> }
  | { readonly kind: 'error_response'; readonly id: string | number; readonly code: number; readonly message: string }
  | { readonly kind: 'agent_message_delta'; readonly threadId: string; readonly turnId: string; readonly itemId: string; readonly delta: string }
  | { readonly kind: 'item_completed'; readonly threadId: string; readonly turnId: string; readonly item: { readonly id: string; readonly type: string; readonly text?: string } }
  | { readonly kind: 'turn_completed'; readonly threadId: string; readonly turn: { readonly id: string; readonly status: 'completed' | 'failed' | 'interrupted'; readonly error?: unknown } }
  | { readonly kind: 'ignored_notification'; readonly method: string };

export class CodexProtocolError extends Error {
  readonly name = 'CodexProtocolError';

  constructor(readonly category: 'invalid_json' | 'invalid_envelope', options?: ErrorOptions) {
    super(`Invalid Codex App Server ${category === 'invalid_json' ? 'JSONL' : 'message'}`, options);
  }
}

function parseEnvelope<T>(schema: z.ZodType<T>, envelope: Readonly<Record<string, unknown>>): T {
  const result = schema.safeParse(envelope);
  if (!result.success) {
    throw new CodexProtocolError('invalid_envelope', { cause: result.error });
  }
  return result.data;
}

export function parseAppServerMessage(line: string): AppServerMessage {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch (error) {
    throw new CodexProtocolError('invalid_json', { cause: error });
  }

  const envelopeResult = EnvelopeSchema.safeParse(raw);
  if (!envelopeResult.success) {
    throw new CodexProtocolError('invalid_envelope', { cause: envelopeResult.error });
  }
  const envelope = envelopeResult.data;
  const method = envelope.method;

  if (typeof method === 'string') {
    switch (method) {
      case 'item/agentMessage/delta': {
        const message = parseEnvelope(AgentMessageDeltaSchema, envelope);
        return { kind: 'agent_message_delta', ...message.params };
      }
      case 'item/completed': {
        const message = parseEnvelope(ItemCompletedSchema, envelope);
        return { kind: 'item_completed', ...message.params };
      }
      case 'turn/completed': {
        const message = parseEnvelope(TurnCompletedSchema, envelope);
        const { id, status, error } = message.params.turn;
        return {
          kind: 'turn_completed',
          threadId: message.params.threadId,
          turn: { id, status, ...(error === undefined ? {} : { error }) },
        };
      }
      default:
        return { kind: 'ignored_notification', method };
    }
  }

  if ('error' in envelope) {
    const message = parseEnvelope(ErrorResponseSchema, envelope);
    return { kind: 'error_response', id: message.id, code: message.error.code, message: message.error.message };
  }

  const message = parseEnvelope(ResponseSchema, envelope);
  return { kind: 'response', id: message.id, result: message.result };
}
