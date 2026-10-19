import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { proxy } from './proxy';

const requestTo = (path: string, cookies: Record<string, string> = {}): NextRequest =>
  new NextRequest(new URL(path, 'http://localhost:3000'), {
    headers: {
      cookie: Object.entries(cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join('; '),
    },
  });

const passedThrough = (response: Response): boolean =>
  response.headers.get('x-middleware-next') === '1';

describe('proxy', () => {
  it('lets a session whose access cookie has lapsed through, so the client can refresh it', () => {
    expect(passedThrough(proxy(requestTo('/dashboard', { refresh_token: 'refresh' })))).toBe(true);
  });

  it('lets a request with an access cookie through', () => {
    expect(passedThrough(proxy(requestTo('/dashboard', { access_token: 'access' })))).toBe(true);
  });

  it('sends a visitor without session cookies to login, keeping the destination', () => {
    const response = proxy(requestTo('/statements?page=2'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/login?next=%2Fstatements%3Fpage%3D2',
    );
  });

  it('keeps the auth screens reachable without a session', () => {
    expect(passedThrough(proxy(requestTo('/login')))).toBe(true);
  });
});
