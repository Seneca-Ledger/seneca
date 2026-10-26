import type { Mock } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { EffectRuntime } from '@/common/effect/effect-runtime';
import { UserRole } from '@/entities';
import {
  compareReleaseTags,
  SystemUpdateService,
} from '@/modules/system-update/system-update.service';

describe('SystemUpdateService', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;
  const admin = { id: 'admin-1', role: UserRole.ADMIN } as never;
  const member = { id: 'user-1', role: UserRole.USER } as never;
  let dir: string;
  let effects: EffectRuntime;
  let fetchMock: Mock;

  const releaseResponse = (tag: string) => async () =>
    new Response(
      JSON.stringify({ tag_name: tag, html_url: `https://github.com/Seneca-Ledger/seneca/releases/tag/${tag}` }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );

  const heartbeat = (ageMs = 0) => {
    const file = path.join(dir, 'heartbeat');
    writeFileSync(file, '');
    const at = new Date(Date.now() - ageMs);
    utimesSync(file, at, at);
  };

  const makeService = () => new SystemUpdateService(effects);

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'seneca-update-'));
    process.env = { ...originalEnv, UPDATE_DIR: dir, APP_VERSION: 'v1.2.0' };
    effects = new EffectRuntime();
    fetchMock = vi.fn(releaseResponse('v1.3.0'));
    global.fetch = fetchMock as never;
  });

  afterEach(async () => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    await effects.onModuleDestroy();
    rmSync(dir, { recursive: true, force: true });
  });

  it('compares release tags numerically', () => {
    expect(compareReleaseTags('v1.10.0', 'v1.9.9')).toBe(1);
    expect(compareReleaseTags('v1.2.0', 'v1.2.0')).toBe(0);
    expect(compareReleaseTags('v0.9.0', 'v1.0.0')).toBe(-1);
    expect(compareReleaseTags('sha-abc1234', 'v1.0.0')).toBeNull();
  });

  it('refuses users who are not instance admins', async () => {
    await expect(makeService().getStatus(member)).rejects.toMatchObject({ status: 403 });
    await expect(makeService().requestUpdate(member)).rejects.toMatchObject({ status: 403 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a newer release and a live updater', async () => {
    heartbeat();
    const status = await makeService().getStatus(admin);

    expect(status).toMatchObject({
      currentVersion: 'v1.2.0',
      latestVersion: 'v1.3.0',
      releaseUrl: 'https://github.com/Seneca-Ledger/seneca/releases/tag/v1.3.0',
      updateAvailable: true,
      updaterAvailable: true,
      run: { state: 'idle' },
    });
  });

  it('offers no update to a local build or when already current', async () => {
    process.env.APP_VERSION = '';
    expect((await makeService().getStatus(admin)).updateAvailable).toBe(false);

    process.env.APP_VERSION = 'v1.3.0';
    expect((await makeService().getStatus(admin)).updateAvailable).toBe(false);
  });

  it('treats a stale heartbeat as no updater', async () => {
    heartbeat(60_000);
    expect((await makeService().getStatus(admin)).updaterAvailable).toBe(false);
  });

  it('keeps working when GitHub cannot be reached, and caches the release', async () => {
    fetchMock.mockImplementation(async () => new Response('Not Found', { status: 404 }));
    const service = makeService();
    const status = await service.getStatus(admin);
    expect(status).toMatchObject({ latestVersion: null, updateAvailable: false });

    await service.getStatus(admin);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('queues the newest release for the updater', async () => {
    heartbeat();
    const status = await makeService().requestUpdate(admin);

    expect(readFileSync(path.join(dir, 'request'), 'utf8')).toBe('v1.3.0\n');
    expect(status.run).toMatchObject({ state: 'running', tag: 'v1.3.0', step: 'queued' });
    // Until the updater picks the request up, a read reports it as running too.
    expect((await makeService().getStatus(admin)).run).toMatchObject({
      state: 'running',
      step: 'queued',
    });
  });

  it('refuses when the updater is not running', async () => {
    await expect(makeService().requestUpdate(admin)).rejects.toMatchObject({
      status: 409,
      response: { code: 'SYSTEM_UPDATER_UNAVAILABLE' },
    });
    expect(existsSync(path.join(dir, 'request'))).toBe(false);
  });

  it('refuses a second request while one is running', async () => {
    heartbeat();
    writeFileSync(
      path.join(dir, 'status.json'),
      JSON.stringify({ state: 'running', tag: 'v1.3.0', step: 'pull', message: '', backup: 'backup_1.sql', startedAt: '2026-10-16T10:00:00Z', finishedAt: '' }),
    );
    await expect(makeService().requestUpdate(admin)).rejects.toMatchObject({
      status: 409,
      response: { code: 'SYSTEM_UPDATE_IN_PROGRESS' },
    });
  });

  it('refuses when there is nothing newer', async () => {
    heartbeat();
    process.env.APP_VERSION = 'v1.3.0';
    await expect(makeService().requestUpdate(admin)).rejects.toMatchObject({
      status: 409,
      response: { code: 'SYSTEM_UPDATE_NOT_AVAILABLE' },
    });
  });

  it('reads a failed run from the updater status file', async () => {
    writeFileSync(
      path.join(dir, 'status.json'),
      JSON.stringify({ state: 'failed', tag: 'v1.3.0', step: 'pull', message: 'manifest unknown', backup: 'backup_1.sql', startedAt: '2026-10-16T10:00:00Z', finishedAt: '2026-10-16T10:01:00Z' }),
    );
    expect((await makeService().getStatus(admin)).run).toEqual({
      state: 'failed',
      tag: 'v1.3.0',
      step: 'pull',
      message: 'manifest unknown',
      backup: 'backup_1.sql',
      startedAt: '2026-10-16T10:00:00Z',
      finishedAt: '2026-10-16T10:01:00Z',
    });
  });

  it('falls back to idle on a status file it cannot read', async () => {
    writeFileSync(path.join(dir, 'status.json'), '{not json');
    expect((await makeService().getStatus(admin)).run.state).toBe('idle');
  });
});
