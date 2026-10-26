import { useEffect, useRef, useState } from 'react';
import { useIntlayer } from '@/app/i18n';
import type { WorkspaceSetters } from './WorkspaceContext';

/**
 * The provider's state setters plus the error texts of the current language.
 * The texts sit behind a ref, so a language switch keeps the setters' identity
 * and does not re-create the callbacks built on them.
 */
export function useWorkspaceSetters(setters: Omit<WorkspaceSetters, 'text'>): WorkspaceSetters {
  const t = useIntlayer('workspaceContext');
  const text = useRef(t);
  useEffect(() => {
    text.current = t;
  }, [t]);
  const [stable] = useState<WorkspaceSetters>(() => ({ ...setters, text }));
  return stable;
}
