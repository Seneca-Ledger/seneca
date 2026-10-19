'use client';

import type { ReactNode } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { cn } from '@/app/lib/utils';

type FilterDropdownProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  align?: 'start' | 'center' | 'end';
};

export function FilterDropdown({
  open,
  onOpenChange,
  trigger,
  children,
  contentClassName,
  align = 'start',
}: FilterDropdownProps) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        sideOffset={8}
        className={cn(
          'w-[320px] rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 shadow-xl',
          contentClassName,
        )}
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
