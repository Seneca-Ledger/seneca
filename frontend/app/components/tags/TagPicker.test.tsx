// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StorageTag, TagListItem } from '@/app/lib/contracts';
import { apiResponse } from '@/app/test/api-response';
import { storageFileDetails } from '@/app/test/fixtures/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import '@/app/components/dashboard/test-setup';
import { ReceiptTagsField, StatementTagsField } from './RecordTagsField';
import { TagPicker } from './TagPicker';

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), patch: vi.fn(), post: vi.fn() }));

vi.mock('@/app/lib/api', () => ({ default: api }));
vi.mock('@/app/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({ currentWorkspace: { id: 'w1' } }),
}));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));

const listItem = (id: string, name: string): TagListItem => ({
  id,
  name,
  color: null,
  description: null,
  tagDate: null,
  usageCount: 0,
});
const project = listItem('tag-project', 'Project Alpha');
const trip = listItem('tag-trip', 'Summer Trip');
const asTag = ({ id, name, color }: TagListItem): StorageTag => ({ id, name, color });

function serveTags(
  extra: (url: string) => unknown = () => undefined,
  tags: TagListItem[] = [trip, project],
) {
  api.get.mockImplementation((url: string) => {
    if (url === '/tags') return Promise.resolve(apiResponse(tags));
    const data = extra(url);
    return data === undefined
      ? Promise.reject(new Error(`Unexpected GET ${url}`))
      : Promise.resolve(apiResponse(data));
  });
}

describe('TagPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serveTags();
  });

  it('shows the attached tags and lists every tag in the drawer, attached ones checked', async () => {
    renderWithQuery(<TagPicker value={[asTag(trip)]} onChange={vi.fn()} />);

    expect(screen.getByText(trip.name)).toBeInTheDocument();
    // The chip leads with the tag icon, like the Tag column and the Tags page.
    expect(
      screen.getByText(trip.name).closest('.seneca-tag-picker__chip')?.querySelector('[data-testid="LocalOfferIcon"]'),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }));

    const drawer = await screen.findByRole('presentation');
    expect(await within(drawer).findByRole('button', { name: project.name })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(within(drawer).getByRole('button', { name: trip.name })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('toggles tags from the drawer and removes them from the chips', async () => {
    const onChange = vi.fn();
    renderWithQuery(<TagPicker value={[asTag(trip)]} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: `Remove ${trip.name}` }));
    expect(onChange).toHaveBeenLastCalledWith([]);

    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }));
    const drawer = await screen.findByRole('presentation');
    fireEvent.click(await within(drawer).findByRole('button', { name: project.name }));
    expect(onChange).toHaveBeenLastCalledWith([asTag(trip), asTag(project)]);

    fireEvent.click(within(drawer).getByRole('button', { name: trip.name }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('filters the drawer by the search', async () => {
    renderWithQuery(<TagPicker value={[]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }));
    const drawer = await screen.findByRole('presentation');
    await within(drawer).findByRole('button', { name: project.name });

    fireEvent.change(within(drawer).getByPlaceholderText('Search tags'), {
      target: { value: 'summer' },
    });
    expect(within(drawer).queryByRole('button', { name: project.name })).not.toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: trip.name })).toBeInTheDocument();

    fireEvent.change(within(drawer).getByPlaceholderText('Search tags'), {
      target: { value: 'nothing like it' },
    });
    expect(within(drawer).getByText('No tags match the search')).toBeInTheDocument();
  });

  it('says there are no tags yet and attaches a tag created from the drawer', async () => {
    const created = asTag(listItem('tag-new', 'Office Move'));
    serveTags(undefined, []);
    api.post.mockResolvedValue(apiResponse({ ...created, description: null, tagDate: null }));
    const onChange = vi.fn();
    renderWithQuery(<TagPicker value={[]} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }));
    const drawer = await screen.findByRole('presentation');
    expect(await within(drawer).findByText('No tags yet')).toBeInTheDocument();

    fireEvent.click(within(drawer).getByRole('button', { name: 'Create a new tag' }));
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: created.name } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith([created]));
  });
});

describe('ReceiptTagsField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serveTags(url => (url === '/receipts/rcpt-1/tags' ? [asTag(trip)] : undefined));
    api.put.mockResolvedValue(apiResponse([asTag(trip), asTag(project)]));
  });

  it('loads the receipt tags and saves the whole new set with PUT', async () => {
    renderWithQuery(<ReceiptTagsField receiptId="rcpt-1" />);

    expect(await screen.findByText(trip.name)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }));
    const drawer = await screen.findByRole('presentation');
    fireEvent.click(await within(drawer).findByRole('button', { name: project.name }));

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/receipts/rcpt-1/tags', {
        tagIds: [trip.id, project.id],
      }),
    );
  });
});

describe('StatementTagsField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.patch.mockResolvedValue(apiResponse({}));
  });

  it('saves a removal with PATCH on the storage file', async () => {
    serveTags(url =>
      url === '/storage/files/stmt-1' ? storageFileDetails('stmt-1', [asTag(trip)]) : undefined,
    );
    renderWithQuery(<StatementTagsField statementId="stmt-1" />);

    fireEvent.click(await screen.findByRole('button', { name: `Remove ${trip.name}` }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/storage/files/stmt-1/tags', { tagIds: [] }),
    );
  });
});
