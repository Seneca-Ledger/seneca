import React, { type ReactNode } from 'react';
import { Plug, Puzzle, ScrollText } from '@/app/components/icons';
import type { NavItem } from './navigation-config';

/** The links in the account menu rather than the sidebar. */
export function buildUserMenuNavItems(nav: {
  activityLog: unknown;
  integrations: unknown;
  plugins: unknown;
}): NavItem[] {
  return [
    {
      label: nav.integrations as ReactNode,
      path: '/integrations',
      icon: React.createElement(Plug, { size: 18 }),
      // Held by the admin and user roles but not by viewer, which is who
      // these two links have always been shown to.
      permission: 'telegram.connect',
    },
    {
      label: nav.plugins as ReactNode,
      path: '/plugins',
      icon: React.createElement(Puzzle, { size: 18 }),
      permission: 'telegram.connect',
    },
    {
      label: nav.activityLog as ReactNode,
      path: '/admin',
      icon: React.createElement(ScrollText, { size: 18 }),
      permission: 'audit_log.view',
    },
  ];
}
