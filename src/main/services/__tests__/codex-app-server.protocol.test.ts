import { describe, expect, it } from 'vitest';
import {
  CodexProtocolError,
  parseAppServerMessage,
} from '../codex-app-server.protocol';

describe('Codex App Server protocol boundary', () => {
  it('parses the supported lifecycle', () => {
    // Given
    const messages = [
      '{"id":0,"result":{"userAgent":"codex_cli_rs/0.147.0"}}',
      '{"id":1,"result":{"thread":{"id":"thread-1"}}}',
      '{"id":2,"result":{"turn":{"id":"turn-1","status":"inProgress","items":[]}}}',
      '{"method":"item/agentMessage/delta","params":{"threadId":"thread-1","turnId":"turn-1","itemId":"item-1","delta":"{\\"summary\\":"}}',
      '{"method":"item/completed","params":{"threadId":"thread-1","turnId":"turn-1","item":{"type":"agentMessage","id":"item-1","text":"{\\"summary\\":\\"ok\\"}"}}}',
      '{"method":"turn/completed","params":{"threadId":"thread-1","turn":{"id":"turn-1","status":"completed","items":[]}}}',
    ];

    // When
    const parsed = messages.map(parseAppServerMessage);

    // Then
    expect(parsed.map((message) => message.kind)).toEqual([
      'response',
      'response',
      'response',
      'agent_message_delta',
      'item_completed',
      'turn_completed',
    ]);
  });

  it.each([
    ['invalid JSON', '{not-json'],
    ['missing response id', '{"result":{}}'],
    ['missing notification correlation', '{"method":"item/agentMessage/delta","params":{"delta":"x"}}'],
    ['unsupported turn status', '{"method":"turn/completed","params":{"threadId":"thread-1","turn":{"id":"turn-1","status":"mystery","items":[]}}}'],
    ['malformed error response', '{"id":3,"error":{"message":"failed"}}'],
  ])('rejects malformed protocol messages: %s', (_caseName, line) => {
    // Given / When / Then
    expect(() => parseAppServerMessage(line)).toThrow(CodexProtocolError);
  });

  it('parses a correlated protocol error without including payload data', () => {
    // Given
    const line = '{"id":7,"error":{"code":-32001,"message":"Server overloaded; retry later."}}';

    // When
    const parsed = parseAppServerMessage(line);

    // Then
    expect(parsed).toEqual({
      kind: 'error_response',
      id: 7,
      code: -32001,
      message: 'Server overloaded; retry later.',
    });
  });
});
