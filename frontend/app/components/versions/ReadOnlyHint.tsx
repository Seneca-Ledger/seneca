'use client';

import type React from 'react';
import { cloneElement } from 'react';
import { useReadOnlyWorkspace } from '@/app/contexts/WorkspaceContext';
import { useIntlayer } from '@/app/i18n';

/**
 * Wraps a button that changes data: inside a past version it is disabled and
 * says why on hover. The span carries the title, since a disabled MUI button
 * takes no pointer events.
 */
export function ReadOnlyHint({
  children,
}: {
  children: React.ReactElement<{ disabled?: boolean }>;
}): React.JSX.Element {
  const { isReadOnly } = useReadOnlyWorkspace();
  const t = useIntlayer('versionBanner');
  if (!isReadOnly) {
    return children;
  }
  return (
    <span title={t.readOnlyHint.value} style={{ display: 'inline-flex' }}>
      {cloneElement(children, { disabled: true })}
    </span>
  );
}
