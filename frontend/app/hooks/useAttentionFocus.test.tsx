import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigationMocks = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => navigationMocks.searchParams,
}));

import { useAttentionFocus } from './useAttentionFocus';

function Probe(): null {
  useAttentionFocus();
  return null;
}

function setup(params: string, markup = '') {
  navigationMocks.searchParams = new URLSearchParams(params);
  window.history.replaceState(null, '', `/dashboard${params ? `?${params}` : ''}`);
  document.body.innerHTML = markup;
  return render(<Probe />);
}

describe('useAttentionFocus', () => {
  beforeEach(() => {
    // jsdom has no layout, so scrollIntoView is not implemented on elements.
    Element.prototype.scrollIntoView = vi.fn();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('rings the target named in the URL and scrolls it into view', () => {
    setup('focus=kpi:savings-rate', '<div id="t" data-attention="kpi:savings-rate"></div>');
    const target = document.getElementById('t');

    expect(target?.classList.contains('seneca-attention')).toBe(true);
    expect(target?.scrollIntoView).toHaveBeenCalledWith({
      block: 'center',
      behavior: 'smooth',
    });
  });

  it('keeps the ring through a re-render', () => {
    // The param is cleared through history rather than the router precisely so
    // this effect is not re-run and torn down the instant it highlights.
    const { rerender } = setup(
      'focus=card:risk',
      '<div id="t" data-attention="card:risk"></div>',
    );

    rerender(<Probe />);

    expect(document.getElementById('t')?.classList.contains('seneca-attention')).toBe(true);
  });

  it('lets the ring fade after three seconds', () => {
    setup('focus=card:risk', '<div id="t" data-attention="card:risk"></div>');
    expect(document.getElementById('t')?.classList.contains('seneca-attention')).toBe(true);

    vi.advanceTimersByTime(3000);

    expect(document.getElementById('t')?.classList.contains('seneca-attention')).toBe(false);
  });

  it('rings every member of a group and scrolls to the first', () => {
    setup(
      'focus=price-changed',
      '<div id="a" data-attention="subscription:1" data-attention-group="price-changed"></div>' +
        '<div id="b" data-attention="subscription:2"></div>' +
        '<div id="c" data-attention="subscription:3" data-attention-group="overdue price-changed"></div>',
    );
    const ringed = (id: string) =>
      document.getElementById(id)?.classList.contains('seneca-attention');

    expect([ringed('a'), ringed('b'), ringed('c')]).toEqual([true, false, true]);
    expect(document.getElementById('a')?.scrollIntoView).toHaveBeenCalled();

    vi.advanceTimersByTime(3000);

    expect([ringed('a'), ringed('c')]).toEqual([false, false]);
  });

  it('waits for a group that is drawn after the page arrives', async () => {
    setup('focus=price-changed');
    document.body.innerHTML =
      '<div id="a" data-attention-group="price-changed"></div>' +
      '<div id="b" data-attention-group="price-changed"></div>';

    await waitFor(() =>
      expect(document.getElementById('b')?.classList.contains('seneca-attention')).toBe(true),
    );
    expect(document.getElementById('a')?.classList.contains('seneca-attention')).toBe(true);
  });

  it('takes the first match when a category spans several rows', () => {
    setup(
      'focus=category:travel',
      '<div id="big" data-attention="category:travel"></div>' +
        '<div id="small" data-attention="category:travel"></div>',
    );

    expect(document.getElementById('big')?.classList.contains('seneca-attention')).toBe(true);
    expect(document.getElementById('small')?.classList.contains('seneca-attention')).toBe(false);
  });

  it('waits for a target that renders once its data arrives', async () => {
    setup('focus=category:travel');
    expect(document.querySelector('.seneca-attention')).toBeNull();

    const late = document.createElement('div');
    late.dataset.attention = 'category:travel';
    document.body.appendChild(late);

    await waitFor(() => expect(late.classList.contains('seneca-attention')).toBe(true));
  });

  it('drops the parameter and keeps the rest of the query', () => {
    setup('focus=card:risk&tab=overview', '<div data-attention="card:risk"></div>');

    expect(window.location.pathname + window.location.search).toBe('/dashboard?tab=overview');
  });

  it('stays silent when the target never appears', () => {
    // Insights written by hand carry no id, and an empty workspace renders no rows.
    setup('focus=category:nothing-here', '<div data-attention="card:risk"></div>');

    expect(document.querySelector('.seneca-attention')).toBeNull();
    expect(window.location.pathname + window.location.search).toBe('/dashboard');
  });

  it('does nothing without the parameter', () => {
    setup('', '<div data-attention="card:risk"></div>');

    expect(document.querySelector('.seneca-attention')).toBeNull();
  });
});
