/** What an MCP client needs: the endpoint URL and the key, as ready-to-paste snippets. */

export const KEY_PLACEHOLDER = 'lum_<your-api-key>';

/** The absolute `/mcp` URL; the API base may be relative (`/api/v1`) behind a proxy. */
export function mcpEndpointUrl(apiBase: string, origin: string): string {
  return `${new URL(apiBase, origin).href.replace(/\/+$/, '')}/mcp`;
}

export function claudeCodeCommand(url: string, key: string): string {
  return `claude mcp add --transport http lumio ${url} --header "X-Api-Key: ${key}"`;
}

export function mcpJsonConfig(url: string, key: string): string {
  return JSON.stringify(
    { mcpServers: { lumio: { type: 'http', url, headers: { 'X-Api-Key': key } } } },
    null,
    2,
  );
}
