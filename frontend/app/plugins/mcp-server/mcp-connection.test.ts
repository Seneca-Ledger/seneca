import { describe, expect, it } from 'vitest';
import { claudeCodeCommand, mcpEndpointUrl, mcpJsonConfig } from './mcp-connection';

describe('MCP connection snippets', () => {
  it('builds an absolute endpoint from a relative API base behind a proxy', () => {
    expect(mcpEndpointUrl('/api/v1', 'https://seneca.example.com')).toBe(
      'https://seneca.example.com/api/v1/mcp',
    );
  });

  it('keeps an absolute API base and drops a trailing slash', () => {
    expect(mcpEndpointUrl('http://localhost:3001/api/v1/', 'http://localhost:3000')).toBe(
      'http://localhost:3001/api/v1/mcp',
    );
  });

  it('gives Claude Code the HTTP transport and the key header', () => {
    expect(claudeCodeCommand('https://x/api/v1/mcp', 'lum_abc')).toBe(
      'claude mcp add --transport http seneca https://x/api/v1/mcp --header "X-Api-Key: lum_abc"',
    );
  });

  it('writes a JSON config other clients read', () => {
    expect(JSON.parse(mcpJsonConfig('https://x/api/v1/mcp', 'lum_abc'))).toEqual({
      mcpServers: {
        seneca: { type: 'http', url: 'https://x/api/v1/mcp', headers: { 'X-Api-Key': 'lum_abc' } },
      },
    });
  });
});
