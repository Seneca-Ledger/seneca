import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  type CallToolResult,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { Injectable } from '@nestjs/common';
import { Exit, Schema } from 'effect';
import { runWithAuditActor } from '../../common/audit-actor.context';
import { assertPermissions, hasPermissions } from '../../common/authz/request-permissions';
import { describeSchemaFailure, describeUnstorableText } from '../../common/effect/schema-issues';
import { toToolInputSchema } from './mcp-json-schema';
import { toArgumentError, toToolError, toToolResult } from './mcp-result';
import type { McpTool, McpToolContext } from './mcp-tool';
import { McpToolRegistry } from './mcp-tool-registry.service';

const INSTRUCTIONS =
  'Lumio is a bookkeeping app. Every tool works inside the workspace the API key belongs to. ' +
  'List tools are paginated; narrow them with filters rather than paging through everything.';

/** One MCP server per request: the endpoint is stateless and each request carries its key. */
@Injectable()
export class McpServerFactory {
  private readonly listed: ReadonlyArray<{ tool: McpTool; descriptor: Tool }>;
  private readonly decoders: ReadonlyMap<string, (input: unknown) => Exit.Exit<unknown, unknown>>;

  constructor(private readonly registry: McpToolRegistry) {
    this.listed = registry.tools.map(tool => ({
      tool,
      descriptor: {
        name: tool.name,
        description: tool.description,
        inputSchema: toToolInputSchema(tool.input),
        annotations: tool.readOnly
          ? { readOnlyHint: true }
          : { readOnlyHint: false, destructiveHint: false },
      },
    }));
    this.decoders = new Map(
      registry.tools.map(tool => [
        tool.name,
        Schema.decodeUnknownExit(tool.input, { onExcessProperty: 'error', errors: 'all' }),
      ]),
    );
  }

  create(ctx: McpToolContext): Server {
    const server = new Server(
      { name: 'lumio', version: process.env.APP_VERSION?.trim() || 'dev' },
      { capabilities: { tools: {} }, instructions: INSTRUCTIONS },
    );
    // A key sees only the tools its scopes and its owner's role allow.
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.listed
        .filter(({ tool }) => hasPermissions(tool.permissions, ctx.subject))
        .map(({ descriptor }) => descriptor),
    }));
    server.setRequestHandler(CallToolRequestSchema, request =>
      this.call(ctx, request.params.name, request.params.arguments ?? {}),
    );
    return server;
  }

  private async call(ctx: McpToolContext, name: string, args: unknown): Promise<CallToolResult> {
    const tool = this.registry.find(name);
    const decode = this.decoders.get(name);
    if (!(tool && decode)) {
      throw new McpError(ErrorCode.InvalidParams, `Unknown tool: ${name}`);
    }
    try {
      assertPermissions(tool.permissions, ctx.subject);
      const unstorable = describeUnstorableText(args);
      const exit = decode(args);
      if (unstorable || Exit.isFailure(exit)) {
        return toArgumentError(
          unstorable ? [unstorable] : Exit.isFailure(exit) ? describeSchemaFailure(exit.cause) : [],
        );
      }
      const actor = {
        ...ctx.auditActor,
        meta: { ...ctx.auditActor.meta, mcpTool: tool.name },
      };
      const value = await runWithAuditActor(actor, () => tool.run(ctx, exit.value));
      return toToolResult(value, tool.output);
    } catch (error) {
      return toToolError(error, tool.name);
    }
  }
}
