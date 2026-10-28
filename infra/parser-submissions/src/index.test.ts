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

function githubAnswering(status: number) {
  const calls: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
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
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.github.com/repos/owner/parser-submissions/issues');
    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers.authorization, 'Bearer test-token');
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
