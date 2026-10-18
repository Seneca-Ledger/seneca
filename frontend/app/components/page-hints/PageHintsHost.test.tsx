// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { IntlayerProviderContent } from 'react-intlayer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@/app/contexts/AuthContext';
import { apiResponse } from '@/app/test/api-response';
import { ANCHOR_WAIT_MS } from './useHintAnchors';

const LIMIT = '[data-hint="budgets-new"]';
const STOIC = '[data-hint="stoic-balance"]';

const mocks = vi.hoisted(() => ({
  pathname: '/budgets',
  user: null as User | null,
  setUser: vi.fn(),
  post: vi.fn(),
  small: false,
  covered: false,
  anchors: {} as Record<string, HTMLElement | null>,
}));

vi.mock('next/navigation', () => ({ usePathname: () => mocks.pathname }));
vi.mock('@/app/hooks/useAuth', () => ({
  useAuth: () => ({ user: mocks.user, loading: false, setUser: mocks.setUser }),
}));
vi.mock('@/app/lib/api', () => ({ default: { post: mocks.post } }));
vi.mock('@mui/material/useMediaQuery', () => ({ default: () => mocks.small }));
// jsdom has no layout, so what is "on the page and visible" is decided here.
vi.mock('./page-hints-dom', () => ({
  findVisibleAnchor: (selector: string) => mocks.anchors[selector] ?? null,
  isPageCovered: () => mocks.covered,
}));

const user: User = {
  id: 'user-1',
  email: 'mia@example.com',
  name: 'Mia',
  role: 'user',
  onboardingCompletedAt: '2026-09-25T10:00:00.000Z',
  welcomeTutorialSeenAt: '2026-09-25T10:05:00.000Z',
  pageHintsSeen: {},
};

function anchor(name: string): HTMLElement {
  const element = document.createElement('button');
  element.textContent = name;
  document.body.append(element);
  return element;
}

async function renderHost() {
  const { PageHintsHost } = await import('./PageHintsHost');
  const view = render(
    <IntlayerProviderContent locale="en" setLocale={() => undefined}>
      <PageHintsHost />
    </IntlayerProviderContent>,
  );
  await tick(300);
  return view;
}

async function tick(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const hint = (): HTMLElement | null => screen.queryByRole('dialog');
const click = (name: string): void => {
  fireEvent.click(screen.getByRole('button', { name }));
};

describe('PageHintsHost', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.pathname = '/budgets';
    mocks.user = user;
    mocks.small = false;
    mocks.covered = false;
    mocks.anchors = { [LIMIT]: anchor('New budget'), [STOIC]: anchor('Stoic balance') };
    mocks.setUser.mockReset();
    mocks.post.mockReset().mockResolvedValue(apiResponse({ pageHintsSeen: { budgets: 1 } }));
  });

  afterEach(() => {
    cleanup();
    for (const element of Object.values(mocks.anchors)) element?.remove();
    vi.useRealTimers();
  });

  it('walks through the page’s steps beside their elements and records the close', async () => {
    await renderHost();

    expect(hint()?.getAttribute('aria-modal')).toBe('false');
    expect(screen.getByRole('heading', { name: 'A limit per category' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Step 1 of 2' })).toBeTruthy();
    // Points at the live element, and leaves the focus where it was.
    expect(mocks.anchors[LIMIT]?.hasAttribute('data-hint-active')).toBe(true);
    expect(document.activeElement).toBe(document.body);

    click('Next');
    expect(screen.getByRole('heading', { name: 'Stoic balance' })).toBeTruthy();
    expect(mocks.anchors[STOIC]?.hasAttribute('data-hint-active')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();

    click('Got it');
    expect(hint()).toBeNull();
    expect(mocks.post).toHaveBeenCalledWith('/users/me/page-hints', { page: 'budgets', version: 1 });
    // Merged into the user the app holds, not replacing it.
    const update = mocks.setUser.mock.calls[0]?.[0] as (current: User | null) => User | null;
    expect(update({ ...user, avatarUrl: 'a.png', pageHintsSeen: { dashboard: 1 } })).toMatchObject({
      avatarUrl: 'a.png',
      pageHintsSeen: { dashboard: 1, budgets: 1 },
    });
  });

  it('closes every step at once with Close', async () => {
    await renderHost();
    click('Close');

    expect(hint()).toBeNull();
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape and records the page’s version', async () => {
    await renderHost();
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(hint()).toBeNull();
    expect(mocks.post).toHaveBeenCalledWith('/users/me/page-hints', { page: 'budgets', version: 1 });
  });

  it('shows nothing once the page’s version was seen', async () => {
    mocks.user = { ...user, pageHintsSeen: { budgets: 1 } };
    await renderHost();
    expect(hint()).toBeNull();
  });

  // An older cached user object must not read as "nothing seen yet".
  it('shows nothing when the user object does not carry the field', async () => {
    const { pageHintsSeen: _omitted, ...withoutField } = user;
    mocks.user = withoutField;
    await renderHost();
    expect(hint()).toBeNull();
  });

  it('waits for the welcome window', async () => {
    mocks.user = { ...user, welcomeTutorialSeenAt: null };
    await renderHost();
    expect(hint()).toBeNull();
  });

  it('waits while a dialog covers the page and shows once it closes', async () => {
    mocks.covered = true;
    await renderHost();
    await tick(ANCHOR_WAIT_MS * 2);
    expect(hint()).toBeNull();

    mocks.covered = false;
    await tick(300);
    expect(screen.getByRole('heading', { name: 'A limit per category' })).toBeTruthy();
  });

  it('hides while a dialog opens over it, without recording anything', async () => {
    await renderHost();
    mocks.covered = true;
    await tick(300);

    expect(hint()).toBeNull();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('drops a step whose element never turns up', async () => {
    mocks.anchors[STOIC] = null;
    await renderHost();
    expect(hint()).toBeNull();

    await tick(ANCHOR_WAIT_MS);
    expect(screen.getByRole('heading', { name: 'A limit per category' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Got it' })).toBeTruthy();
  });

  it('shows nothing when no element turns up', async () => {
    mocks.anchors = {};
    await renderHost();
    await tick(ANCHOR_WAIT_MS * 2);
    expect(hint()).toBeNull();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('shows only the first step on a small screen, and closing it records the page', async () => {
    mocks.small = true;
    await renderHost();

    expect(screen.getByRole('heading', { name: 'A limit per category' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    expect(screen.queryByRole('img', { name: /Step/ })).toBeNull();

    click('Got it');
    expect(mocks.post).toHaveBeenCalledWith('/users/me/page-hints', { page: 'budgets', version: 1 });
  });

  it('hides on leaving the page without recording anything', async () => {
    const view = await renderHost();
    mocks.pathname = '/settings/profile';
    const { PageHintsHost } = await import('./PageHintsHost');
    view.rerender(
      <IntlayerProviderContent locale="en" setLocale={() => undefined}>
        <PageHintsHost />
      </IntlayerProviderContent>,
    );

    expect(hint()).toBeNull();
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.anchors[LIMIT]?.hasAttribute('data-hint-active')).toBe(false);
  });
});
