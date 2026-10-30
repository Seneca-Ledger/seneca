import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import worker, { type Env } from './index.ts';

const layout = {
  version: 1,
  bankName: 'other',
  headings: [{ phrase: 'when', role: 'date' }],
  columns: [],
  balances: {},
};

const env = (allowed = true): Env => ({
  GITHUB_REPO: 'owner/parser-submissions',
  GITHUB_TOKEN: 'test-token',
  SUBMISSIONS: { limit: async () => ({ success: allowed }) },
});

const post = (body: string, path = '/submit') =>
  new Request(`https://worker.example${path}`, { method: 'POST', body });

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** GitHub as the worker sees it: the key's issue (if any), then the answer to the write. */
function githubAnswering(status: number, existing: { number: number }[] = []) {
  const calls: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    if ((init.method ?? 'GET') === 'GET') {
      return new Response(JSON.stringify(existing), { status: 200 });
    }
    if (String(url).endsWith('/labels')) {
      return new Response('{}', { status: 201 });
    }
    return new Response('{}', { status });
  }) as typeof fetch;
  return calls;
}

describe('parser-submissions worker', () => {
  it('files a layout as an issue in the configured repository and answers nothing about it', async () => {
    const calls = githubAnswering(201);
    const answer = await worker.fetch(post(JSON.stringify(layout)), env());
    assert.equal(answer.status, 201);
    assert.deepEqual(await answer.json(), { received: true });
    const writes = calls.filter(call => call.init.method === 'POST');
    assert.deepEqual(
      writes.map(call => call.url),
      [
        'https://api.github.com/repos/owner/parser-submissions/labels',
        'https://api.github.com/repos/owner/parser-submissions/issues',
      ],
    );
    assert.match(calls[0].url, /\/issues\?state=all&per_page=1&labels=key%3A[0-9a-f]{12}$/);
    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers.authorization, 'Bearer test-token');
    const issue = JSON.parse(String(writes[1].init.body));
    assert.deepEqual(issue.labels.slice(0, 1), ['layout']);
    assert.match(issue.labels[1], /^key:[0-9a-f]{12}$/);
  });

  it('adds a layout already filed to its issue as a comment', async () => {
    const calls = githubAnswering(201, [{ number: 7 }]);
    const answer = await worker.fetch(post(JSON.stringify(layout)), env());
    assert.equal(answer.status, 201);
    const writes = calls.filter(call => call.init.method === 'POST');
    assert.deepEqual(
      writes.map(call => call.url),
      ['https://api.github.com/repos/owner/parser-submissions/issues/7/comments'],
    );
    assert.match(JSON.parse(String(writes[0].init.body)).body, /Submitted again/);
  });

  it('refuses before GitHub: wrong path or method, over the rate, too big, not a layout', async () => {
    const calls = githubAnswering(201);
    const answers = await Promise.all([
      worker.fetch(post(JSON.stringify(layout), '/other'), env()),
      worker.fetch(new Request('https://worker.example/submit'), env()),
      worker.fetch(post(JSON.stringify(layout)), env(false)),
      worker.fetch(post(`{"pad":"${'x'.repeat(17_000)}"}`), env()),
      worker.fetch(post('{not json'), env()),
      worker.fetch(post(JSON.stringify({ ...layout, transactions: [] })), env()),
    ]);
    assert.deepEqual(
      answers.map(answer => answer.status),
      [404, 405, 429, 413, 400, 400],
    );
    assert.equal(calls.length, 0);
  });

  it('says so when GitHub does not take the issue', async () => {
    githubAnswering(401);
    const answer = await worker.fetch(post(JSON.stringify(layout)), env());
    assert.equal(answer.status, 502);
  });
});
