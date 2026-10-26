// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@/app/contexts/AuthContext';

const mocks = vi.hoisted(() => ({
  mounts: { welcome: 0, guide: 0 },
  pathname: '/dashboard',
  post: vi.fn(),
  setUser: vi.fn(),
  user: null as User | null,
}));

vi.mock('next/navigation', () => ({ usePathname: () => mocks.pathname }));
vi.mock('@/app/hooks/useAuth', () => ({
  useAuth: () => ({ user: mocks.user, loading: false, setUser: mocks.setUser }),
}));
vi.mock('@/app/lib/api', () => ({ default: { post: mocks.post } }));
// The pages this user has in the sidebar (the real hook reads permissions and the workspace).
vi.mock('./useTutorialSteps', () => ({
  useTutorialSteps: () => [{ id: 'dashboard' }, { id: 'budgets' }],
}));
// Both windows are lazy-loaded and tested on their own (WelcomeWindow.test.tsx,
// WelcomeTutorialDialog.test.tsx); stand-ins show which one is open.
vi.mock('next/dynamic', async () => {
  const { useEffect } = await import('react');
  return {
    default: (loader: () => unknown) => {
      const kind = String(loader).includes('WelcomeWindow') ? 'welcome' : 'guide';
      return function WindowStandIn(props: {
        open: boolean;
        page?: string | null;
        onClose: () => void;
      }) {
        // Counts mounts: every opening is meant to start a fresh window.
        useEffect(() => {
          mocks.mounts[kind] += 1;
        }, []);
        return props.open ? (
          <button type="button" data-page={props.page ?? ''} onClick={props.onClose}>
            {`close ${kind}`}
          </button>
        ) : null;
      };
    },
  };
});

const newAccount: User = {
  id: 'user-1',
  email: 'mia@example.com',
  name: 'Mia Hoffmann',
  role: 'user',
  onboardingCompletedAt: '2026-09-25T10:00:00.000Z',
  welcomeTutorialSeenAt: null,
};

// The store keeps "opened by itself already" for the page's lifetime, so each test
// loads fresh copies of the host and the store.
async function renderHost() {
  const [{ WelcomeTutorialHost }, store] = await Promise.all([
    import('./WelcomeTutorialHost'),
    import('./welcome-tutorial-store'),
  ]);
  const view = render(<WelcomeTutorialHost />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  return { store, view, WelcomeTutorialHost };
}

const close = async (kind: 'welcome' | 'guide'): Promise<void> => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: `close ${kind}` }));
  });
};
const shown = (kind: 'welcome' | 'guide'): HTMLElement | null =>
  screen.queryByRole('button', { name: `close ${kind}` });

describe('WelcomeTutorialHost', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    mocks.mounts = { welcome: 0, guide: 0 };
    mocks.pathname = '/dashboard';
    mocks.user = newAccount;
    mocks.post.mockReset().mockResolvedValue({ data: { welcomeTutorialSeenAt: '2026-09-25T12:00:00.000Z' } });
    mocks.setUser.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens the welcome window by itself for a new account, never the guide', async () => {
    await renderHost();
    expect(shown('welcome')).toBeTruthy();
    expect(shown('guide')).toBeNull();
  });

  it('stays closed for an account that already closed it', async () => {
    mocks.user = { ...newAccount, welcomeTutorialSeenAt: '2026-09-20T09:00:00.000Z' };
    await renderHost();
    expect(shown('welcome')).toBeNull();
  });

  it('stays closed when the user object does not carry the field', async () => {
    const { welcomeTutorialSeenAt: _omitted, ...withoutField } = newAccount;
    mocks.user = withoutField;
    await renderHost();
    expect(shown('welcome')).toBeNull();
  });

  it('stays closed outside the sidebar pages', async () => {
    mocks.pathname = '/invite/token';
    await renderHost();
    expect(shown('welcome')).toBeNull();
  });

  it('records the close once and updates the user in place', async () => {
    await renderHost();
    await close('welcome');

    expect(shown('welcome')).toBeNull();
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.post).toHaveBeenCalledWith('/users/me/welcome-tutorial');
    // Merged into the current user rather than replacing it.
    const update = mocks.setUser.mock.calls.at(-1)?.[0] as (user: User | null) => User | null;
    expect(update({ ...newAccount, avatarUrl: 'a.png' })).toMatchObject({
      avatarUrl: 'a.png',
      welcomeTutorialSeenAt: '2026-09-25T12:00:00.000Z',
    });
  });

  it('opens the guide from Settings for anyone, without recording it again', async () => {
    mocks.user = { ...newAccount, welcomeTutorialSeenAt: '2026-09-20T09:00:00.000Z' };
    const { store } = await renderHost();

    act(() => store.openWelcomeTutorial());
    expect(shown('guide')).toBeTruthy();
    expect(shown('welcome')).toBeNull();
    await close('guide');

    expect(mocks.post).not.toHaveBeenCalled();
  });

  // The workspace switch remounts part of the tree; the local user may not have the
  // server's timestamp yet, so only the one-opening claim keeps it from coming back.
  it('opens by itself only once per page load, even after a remount', async () => {
    const { view, WelcomeTutorialHost } = await renderHost();
    await close('welcome');
    view.unmount();

    render(<WelcomeTutorialHost />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(shown('welcome')).toBeNull();
  });

  it('starts every opening from a fresh window', async () => {
    const { store } = await renderHost();
    await close('welcome');

    act(() => store.openGuide());
    await close('guide');
    act(() => store.openGuide());

    expect(shown('guide')).toBeTruthy();
    expect(mocks.mounts).toEqual({ welcome: 1, guide: 2 });
  });

  describe('guide page on a first visit', () => {
    const welcomed: User = {
      ...newAccount,
      welcomeTutorialSeenAt: '2026-09-25T12:00:00.000Z',
      pageHintsSeen: {},
    };

    beforeEach(() => {
      mocks.user = welcomed;
      mocks.post.mockResolvedValue({ data: { pageHintsSeen: { dashboard: 2 } } });
    });

    afterEach(() => {
      document.body.querySelector('.MuiModal-root')?.remove();
    });

    it('opens the guide on this page alone and records the close at the current version', async () => {
      await renderHost();

      expect(shown('guide')?.getAttribute('data-page')).toBe('dashboard');
      await close('guide');

      expect(shown('guide')).toBeNull();
      expect(mocks.post).toHaveBeenCalledWith('/users/me/page-hints', {
        page: 'dashboard',
        version: 2,
      });
    });

    it('does not open again once closed at the current version', async () => {
      mocks.user = { ...welcomed, pageHintsSeen: { dashboard: 2 } };
      await renderHost();
      expect(shown('guide')).toBeNull();
    });

    it('opens again for someone who saw only the old hint cards (version 1)', async () => {
      mocks.user = { ...welcomed, pageHintsSeen: { dashboard: 1 } };
      await renderHost();
      expect(shown('guide')?.getAttribute('data-page')).toBe('dashboard');
    });

    it('waits while the user object lacks the server record', async () => {
      const { pageHintsSeen: _omitted, ...withoutRecord } = welcomed;
      mocks.user = withoutRecord;
      await renderHost();
      expect(shown('guide')).toBeNull();
    });

    it('never opens over another window', async () => {
      const modal = document.createElement('div');
      modal.className = 'MuiModal-root';
      document.body.append(modal);
      await renderHost();
      expect(shown('guide')).toBeNull();
    });

    it('stays closed on a page the guide does not cover or the sidebar hides', async () => {
      mocks.pathname = '/goals';
      await renderHost();
      expect(shown('guide')).toBeNull();
    });
  });
});
