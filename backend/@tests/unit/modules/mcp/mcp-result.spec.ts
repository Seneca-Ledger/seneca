import { MAX_RESULT_CHARS, toToolError, toToolResult } from '@/modules/mcp/mcp-result';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Schema } from 'effect';

const textOf = (result: { content: Array<{ type: string; text?: string }> }) =>
  result.content[0].text as string;

describe('MCP tool results', () => {
  it('never hands out file paths, hashes or account rows', () => {
    const result = toToolResult({
      id: 't1',
      filePath: '/uploads/a.pdf',
      statement: { id: 's1', fileHash: 'abc', fileData: 'xx' },
      user: { id: 'u1', name: 'A', passwordHash: 'h', googleId: 'g', telegramChatId: '1' },
    });

    const parsed = JSON.parse(textOf(result));
    expect(parsed).toEqual({ id: 't1', statement: { id: 's1' }, user: { id: 'u1', name: 'A' } });
    expect(result.isError).toBeUndefined();
  });

  it('keeps only what the route contract declares, as the REST answer does', () => {
    const contract = Schema.Struct({ id: Schema.String, amount: Schema.Number });

    const parsed = JSON.parse(textOf(toToolResult({ id: 'a', amount: 3, secretColumn: 'x' }, contract)));

    expect(parsed).toEqual({ id: 'a', amount: 3 });
  });

  it('writes dates as ISO strings', () => {
    const parsed = JSON.parse(textOf(toToolResult({ at: new Date('2026-01-02T03:04:05.000Z') })));

    expect(parsed.at).toBe('2026-01-02T03:04:05.000Z');
  });

  it('cuts an oversized answer and says how to get a smaller one', () => {
    const text = textOf(toToolResult({ rows: 'x'.repeat(MAX_RESULT_CHARS + 10) }));

    expect(text.length).toBeLessThan(MAX_RESULT_CHARS + 100);
    expect(text).toMatch(/truncated: narrow the filters/);
  });

  it('reports a refused call with the status and code of the REST error', () => {
    const result = toToolError(
      new NotFoundException({ code: 'TRANSACTION_NOT_FOUND', message: 'Transaction not found' }),
      'get_transaction',
    );

    expect(result.isError).toBe(true);
    expect(JSON.parse(textOf(result))).toEqual({
      status: 404,
      code: 'TRANSACTION_NOT_FOUND',
      message: 'Transaction not found',
    });
    expect(JSON.parse(textOf(toToolError(new BadRequestException('bad'), 't'))).status).toBe(400);
  });

  it('keeps an unexpected failure opaque', () => {
    const result = toToolError(new Error('relation "x" does not exist'), 'list_transactions');

    expect(result.isError).toBe(true);
    expect(textOf(result)).not.toMatch(/relation/);
  });
});
