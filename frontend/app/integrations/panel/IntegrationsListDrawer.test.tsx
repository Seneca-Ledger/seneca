// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Intlayer renders its own nodes; plain strings and a `.value` holder are
// enough to stand in for them here.
// The catalog dictionary is resolved to its English strings, each wrapped the
// way the catalog reads it (`.value`).
vi.mock('@/app/i18n', async () => {
  const { default: catalog } = await import('./integration-catalog.content');
  const toEnglish = (node: unknown): unknown => {
    if (node && typeof node === 'object') {
      const translation = (node as { translation?: { en: string } }).translation;
      if (translation) return { value: translation.en };
      return Object.fromEntries(
        Object.entries(node).map(([key, child]) => [key, toEnglish(child)]),
      );
    }
    return node;
  };
  const catalogText = toEnglish(catalog.content);
  const pageText = {
    title: 'Integrations',
    searchPlaceholder: { value: 'Search integrations...' },
    sections: { connected: { value: 'Connected' } },
    setUp: { value: 'Set up' },
    nothingMatches: { value: 'Nothing matches "{query}".' },
    categories: {
      ai: 'AI',
      application: 'Application',
      storage: 'Storage',
      email: 'Email',
      messaging: 'Messaging',
    },
  };
  // Any other dictionary (the drawer shell's own) only needs `.value` strings.
  const otherText = new Proxy({}, { get: (_target, prop) => ({ value: String(prop) }) });
  const byKey: Record<string, unknown> = {
    integrationCatalog: catalogText,
    integrationsPage: pageText,
  };
  return {
    useIntlayer: (key: string) => byKey[key] ?? otherText,
  };
});

import { IntegrationsListDrawer } from './IntegrationsListDrawer';

function renderList(statuses: Record<string, boolean> = {}) {
  const onSelect = vi.fn();
  render(
    <IntegrationsListDrawer
      open
      statuses={statuses}
      onSelect={onSelect}
      onClose={vi.fn()}
    />,
  );
  return { onSelect };
}

describe('IntegrationsListDrawer', () => {
  it('lists the open-protocol integrations instead of legacy SaaS cards', () => {
    renderList();

    expect(screen.getByText('S3-compatible storage')).toBeTruthy();
    expect(screen.getByText('WebDAV storage')).toBeTruthy();
    expect(screen.getByText('IMAP inbox')).toBeTruthy();
    expect(screen.getByText('SMTP email')).toBeTruthy();

    expect(screen.queryByText('AI-compatible endpoint')).toBeNull();
    expect(screen.queryByText('Dropbox')).toBeNull();
    expect(screen.queryByText('Google Drive')).toBeNull();
  });

  it('opens the settings layer for the clicked integration', () => {
    const { onSelect } = renderList();

    const row = document.querySelector('[data-integration-card="s3-compatible"]') as HTMLElement;
    fireEvent.click(row);

    expect(onSelect).toHaveBeenCalledWith('s3-compatible');
  });

  it('marks connected integrations and filters by search', () => {
    renderList({ 's3-compatible': true });

    const row = document.querySelector('[data-integration-card="s3-compatible"]') as HTMLElement;
    expect(row.textContent).toContain('Connected');

    fireEvent.change(screen.getByPlaceholderText('Search integrations...'), {
      target: { value: 'imap' },
    });

    expect(screen.getByText('IMAP inbox')).toBeTruthy();
    expect(screen.queryByText('S3-compatible storage')).toBeNull();
  });
});
