import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { NavItem } from '@/app/components/navigation/helpers/navigation-config';
import { buildCommands, type CommandDeps } from './command-registry';

function navItem(path: string, overrides: Partial<NavItem> = {}): NavItem {
  return {
    label: { value: `Go to ${path}` } as unknown as React.ReactNode,
    path,
    icon: React.createElement('span'),
    permission: 'statement.view',
    ...overrides,
  };
}

function deps(overrides: Partial<CommandDeps> = {}): CommandDeps {
  return {
    labels: {
      uploadStatement: 'Upload a document',
      openFilters: 'Open filters',
      toggleLeftNav: 'Toggle left navigation',
      toggleTheme: 'Toggle theme',
      toggleExperimental: 'Toggle experimental features',
      keyboardShortcuts: 'Keyboard shortcuts',
      notifications: 'Notifications',
      settings: 'Settings',
      whatsNew: "What's new",
      reportBug: 'Report a bug',
    },
    navItems: [navItem('/dashboard'), navItem('/ledger', { experimental: true })],
    push: vi.fn(),
    toggleTheme: vi.fn(),
    toggleExperimental: vi.fn(),
    openHelp: vi.fn(),
    reportBugUrl: 'https://example.invalid/issues',
    ...overrides,
  };
}

describe('buildCommands', () => {
  it('puts every command into one of the four groups', () => {
    const groups = new Set(buildCommands(deps()).map(command => command.group));
    expect([...groups].sort()).toEqual(['actions', 'help', 'navigation', 'settings']);
  });

  it('carries the nav item permission and experimental flag through', () => {
    const commands = buildCommands(deps());
    const ledger = commands.find(command => command.id === 'nav./ledger');
    expect(ledger?.permission).toBe('statement.view');
    expect(ledger?.experimental).toBe(true);
    expect(commands.find(command => command.id === 'nav./dashboard')?.experimental).toBeUndefined();
  });

  it('reads the plain text out of an intlayer nav label', () => {
    const dashboard = buildCommands(deps()).find(command => command.id === 'nav./dashboard');
    expect(dashboard?.label).toBe('Go to /dashboard');
  });

  it('attaches the G chord to the routes that have one', () => {
    const commands = buildCommands(deps());
    expect(commands.find(command => command.id === 'nav./dashboard')?.binding).toBe('KeyG KeyD');
    expect(commands.find(command => command.id === 'nav./ledger')?.binding).toBeUndefined();
  });

  it('navigates through the injected router', () => {
    const push = vi.fn();
    const commands = buildCommands(deps({ push }));
    commands.find(command => command.id === 'nav./dashboard')?.run();
    expect(push).toHaveBeenCalledWith('/dashboard');
  });

  it('opens the shortcuts help through the injected callback', () => {
    const openHelp = vi.fn();
    buildCommands(deps({ openHelp })).find(command => command.id === 'help.shortcuts')?.run();
    expect(openHelp).toHaveBeenCalled();
  });
});
