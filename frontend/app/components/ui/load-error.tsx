import type React from 'react';
import { Frown } from '@/app/components/icons';

interface LoadErrorProps {
  children: React.ReactNode;
  /** Vertical room around it, in theme spacing units: a page gets more than a section. */
  spacing?: 2 | 4 | 6;
}

/**
 * What a page or section shows when its data failed to load: a sad face over
 * the message, both in the error tone, centred where the content would be.
 */
export function LoadError({ children, spacing = 2 }: LoadErrorProps): React.JSX.Element {
  return (
    <div className="seneca-load-error" data-spacing={spacing} role="alert">
      <Frown size={32} aria-hidden className="seneca-load-error__icon" />
      <p className="seneca-load-error__text">{children}</p>
    </div>
  );
}
