// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { GettingStartedCard } from './GettingStartedCard';
import type { SetupProgress } from './use-setup-progress';

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
const auth = vi.hoisted(() => ({ name: 'Symon Baikov' }));

vi.mock('@/app/lib/api', () => ({ default: api }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1', name: auth.name } }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/app/i18n', async () => {
  const { autoDictionary, value } = await import('./__tests__/intlayer-mock');
  return {
    useIntlayer: () =>
      autoDictionary({
        subtitle: value("{{name}}, let's finish setting up your account"),
        subtitleNoName: value("Let's finish setting up your account"),
        progressLabel: value('{{done}} of {{total}} steps done'),
        completedItems: value('Completed items'),
        next: value('Next'),
        exploreOnMyOwn: value("I'll explore on my own"),
        uploadTitle: value('Upload a statement or receipt'),
        categoriesTitle: value('Customize categories'),
        budgetTitle: value('Create a budget'),
        goalTitle: value('Create a goal'),
        telegramTitle: value('Connect Telegram'),
      }),
  };
});

const NOTHING: SetupProgress = {
  hasUpload: false,
  hasCustomCategories: false,
  hasBudget: false,
  hasGoal: false,
  telegramAvailable: false,
  hasTelegram: false,
};

function serve(progress: SetupProgress, saved: Record<string, unknown> | null = null) {
  api.get.mockImplementation((url: string) =>
    Promise.resolve({
      data: url === '/dashboard/setup-progress' ? progress : { state: saved },
    }),
  );
}

describe('GettingStartedCard', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.put.mockReset().mockResolvedValue({ data: {} });
    auth.name = 'Symon Baikov';
  });

  it('does not greet the technical account name of a fresh install', async () => {
    auth.name = 'Administrator';
    serve(NOTHING);

    renderWithQuery(<GettingStartedCard />);

    expect(await screen.findByText("Let's finish setting up your account")).toBeInTheDocument();
    expect(screen.queryByText(/Administrator/)).not.toBeInTheDocument();
  });

  it('greets by first name and counts what is done', async () => {
    serve({ ...NOTHING, hasUpload: true, hasBudget: true });

    renderWithQuery(<GettingStartedCard />);

    expect(
      await screen.findByText("Symon, let's finish setting up your account"),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '2 of 4 steps done' })).toHaveTextContent('2/4');
  });

  it('marks the first open step as next and links each step to its page', async () => {
    serve({ ...NOTHING, hasUpload: true });

    renderWithQuery(<GettingStartedCard />);

    const categories = await screen.findByRole('link', { name: /Customize categories/ });
    expect(categories).toHaveTextContent('Next');
    expect(categories).toHaveAttribute('href', '/categories');
    expect(screen.getByRole('link', { name: /Create a goal/ })).not.toHaveTextContent('Next');
    expect(screen.getByRole('link', { name: /Create a goal/ })).toHaveAttribute('href', '/goals');
  });

  it('keeps completed steps folded away until asked', async () => {
    serve({ ...NOTHING, hasUpload: true });

    renderWithQuery(<GettingStartedCard />);

    const toggle = await screen.findByRole('button', { name: /Completed items \(1\)/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: /Upload a statement/ })).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(screen.getByRole('link', { name: /Upload a statement/ })).toBeInTheDocument();
  });

  it('goes away for good when dismissed', async () => {
    serve(NOTHING);

    renderWithQuery(<GettingStartedCard />);
    fireEvent.click(await screen.findByRole('button', { name: "I'll explore on my own" }));

    expect(api.put).toHaveBeenCalledWith('/view-preferences/onboarding', {
      state: { gettingStartedDismissedAt: expect.any(String) },
    });
    await waitFor(() => expect(screen.queryByText('Create a goal')).not.toBeInTheDocument());
  });

  it('remembers that everything is done and draws nothing', async () => {
    serve({ ...NOTHING, hasUpload: true, hasCustomCategories: true, hasBudget: true, hasGoal: true });

    const { container } = renderWithQuery(<GettingStartedCard />);

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/view-preferences/onboarding', {
        state: { gettingStartedCompletedAt: expect.any(String) },
      }),
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('stays hidden once dismissed, even with steps left', async () => {
    serve(NOTHING, { gettingStartedDismissedAt: '2026-10-01T00:00:00.000Z' });

    const { container } = renderWithQuery(<GettingStartedCard />);

    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    expect(container).toBeEmptyDOMElement();
    expect(api.put).not.toHaveBeenCalled();
  });

  it('offers connecting Telegram only when a bot serves the workspace', async () => {
    serve({ ...NOTHING, hasUpload: true, telegramAvailable: true });

    renderWithQuery(<GettingStartedCard />);

    const telegram = await screen.findByRole('link', { name: /Connect Telegram/ });
    expect(telegram).toHaveAttribute('href', '/settings/profile?tab=notifications&section=telegram');
    expect(screen.getByRole('img', { name: '1 of 5 steps done' })).toHaveTextContent('1/5');
  });

  it('leaves the Telegram step out without a bot, so four steps finish the list', async () => {
    serve({ ...NOTHING, hasUpload: true });

    renderWithQuery(<GettingStartedCard />);

    expect(await screen.findByRole('img', { name: '1 of 4 steps done' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Connect Telegram/ })).not.toBeInTheDocument();
  });

  it('is not done while Telegram can still be connected', async () => {
    serve({
      ...NOTHING,
      hasUpload: true,
      hasCustomCategories: true,
      hasBudget: true,
      hasGoal: true,
      telegramAvailable: true,
    });

    renderWithQuery(<GettingStartedCard />);

    expect(await screen.findByRole('link', { name: /Connect Telegram/ })).toHaveTextContent('Next');
    expect(api.put).not.toHaveBeenCalled();
  });
});
