// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { IntlayerProviderContent } from 'react-intlayer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@/app/contexts/AuthContext';
import { apiResponse } from '@/app/test/api-response';
import { workspaceSummary } from '@/app/test/fixtures/contracts';
import { greetingName } from './greeting-name';
import WelcomeWindow from './WelcomeWindow';
import { APP_NAME } from '@/app/lib/brand';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  post: vi.fn(),
  switchWorkspace: vi.fn(),
  calls: [] as string[],
  user: null as User | null,
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/app/hooks/useAuth', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/app/lib/api', () => ({ default: { post: mocks.post } }));
vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspaceActions: () => ({ switchWorkspace: mocks.switchWorkspace }),
}));

const person = (name: string): User => ({ id: 'user-1', email: 'mia@example.com', name, role: 'user' });

function renderWindow(onClose = vi.fn()) {
  render(
    <IntlayerProviderContent locale="en" setLocale={() => undefined}>
      <WelcomeWindow open onClose={onClose} />
    </IntlayerProviderContent>,
  );
  return onClose;
}

const click = (name: string): void => {
  fireEvent.click(screen.getByRole('button', { name }));
};

describe('greetingName', () => {
  it('takes the first word of a real name', () => {
    expect(greetingName('  Mia Hoffmann ')).toBe('Mia');
  });

  it('has no name for an empty one or the technical default', () => {
    expect(greetingName('')).toBeNull();
    expect(greetingName(undefined)).toBeNull();
    expect(greetingName('Administrator')).toBeNull();
    expect(greetingName('administrator')).toBeNull();
  });
});

describe('WelcomeWindow', () => {
  beforeEach(() => {
    mocks.user = person('Mia Hoffmann');
    mocks.calls = [];
    mocks.push.mockReset().mockImplementation((route: string) => mocks.calls.push(`push ${route}`));
    mocks.post.mockReset().mockImplementation(async (url: string, body: unknown) => {
      mocks.calls.push(`post ${url} ${JSON.stringify(body)}`);
      return apiResponse(workspaceSummary({ id: 'demo-1', name: 'Demo' }));
    });
    mocks.switchWorkspace.mockReset().mockImplementation(async (id: string) => {
      mocks.calls.push(`switch ${id}`);
    });
  });

  it('greets the person by first name', () => {
    renderWindow();
    expect(screen.getByRole('dialog', { name: `Welcome to ${APP_NAME}, Mia` })).toBeTruthy();
  });

  it('does not greet the technical admin account by name', () => {
    mocks.user = person('Administrator');
    renderWindow();
    expect(screen.getByRole('dialog', { name: `Welcome to ${APP_NAME}` })).toBeTruthy();
  });

  it('offers three ways in and promises no tour', () => {
    renderWindow();
    expect(screen.getByRole('button', { name: 'Upload your first statement' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Explore with demo data' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeTruthy();
    expect(screen.queryByText(/tour|minute/i)).toBeNull();
  });

  it('closes and opens the upload for the first statement', () => {
    const onClose = renderWindow();
    click('Upload your first statement');

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mocks.push).toHaveBeenCalledWith('/statements?upload=1');
  });

  it('closes on Skip, on the close icon and on Escape', () => {
    const onClose = renderWindow();
    click('Skip');
    click('Close modal');
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(3);
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('builds the demo workspace, opens it and goes to the overview', async () => {
    const onClose = renderWindow();
    await act(async () => {
      click('Explore with demo data');
    });

    expect(mocks.calls).toEqual([
      'post /workspaces/demo {"name":"Demo"}',
      'switch demo-1',
      'push /dashboard',
    ]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays open with a line under the buttons when the demo cannot be built', async () => {
    mocks.post.mockRejectedValue(new Error('down'));
    const onClose = renderWindow();
    await act(async () => {
      click('Explore with demo data');
    });

    expect(screen.getByRole('alert').textContent).toMatch(/demo workspace/);
    expect(onClose).not.toHaveBeenCalled();
    expect(mocks.switchWorkspace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Explore with demo data' })).not.toHaveProperty(
      'disabled',
      true,
    );
  });
});
