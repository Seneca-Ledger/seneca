import React, { type ReactNode } from 'react';
import {
  BriefcaseBusiness,
  ChartPie,
  CircleDollarSign,
  Shuffle,
  Tag,
} from '@/app/components/icons';

/** The sidebar's folding groups; an item joins one through `NavItem.group`. */
export type NavGroupId =
  | 'transactions'
  | 'classification'
  | 'analytics'
  | 'investments'
  | 'business';

export interface NavGroup {
  id: NavGroupId;
  label: ReactNode;
  icon: React.ReactElement;
}

export function buildNavGroups(labels: Record<NavGroupId, unknown>): NavGroup[] {
  return [
    {
      id: 'transactions',
      label: labels.transactions as ReactNode,
      icon: React.createElement(Shuffle, { size: 18 }),
    },
    {
      id: 'classification',
      label: labels.classification as ReactNode,
      icon: React.createElement(Tag, { size: 18 }),
    },
    {
      id: 'analytics',
      label: labels.analytics as ReactNode,
      icon: React.createElement(ChartPie, { size: 18 }),
    },
    {
      id: 'investments',
      label: labels.investments as ReactNode,
      icon: React.createElement(CircleDollarSign, { size: 18 }),
    },
    {
      id: 'business',
      label: labels.business as ReactNode,
      icon: React.createElement(BriefcaseBusiness, { size: 18 }),
    },
  ];
}
