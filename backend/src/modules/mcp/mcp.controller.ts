import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Controller, Delete, Get, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { resolveAuditActor } from '../../common/interceptors/audit-actor.interceptor';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import type { User } from '../../entities/user.entity';
import { McpAccessGuard } from './mcp-access.guard';
import { McpServerFactory } from './mcp-server.factory';
import type { McpToolContext } from './mcp-tool';

/** Guards have run: the request carries a key, its workspace and the member behind it. */
const toolContextOf = (request: AuthenticatedRequest): McpToolContext => ({
  user: request.user as User,
  workspaceId: request.apiKeyWorkspaceId as string,
  memberId: request.workspaceMemberId ?? null,
  subject: {
    user: request.user as User,
    apiKey: request.apiKey,
    workspaceRole: request.workspaceRole,
    workspaceMemberPermissions: request.workspaceMemberPermissions,
  },
  // biome-ignore lint/style/noNonNullAssertion: McpAccessGuard admits API-key requests only.
  auditActor: resolveAuditActor(request)!,
});

const methodNotAllowed = (response: Response): void => {
  response
    .status(HttpStatus.METHOD_NOT_ALLOWED)
    .set('Allow', 'POST')
    .json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed: this MCP endpoint is stateless' },
      id: null,
    });
};

/**
 * Model Context Protocol over Streamable HTTP, stateless: every POST carries
 * the API key and gets its own server, so there is no session to keep.
 */
@ApiTags('MCP')
@Controller('mcp')
@UseGuards(McpAccessGuard, WorkspaceContextGuard)
export class McpController {
  constructor(private readonly servers: McpServerFactory) {}

  @Post()
  @ApiOperation({ summary: 'MCP JSON-RPC request (Streamable HTTP, stateless)' })
  async handle(@Req() request: AuthenticatedRequest, @Res() response: Response): Promise<void> {
    const server = this.servers.create(toolContextOf(request));
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    response.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    // express.json() has parsed the body already.
    await transport.handleRequest(request, response, request.body);
  }

  @Get()
  stream(@Res() response: Response): void {
    methodNotAllowed(response);
  }

  @Delete()
  endSession(@Res() response: Response): void {
    methodNotAllowed(response);
  }
}
