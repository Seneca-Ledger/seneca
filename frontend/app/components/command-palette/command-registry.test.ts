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
    pathname: '/dashboard',
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

  it('offers Open filters only on the Documents list, the one page that has them', () => {
    const elsewhere = buildCommands(deps({ pathname: '/dashboard' }));
    const documents = buildCommands(deps({ pathname: '/statements/submit' }));
    expect(elsewhere.find(command => command.id === 'action.filters')).toBeUndefined();
    expect(documents.find(command => command.id === 'action.filters')?.binding).toBe('Shift+KeyF');
  });

  it('takes the upload to the Documents list from any other page', () => {
    const push = vi.fn();
    window.history.pushState({}, '', '/dashboard');
    buildCommands(deps({ push }))
      .find(command => command.id === 'action.upload')
      ?.run();
    expect(push).toHaveBeenCalledWith('/statements/submit?openExpenseDrawer=scan');
  });

  it('opens the scan drawer in place when already on the Documents list', () => {
    const push = vi.fn();
    const heard = vi.fn();
    window.addEventListener('statements:open-expense-drawer', heard);
    window.history.pushState({}, '', '/statements/submit');
    buildCommands(deps({ push }))
      .find(command => command.id === 'action.upload')
      ?.run();
    window.removeEventListener('statements:open-expense-drawer', heard);
    expect(push).not.toHaveBeenCalled();
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('gives notifications and settings a shortcut', () => {
    const commands = buildCommands(deps());
    expect(commands.find(command => command.id === 'action.notifications')?.binding).toBe(
      'Shift+KeyN',
    );
    expect(commands.find(command => command.id === 'settings.open')?.binding).toBe('$mod+Comma');
  });
});
