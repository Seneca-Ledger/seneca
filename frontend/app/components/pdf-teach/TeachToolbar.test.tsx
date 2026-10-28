import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TeachToolbar } from './TeachToolbar';
import type { TeachSession } from './useTeachSession';

const session = (over: Partial<TeachSession> = {}): TeachSession => ({
  words: [],
  regions: [],
  activeTag: 'date',
  setActiveTag: vi.fn(),
  addRegion: vi.fn(),
  removeRegion: vi.fn(),
  missing: [],
  preview: null,
  reading: false,
  saving: false,
  save: vi.fn(async () => true),
  pageWidths: {},
  setPageWidth: vi.fn(),
  ...over,
});

const preview = {
  missing: [],
  transactions: 42,
  totalDebit: 5289.63,
  totalCredit: 6100,
  checks: [{ code: 'balance_chain', passed: true }],
  rows: [],
};

describe('TeachToolbar', () => {
  it('names what is still to mark and keeps saving off', () => {
    render(<TeachToolbar session={session({ missing: [['description']] })} onDone={vi.fn()} />);
    expect(screen.getByTestId('teach-toolbar').textContent).toContain('Description');
    expect(screen.getByRole('button', { name: /save/i })).toHaveProperty('disabled', true);
  });

  it('shows how the file reads and saves, then closes', async () => {
    const marks = session({ preview });
    const onDone = vi.fn();
    render(<TeachToolbar session={marks} onDone={onDone} />);
    const status = screen.getByTestId('teach-toolbar').textContent ?? '';
    expect(status).toContain('42');
    expect(status).toContain('5,289.63');
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await vi.waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(marks.save).toHaveBeenCalled();
  });

  it('warns when a check fails, and takes a tag by its number key', () => {
    const marks = session({
      preview: { ...preview, checks: [{ code: 'balance_chain', passed: false, row: 7 }] },
    });
    render(<TeachToolbar session={marks} onDone={vi.fn()} />);
    expect(screen.getByTestId('teach-toolbar').textContent).toContain('7');
    expect(document.querySelector('.seneca-pdf-teach__warning')).not.toBeNull();
    fireEvent.keyDown(document.body, { key: '3' });
    expect(marks.setActiveTag).toHaveBeenCalledWith('debit');
  });
});
