'use client';

import { useDroppable } from '@dnd-kit/core';
import React from 'react';

interface DroppableFolderButtonProps {
  folderId?: string;
  isNoFolder?: boolean;
  active?: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export const DroppableFolderButton = React.memo(
  ({
    folderId,
    isNoFolder,
    active: Active,
    children,
    className,
    style,
    onClick,
    onContextMenu,
  }: DroppableFolderButtonProps) => {
    const { isOver, setNodeRef } = useDroppable({
      id: isNoFolder ? 'folder-none' : `folder-${folderId}`,
      data: { folderId, isNoFolder },
    });

    const highlightClass = isOver ? 'ring-2 ring-inset ring-primary bg-primary/10' : '';

    return (
      <div ref={setNodeRef} className={`relative rounded-lg ${highlightClass}`} role="presentation">
        {/* biome-ignore lint/a11y/noStaticElementInteractions: role, tabIndex and onKeyDown are all set below, but role is computed from `onClick`, so the rule cannot see that it is non-generic. */}
        <div
          onClick={onClick}
          onContextMenu={onContextMenu}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              onClick?.(e);
            }
          }}
          tabIndex={onClick ? 0 : -1}
          role={onClick ? 'button' : 'presentation'}
          className={className}
          style={style}
        >
          {children}
        </div>
      </div>
    );
  },
);

DroppableFolderButton.displayName = 'DroppableFolderButton';
