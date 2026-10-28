import { issueFor, parseSubmission } from './submission.ts';

export interface Env {
  GITHUB_REPO: string;
  GITHUB_TOKEN: string;
  SUBMISSIONS: { limit(options: { key: string }): Promise<{ success: boolean }> };
}

/** A layout is a few kilobytes; anything bigger is not one. */
const MAX_BODY_BYTES = 16 * 1024;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/**
 * POST /submit: a shared statement layout, filed as an issue in the private
 * repository. Answers nothing about the issue: the sender cannot open it.
 * Nothing is stored here and request bodies are not logged.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname !== '/submit') {
      return json(404, { error: 'not_found' });
    }
    if (request.method !== 'POST') {
      return json(405, { error: 'method_not_allowed' });
    }
    const client = request.headers.get('cf-connecting-ip') ?? 'unknown';
    if (!(await env.SUBMISSIONS.limit({ key: client })).success) {
      return json(429, { error: 'rate_limited' });
    }
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
      return json(413, { error: 'too_large' });
    }
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return json(400, { error: 'invalid_json' });
    }
    const parsed = parseSubmission(body);
    if (!parsed.ok) {
      return json(400, { error: 'invalid_submission', detail: parsed.error });
    }
    const answer = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/issues`, {
      method: 'POST',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${env.GITHUB_TOKEN}`,
        'content-type': 'application/json',
        'user-agent': 'stoic-parser-submissions',
        'x-github-api-version': '2022-11-28',
      },
      body: JSON.stringify(issueFor(parsed.submission)),
    });
    if (!answer.ok) {
      console.error(`GitHub refused the issue: ${answer.status}`);
      return json(502, { error: 'not_filed' });
    }
    return json(201, { received: true });
  },
};
