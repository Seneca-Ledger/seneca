// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceVersion } from '@/app/lib/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';

const hook = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
}));

vi.mock('@/app/settings/profile/hooks/useVersions', () => ({
  useVersions: () => hook.state,
}));

import { groupByMonth, VersionsSection, versionOnOrBefore } from './VersionsSection';

const version = (overrides: Partial<WorkspaceVersion>): WorkspaceVersion => ({
  id: 'v1',
  takenAt: '2026-10-16T01:00:00.000Z',
  trigger: 'scheduled',
  status: 'ready',
  rowCounts: { transactions: 312, statements: 10, receipts: 4 },
  sizeBytes: '2400000',
  errorMessage: null,
  ...overrides,
});

const VERSIONS = [
  version({ id: 'oct-16', takenAt: '2026-10-16T01:00:00.000Z' }),
  version({ id: 'oct-15', takenAt: '2026-10-15T09:30:00.000Z', trigger: 'manual' }),
  version({ id: 'sep-30', takenAt: '2026-09-30T01:00:00.000Z' }),
];

const mutation = () => ({ mutate: vi.fn(), isPending: false });

const setHook = (data: WorkspaceVersion[] | undefined, extra: Record<string, unknown> = {}) => {
  hook.state = {
    query: { data, isSuccess: data !== undefined, isError: false, error: null },
    take: mutation(),
    copy: mutation(),
    ...extra,
  };
};

const render = (onOpen = vi.fn(async () => undefined), onCopied = vi.fn()) => {
  renderWithQuery(
    <VersionsSection workspaceName="Keller Design" onOpen={onOpen} onCopied={onCopied} />,
  );
  return { onOpen, onCopied };
};

describe('VersionsSection', () => {
  beforeEach(() => setHook(VERSIONS));

  it('says when the first snapshot comes, and offers one now, while there are none', () => {
    setHook([]);
    render();
    expect(screen.getByText('No snapshots yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Take a snapshot now' }));
    expect((hook.state.take as { mutate: ReturnType<typeof vi.fn> }).mutate).toHaveBeenCalled();
  });

  it('lists versions by month with what each holds', () => {
    render();
    const groups = screen.getAllByRole('region');
    expect(groups.map(group => group.getAttribute('aria-label'))).toEqual([
      'October 2026',
      'September 2026',
    ]);
    const [first] = screen.getAllByTestId('version-row');
    expect(first.textContent).toContain('nightly · Transactions: 312 · Documents: 14 · 2.4 MB');
    expect(screen.getAllByTestId('version-row')[1].textContent).toContain('manual');
  });

  it('opens a version through the app', () => {
    const { onOpen } = render();
    const [first] = screen.getAllByTestId('version-row');
    fireEvent.click(within(first).getByRole('button', { name: 'Open' }));
    expect(onOpen).toHaveBeenCalledWith('oct-16');
  });

  it('saves a version as a copy under a name it suggests', () => {
    render();
    const [first] = screen.getAllByTestId('version-row');
    fireEvent.click(within(first).getByRole('button', { name: 'Save as copy' }));

    const name = screen.getByLabelText('Name') as HTMLInputElement;
    expect(name.value).toMatch(/^Keller Design — Oct 16, 2026$/);
    fireEvent.change(name, { target: { value: 'Before the move' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const copy = hook.state.copy as { mutate: ReturnType<typeof vi.fn> };
    expect(copy.mutate.mock.calls[0][0]).toEqual({ id: 'oct-16', name: 'Before the move' });
  });

  it('shows a version still being taken, or one that failed, without its actions', () => {
    setHook([
      version({ id: 'running', status: 'running' }),
      version({ id: 'failed', status: 'failed', errorMessage: 'disk full' }),
    ]);
    render();
    const [running, failed] = screen.getAllByTestId('version-row');
    expect(running.textContent).toContain('Being taken…');
    expect(within(failed).getByTitle('disk full').textContent).toContain('Failed');
    expect(screen.queryByRole('button', { name: 'Open' })).toBeNull();
  });

  it('tells a member that versions are the owner’s', () => {
    setHook(undefined, {
      query: {
        data: undefined,
        isSuccess: false,
        isError: true,
        error: Object.assign(new Error('403'), {
          isAxiosError: true,
          response: { data: { error: { code: 'VERSION_LIST_OWNER_ONLY' } } },
        }),
      },
    });
    render();
    expect(screen.getByText('Only the workspace owner sees versions.')).toBeInTheDocument();
  });
});

describe('versions helpers', () => {
  it('jumps to the newest ready version taken on or before a day', () => {
    expect(versionOnOrBefore(VERSIONS, '2026-10-15')?.id).toBe('oct-15');
    expect(versionOnOrBefore(VERSIONS, '2026-10-01')?.id).toBe('sep-30');
    expect(versionOnOrBefore(VERSIONS, '2026-09-01')).toBeNull();
  });

  it('groups newest first by month', () => {
    expect(groupByMonth(VERSIONS, 'en').map(group => group.versions.length)).toEqual([2, 1]);
  });
});
