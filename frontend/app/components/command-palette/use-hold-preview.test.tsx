// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HOLD_PREVIEW_MS, useHoldPreview } from './use-hold-preview';
import type { SearchResultDocument } from './use-palette-sections';

const RECEIPT: SearchResultDocument = { source: 'receipt', id: 'r-1', fileName: 'acme-store.pdf' };

function Field({ document }: { document: SearchResultDocument | null }): React.JSX.Element {
  const [value, setValue] = useState('acme');
  const { onKeyDown, previewing } = useHoldPreview(document, setValue);
  return (
    <>
      <input
        aria-label="query"
        value={value}
        onChange={event => setValue(event.target.value)}
        onKeyDown={event => {
          onKeyDown(event);
        }}
      />
      {previewing && <output>{previewing.fileName}</output>}
    </>
  );
}

function field(): HTMLInputElement {
  return screen.getByLabelText('query') as HTMLInputElement;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useHoldPreview', () => {
  it('shows the file while Space is held and hides it on release', () => {
    render(<Field document={RECEIPT} />);
    fireEvent.keyDown(field(), { code: 'Space', key: ' ' });
    expect(screen.queryByRole('status')).toBeNull();

    act(() => vi.advanceTimersByTime(HOLD_PREVIEW_MS));
    fireEvent.keyDown(field(), { code: 'Space', key: ' ', repeat: true });
    expect(screen.getByRole('status').textContent).toBe(RECEIPT.fileName);
    expect(field().value).toBe('acme');

    fireEvent.keyUp(window, { code: 'Space', key: ' ' });
    expect(screen.queryByRole('status')).toBeNull();
    expect(field().value).toBe('acme');
  });

  it('types a space at the caret on a quick tap', () => {
    render(<Field document={RECEIPT} />);
    field().setSelectionRange(2, 2);
    fireEvent.keyDown(field(), { code: 'Space', key: ' ' });
    fireEvent.keyUp(window, { code: 'Space', key: ' ' });
    act(() => vi.advanceTimersByTime(HOLD_PREVIEW_MS));

    expect(field().value).toBe('ac me');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('leaves Space to the field when the row has no file', () => {
    render(<Field document={null} />);
    const event = fireEvent.keyDown(field(), { code: 'Space', key: ' ' });
    act(() => vi.advanceTimersByTime(HOLD_PREVIEW_MS));

    // Not cancelled: the browser types the space itself.
    expect(event).toBe(true);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
