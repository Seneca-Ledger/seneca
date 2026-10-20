// @vitest-environment jsdom
import Dialog from '@mui/material/Dialog';
import { render, screen, waitFor } from '@testing-library/react';
import { StrictMode, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { PaletteInput } from './PaletteInput';

/** The palette's own shape: a button opens a MUI dialog with the field inside. */
function Opener(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Search
      </button>
      <Dialog open={open} onClose={() => setOpen(false)}>
        {open && (
          <PaletteInput value="" onChange={() => {}} onKeyDown={() => {}} pending="" activeRowId={undefined} />
        )}
      </Dialog>
    </>
  );
}

describe('PaletteInput', () => {
  // Dev runs effects twice: in between, the dialog's focus trap hands focus back
  // to the button that opened it, then settles on the dialog itself.
  it('keeps focus in the field when a focused button opens the dialog under StrictMode', async () => {
    render(
      <StrictMode>
        <Opener />
      </StrictMode>,
    );
    const button = screen.getByRole('button', { name: 'Search' });
    button.focus();
    button.click();
    const input = await screen.findByRole('combobox');
    await waitFor(() => expect(document.activeElement).toBe(input));
  });
});
