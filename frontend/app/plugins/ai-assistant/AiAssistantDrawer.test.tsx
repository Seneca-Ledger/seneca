import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AiAssistantDrawer } from './AiAssistantDrawer';

describe('AiAssistantDrawer', () => {
  it('offers the goals and subscriptions prompts next to the others', () => {
    render(<AiAssistantDrawer isOpen onClose={vi.fn()} />);

    expect(screen.getByText('Goals & Runway')).toBeInTheDocument();
    expect(screen.getByText('Subscriptions Review')).toBeInTheDocument();
    expect(screen.getByText('Who pays you and who you pay most')).toBeInTheDocument();
    expect(screen.getAllByText('Open in ChatGPT')).toHaveLength(8);
  });
});
