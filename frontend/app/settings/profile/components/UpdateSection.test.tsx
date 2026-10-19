import { renderWithQuery } from '@/app/test/query-wrapper';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SystemUpdateStatus } from '@/app/lib/contracts';
import { UpdateSection } from './UpdateSection';

const apiMocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock('@/app/lib/api', () => ({ default: apiMocks }));
// Every dictionary entry renders as its own key, so the test reads the keys.
vi.mock('@/app/i18n', () => ({
  useIntlayer: () =>
    new Proxy({}, { get: (_, key: string) => ({ value: key, toString: () => key }) }),
}));

// The wire format (packages/contracts SystemUpdateStatus).
const idleRun: SystemUpdateStatus['run'] = {
  state: 'idle',
  tag: null,
  step: null,
  message: null,
  backup: null,
  startedAt: null,
  finishedAt: null,
};

const statusOf = (overrides: Partial<SystemUpdateStatus> = {}): SystemUpdateStatus => ({
  currentVersion: 'v1.2.0',
  latestVersion: 'v1.3.0',
  releaseUrl: 'https://github.com/symonbaikov/seneca/releases/tag/v1.3.0',
  updateAvailable: true,
  updaterAvailable: true,
  run: idleRun,
  ...overrides,
});

describe('UpdateSection', () => {
  const reload = vi.fn();
  const originalLocation = window.location;

  beforeEach(() => {
    apiMocks.get.mockReset();
    apiMocks.post.mockReset();
    reload.mockReset();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('stays hidden and quiet for users who are not instance admins', () => {
    const { container } = renderWithQuery(<UpdateSection isAdmin={false} />);
    expect(container).toBeEmptyDOMElement();
    expect(apiMocks.get).not.toHaveBeenCalled();
  });

  it('says the instance is current when there is nothing newer', async () => {
    apiMocks.get.mockResolvedValue({
      data: statusOf({ currentVersion: 'v1.3.0', updateAvailable: false }),
    });
    renderWithQuery(<UpdateSection isAdmin />);

    expect(await screen.findByText('upToDate')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('explains how to turn the updater on when it is not running', async () => {
    apiMocks.get.mockResolvedValue({ data: statusOf({ updaterAvailable: false }) });
    renderWithQuery(<UpdateSection isAdmin />);

    expect(await screen.findByText('updaterOff')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /updateTo/ })).not.toBeInTheDocument();
  });

  it('starts the update, follows it through the restart and reloads on the new version', async () => {
    apiMocks.get.mockResolvedValueOnce({ data: statusOf() });
    apiMocks.post.mockResolvedValue({
      data: statusOf({ run: { ...idleRun, state: 'running', tag: 'v1.3.0', step: 'queued' } }),
    });
    renderWithQuery(<UpdateSection isAdmin />);

    fireEvent.click(await screen.findByRole('button', { name: /updateTo/ }));

    await waitFor(() => expect(apiMocks.post).toHaveBeenCalledWith('/system/update'));
    expect(await screen.findByText('stepQueued')).toBeInTheDocument();

    // The backend is down while it restarts, then answers on the new release.
    apiMocks.get
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValue({
        data: statusOf({
          currentVersion: 'v1.3.0',
          updateAvailable: false,
          run: { ...idleRun, state: 'succeeded', tag: 'v1.3.0', step: 'finished' },
        }),
      });

    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1), { timeout: 8000 });
    expect(screen.getByText('done')).toBeInTheDocument();
  }, 10000);

  it('shows why a run failed and where the backup is', async () => {
    apiMocks.get.mockResolvedValue({
      data: statusOf({
        run: {
          ...idleRun,
          state: 'failed',
          tag: 'v1.3.0',
          step: 'pull',
          message: 'manifest unknown',
          backup: 'backup_20261016_100000.sql',
        },
      }),
    });
    renderWithQuery(<UpdateSection isAdmin />);

    expect(await screen.findByText('failed')).toBeInTheDocument();
    expect(screen.getByText('manifest unknown')).toBeInTheDocument();
    expect(screen.getByText('backupSaved')).toBeInTheDocument();
    // A failed run can be retried.
    expect(screen.getByRole('button', { name: /updateTo/ })).toBeInTheDocument();
  });
});
