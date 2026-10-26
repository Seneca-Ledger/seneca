// A minimal client for the Seneca API, shared by the guide screenshot scripts. It keeps the
// session cookies the server sets and echoes the CSRF cookie in the x-csrf-token header on
// every unsafe request, the way the app's own client does (backend csrf.guard.ts).

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';

export function apiSession(apiUrl) {
  const jar = new Map();

  function remember(response) {
    for (const header of response.headers.getSetCookie()) {
      const [pair] = header.split(';');
      const index = pair.indexOf('=');
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      if (value) {
        jar.set(name, value);
      } else {
        jar.delete(name);
      }
    }
  }

  function headersFor(method, body, extra) {
    const headers = { accept: 'application/json', ...extra };
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
    }
    if (jar.size) {
      headers.cookie = [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
    }
    if (method !== 'GET' && jar.has(CSRF_COOKIE)) {
      headers[CSRF_HEADER] = jar.get(CSRF_COOKIE);
    }
    return headers;
  }

  /** Answers the parsed JSON body; throws on any status but 2xx. */
  async function request(method, route, body, extraHeaders = {}) {
    const response = await fetch(`${apiUrl}${route}`, {
      method,
      headers: headersFor(method, body, extraHeaders),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    remember(response);
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${method} ${route} answered ${response.status}: ${text.slice(0, 300)}`);
    }
    return text ? JSON.parse(text) : null;
  }

  return {
    request,
    /** The session cookies, for a browser context to start logged in. */
    cookies: () => [...jar].map(([name, value]) => ({ name, value })),
  };
}
