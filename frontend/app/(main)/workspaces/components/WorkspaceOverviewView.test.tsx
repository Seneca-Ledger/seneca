// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const deleteMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());
const refreshWorkspacesMock = vi.hoisted(() => vi.fn());
const clearWorkspaceMock = vi.hoisted(() => vi.fn());
const updateWorkspaceBackgroundMock = vi.hoisted(() => vi.fn());
const currentWorkspaceMock = vi.hoisted(() => ({
  id: 'ws-1',
  name: 'Denis workspace',
  description: 'Workspace description',
  currency: 'EUR',
  backgroundImage: null as string | null,
  backgroundAttribution: null as string | null,
  backgroundSourceUrl: null as string | null,
  settings: {},
  memberRole: 'owner',
}));

vi.mock('next/image', () => ({
  default: ({
    alt,
    fill: Fill,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => (
    <img {...props} alt={alt ?? ''} />
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock('@/app/lib/api', () => ({
  default: {
    delete: deleteMock,
    // The tax jurisdiction section fetches on mount. Empty responses keep it
    // out of the way of the tests in this file, which are about the workspace
    // form; TaxJurisdictionSection.test.tsx covers its behaviour.
    get: vi.fn(async (url: string) =>
      url === '/tax/settings'
        ? { data: { jurisdiction: null, vatStatus: 'not_registered' } }
        : { data: [] },
    ),
    put: vi.fn(async () => ({ data: {} })),
  },
}));

vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({
    currentWorkspace: currentWorkspaceMock,
    refreshWorkspaces: refreshWorkspacesMock,
    clearWorkspace: clearWorkspaceMock,
    updateWorkspaceBackground: updateWorkspaceBackgroundMock,
  }),
}));

// Reads the VAT status and the reserve through React Query; TaxStatusSection.test.tsx covers it.
vi.mock('./TaxStatusSection', () => ({ TaxStatusSection: () => null }));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import WorkspaceOverviewView from './WorkspaceOverviewView';

describe('WorkspaceOverviewView', () => {
  beforeEach(() => {
    deleteMock.mockReset();
    replaceMock.mockReset();
    refreshWorkspacesMock.mockReset();
    clearWorkspaceMock.mockReset();
    updateWorkspaceBackgroundMock.mockReset();
    deleteMock.mockResolvedValue(undefined);
    refreshWorkspacesMock.mockResolvedValue(undefined);
    updateWorkspaceBackgroundMock.mockResolvedValue(undefined);
  });

  it('renders currency picker trigger instead of native select', async () => {
    const html = renderToStaticMarkup(<WorkspaceOverviewView />);

    expect(html).toContain('data-testid="workspace-currency-trigger"');
    expect(html).not.toContain('<select');
    expect(html).not.toContain('Plan type');
    expect(html).not.toContain('Company address');
  });

  it('uses a compact overview layout to reduce page scrolling', () => {
    render(<WorkspaceOverviewView />);

    const description = screen.getByLabelText('Description') as HTMLTextAreaElement;
    expect(description.rows).toBe(2);
    expect(description.style.minHeight).toBe('80px');
  });

  it('renders background preview in the top section and keeps selector inside drawer content', async () => {
    const html = renderToStaticMarkup(<WorkspaceOverviewView />);

    expect(html).toContain('data-testid="workspace-background-trigger"');
    expect(html).toContain('Workspace background');
    expect(html).not.toContain('lg:grid-cols-[220px_minmax(0,1fr)]');
  });

  it('opens workspace background selection in a drawer', async () => {
    render(<WorkspaceOverviewView />);

    fireEvent.click(screen.getByTestId('workspace-background-trigger'));

    expect(await screen.findByText('Select workspace background')).toBeTruthy();
    expect(screen.getByAltText('Fjord between grey peaks under clouds')).toBeTruthy();
  });

  it('updates the current workspace background by id', async () => {
    render(<WorkspaceOverviewView />);

    fireEvent.click(screen.getByTestId('workspace-background-trigger'));
    fireEvent.click(await screen.findByAltText('Fjord between grey peaks under clouds'));

    await waitFor(() => {
      expect(updateWorkspaceBackgroundMock).toHaveBeenCalledWith({
        workspaceId: 'ws-1',
        backgroundImage: 'ferdinand-stohr-W1FIkdPAB7E-unsplash.jpg',
      });
    });
  });

  it('credits a searched background photo under the preview', async () => {
    Object.assign(currentWorkspaceMock, {
      backgroundImage: '/uploads/workspace-backgrounds/photo.jpg',
      backgroundAttribution: '"Fjord" by Ann is licensed under CC BY 2.0.',
      backgroundSourceUrl: 'https://www.flickr.com/photos/ann/1',
    });
    try {
        render(<WorkspaceOverviewView />);

      const credit = screen.getByTestId('workspace-background-credit');
      expect(credit.textContent).toContain('"Fjord" by Ann is licensed under CC BY 2.0.');
      expect(screen.getByRole('link', { name: 'Source' }).getAttribute('href')).toBe(
        'https://www.flickr.com/photos/ann/1',
      );
    } finally {
      Object.assign(currentWorkspaceMock, {
        backgroundImage: null,
        backgroundAttribution: null,
        backgroundSourceUrl: null,
      });
    }
  });

  it('shows no credit line for a bundled background', async () => {
    render(<WorkspaceOverviewView />);

    expect(screen.queryByTestId('workspace-background-credit')).toBeNull();
  });

  it('uses dark-safe text styles in the workspace background drawer', async () => {
    render(<WorkspaceOverviewView />);

    fireEvent.click(screen.getByTestId('workspace-background-trigger'));

    const title = await screen.findByText('Select workspace background');
    const help = screen.getByText('Choose the image shown on your workspace card.');

    // Theme variables, which flip with the theme, rather than light-only colours.
    expect(getComputedStyle(title).color).toBe('var(--foreground)');
    expect(getComputedStyle(help).color).toBe('var(--text-muted)');
  });

  it('uses dark-safe styles in the workspace currency drawer', async () => {
    render(<WorkspaceOverviewView />);

    fireEvent.click(screen.getByTestId('workspace-currency-trigger'));

    const title = await screen.findByText('Select a currency');
    const searchInput = screen.getByPlaceholderText('Search') as HTMLInputElement;
    const selectedButton = screen
      .getAllByRole('button')
      .find(
        button =>
          button.textContent?.includes('EUR - €') &&
          button !== screen.getByTestId('workspace-currency-trigger'),
      ) as HTMLButtonElement;

    expect(title).toBeTruthy();
    // Theme variables, which flip with the theme, rather than light-only colours.
    expect(searchInput.style.background).toBe('var(--card-bg)');
    expect(searchInput.style.border).toContain('var(--border-color)');

    expect(getComputedStyle(selectedButton).backgroundColor).toBe('var(--muted)');
    expect(selectedButton.textContent).toContain('EUR - €');
  });

  it('does not show recents before a currency was selected in this session', async () => {
    render(<WorkspaceOverviewView />);

    fireEvent.click(screen.getByTestId('workspace-currency-trigger'));

    await screen.findByText('Select a currency');

    expect(screen.queryByText('Recents')).toBeNull();
  });

  it('shows the previous currency in recents after changing currency', async () => {
    render(<WorkspaceOverviewView />);

    fireEvent.click(screen.getByTestId('workspace-currency-trigger'));
    const usdOption = await screen.findByText('USD - $');
    fireEvent.click(usdOption.closest('button') as HTMLButtonElement);

    await waitFor(() => {
      expect(screen.getByTestId('workspace-currency-trigger').textContent).toContain('USD - $');
    });

    fireEvent.click(screen.getByTestId('workspace-currency-trigger'));

    expect(await screen.findByText('Recents')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'EUR - €' }).length).toBeGreaterThan(0);
  });

  it('requires typing the workspace name before enabling delete confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<WorkspaceOverviewView />);

    fireEvent.click(screen.getByRole('button', { name: /delete workspace/i }));

    const deleteDialog = await screen.findByRole('dialog');
    expect(screen.getByText('Delete workspace?')).toBeTruthy();
    expect(deleteDialog.textContent).toContain(
      'This will permanently delete the workspace and all related data.',
    );
    expect(confirmSpy).not.toHaveBeenCalled();

    const confirmButton = screen.getByRole('button', { name: /^delete$/i });
    const nameInput = screen
      .getByRole('dialog')
      .querySelector('#delete-workspace-name') as HTMLInputElement;

    expect(confirmButton).toBeDisabled();

    fireEvent.change(nameInput, { target: { value: 'Wrong name' } });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(nameInput, { target: { value: 'Denis workspace' } });
    expect(confirmButton).not.toBeDisabled();

    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith('/workspaces/ws-1');
    });
    expect(clearWorkspaceMock).toHaveBeenCalled();
    expect(refreshWorkspacesMock).toHaveBeenCalled();
    expect(replaceMock).toHaveBeenCalledWith('/workspaces/list');

    confirmSpy.mockRestore();
  });
});
