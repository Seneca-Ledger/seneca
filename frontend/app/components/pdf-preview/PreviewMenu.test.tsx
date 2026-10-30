import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PreviewMenu } from './PreviewMenu';

describe('PreviewMenu', () => {
  it('offers teaching again where the file can be taught, and closes after an item', () => {
    const onTeach = vi.fn();
    const onClose = vi.fn();
    render(
      <PreviewMenu
        downloadLabel="Download"
        onDownload={vi.fn()}
        teachLabel="Teach again"
        onTeach={onTeach}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByTestId('preview-teach-again'));
    expect(onClose).toHaveBeenCalled();
    expect(onTeach).toHaveBeenCalled();
  });

  it('has no teach item where the file cannot be taught', () => {
    render(
      <PreviewMenu
        downloadLabel="Download"
        onDownload={vi.fn()}
        teachLabel="Teach again"
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('preview-teach-again')).toBeNull();
  });
});
