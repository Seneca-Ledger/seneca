import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { HttpException, Logger } from '@nestjs/common';
import { type Schema, SchemaAST } from 'effect';
import { projectToContract } from '../../common/effect/schema-response';
import { hideInternalColumns } from '../../common/interceptors/hide-internal-columns.interceptor';
import { ACCOUNT_KEYS, withoutKeys } from '../../common/utils/sensitive-keys.util';

/** Past this an answer is cut: an agent's context is not a place for a whole ledger. */
export const MAX_RESULT_CHARS = 200_000;

const logger = new Logger('McpTools');

const text = (value: string, isError = false): CallToolResult => ({
  content: [{ type: 'text', text: value }],
  ...(isError ? { isError: true } : {}),
});

/**
 * A tool's answer as its REST route would send it: no file paths, hashes or
 * account rows, and, when the route has a response contract, nothing it does
 * not declare. The controller writes MCP answers itself, so the response
 * interceptors that do this for REST never see them.
 */
export function toToolResult(value: unknown, output?: Schema.Top): CallToolResult {
  // Entity instances first: hideInternalColumns reduces a joined User to the person.
  const internalHidden = hideInternalColumns(value);
  const wire: unknown =
    internalHidden === undefined ? null : JSON.parse(JSON.stringify(internalHidden));
  const declared = output ? projectToContract(SchemaAST.toEncoded(output.ast), wire) : wire;
  const body = JSON.stringify(withoutKeys(declared, ACCOUNT_KEYS), null, 2);
  return body.length > MAX_RESULT_CHARS
    ? text(`${body.slice(0, MAX_RESULT_CHARS)}\n… truncated: narrow the filters or lower the limit`)
    : text(body);
}

/** A refused call as the REST error body would describe it; anything unexpected stays opaque. */
export function toToolError(error: unknown, tool: string): CallToolResult {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    const details = typeof response === 'string' ? { message: response } : response;
    return text(JSON.stringify({ status: error.getStatus(), ...details }), true);
  }
  logger.error(`MCP tool ${tool} failed`, error instanceof Error ? error.stack : String(error));
  return text(JSON.stringify({ status: 500, message: 'Internal error' }), true);
}

/** Arguments the tool's schema refused, in the shape of a REST 400. */
export function toArgumentError(messages: string[]): CallToolResult {
  return text(
    JSON.stringify({
      status: 400,
      message: messages.length > 0 ? messages : ['Invalid arguments'],
    }),
    true,
  );
}
