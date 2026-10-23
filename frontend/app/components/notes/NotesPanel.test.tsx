import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotesPanel } from './NotesPanel';

const addNote = vi.fn();

vi.mock('@/app/hooks/useNotes', () => ({
  useNotes: () => ({
    notes: [],
    isPending: false,
    addNote,
    isAdding: false,
    setResolved: vi.fn(),
    deleteNote: vi.fn(),
  }),
  useWorkspaceMembers: () => [],
}));

vi.mock('@/app/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));

vi.mock('@/app/i18n', () => ({
  useIntlayer: () =>
    new Proxy({}, { get: (_target, key) => ({ value: String(key), toString: () => String(key) }) }),
  useLocale: () => ({ locale: 'en' }),
}));

const note = 'Paid back by Member One';

function typeNote(text: string): HTMLTextAreaElement {
  const field = screen.getByRole('textbox') as HTMLTextAreaElement;
  fireEvent.change(field, { target: { value: text } });
  return field;
}

describe('NotesPanel saves what is typed', () => {
  beforeEach(() => {
    addNote.mockReset();
    addNote.mockResolvedValue(undefined);
  });

  it('when the field loses focus', async () => {
    render(<NotesPanel entityType="transaction" entityId="tx-1" showTitle={false} />);
    fireEvent.blur(typeNote(note));
    expect(addNote).toHaveBeenCalledWith({ body: note, mentionedUserIds: [] });
  });

  it('when the panel closes with the text still in it', () => {
    const { unmount } = render(
      <NotesPanel entityType="transaction" entityId="tx-1" showTitle={false} />,
    );
    typeNote(note);
    unmount();
    expect(addNote).toHaveBeenCalledTimes(1);
    expect(addNote).toHaveBeenCalledWith({ body: note, mentionedUserIds: [] });
  });

  it('once, when blur and closing come together', () => {
    addNote.mockReturnValue(new Promise(() => {}));
    const { unmount } = render(
      <NotesPanel entityType="transaction" entityId="tx-1" showTitle={false} />,
    );
    fireEvent.blur(typeNote(note));
    unmount();
    expect(addNote).toHaveBeenCalledTimes(1);
  });

  it('nothing when the field is empty', () => {
    const { unmount } = render(
      <NotesPanel entityType="transaction" entityId="tx-1" showTitle={false} />,
    );
    fireEvent.blur(typeNote('   '));
    unmount();
    expect(addNote).not.toHaveBeenCalled();
  });
});
