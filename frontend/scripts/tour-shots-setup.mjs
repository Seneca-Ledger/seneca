#!/usr/bin/env node
// Prepares a fresh Lumio instance for scripts/capture-tutorial-screenshots.mjs: registers a
// throwaway account through the public API, takes it past onboarding, the disclaimer and the
// welcome window, and makes its demo workspace (page hints are hidden by the capture script).
// Prints the account and the workspace as KEY=value lines, ready for `>> "$GITHUB_ENV"`:
//
//   node scripts/tour-shots-setup.mjs >> "$GITHUB_ENV"
//
// Env: TUTORIAL_SHOTS_BASE_URL (default http://localhost:3000; the API is served under
// /api/v1 of it), TUTORIAL_SHOTS_SETUP_EMAIL (default alex.morgan@example.com: it shows on the
// members screenshot, so it stays the same from run to run), TUTORIAL_SHOTS_DEMO_NAME (the demo
// workspace's name).
// Meant for a disposable instance such as the CI stack: the account is never removed.

import { randomBytes } from 'node:crypto';
import { apiSession } from './tour-shots/api.mjs';

const env = process.env;
const baseUrl = env.TUTORIAL_SHOTS_BASE_URL ?? 'http://localhost:3000';
const demoName = env.TUTORIAL_SHOTS_DEMO_NAME ?? 'Morgan Design Studio';

// A neutral owner: the name shows in the screenshots, so it must not need rewriting.
const OWNER_NAME = 'Alex Morgan';

async function main() {
  const api = apiSession(`${baseUrl}/api/v1`);
  const email = env.TUTORIAL_SHOTS_SETUP_EMAIL ?? 'alex.morgan@example.com';
  const password = randomBytes(18).toString('base64url');

  await api.request('POST', '/auth/register', { email, password, name: OWNER_NAME });
  await api.request('PATCH', '/users/me/onboarding', {
    locale: 'en',
    timeZone: 'Europe/Berlin',
  });
  await api.request('POST', '/users/me/disclaimer');
  await api.request('POST', '/users/me/welcome-tutorial');

  const demo = await api.request('POST', '/workspaces/demo', { name: demoName });
  await api.request('POST', `/workspaces/${demo.id}/switch`);

  process.stdout.write(
    [
      `TUTORIAL_SHOTS_EMAIL=${email}`,
      `TUTORIAL_SHOTS_PASSWORD=${password}`,
      `TUTORIAL_SHOTS_WORKSPACE_ID=${demo.id}`,
      '',
    ].join('\n'),
  );
}

await main();
