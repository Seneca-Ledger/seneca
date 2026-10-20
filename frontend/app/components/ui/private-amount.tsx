'use client';

import clsx from 'clsx';
import type React from 'react';
import { usePrivacyMode } from '@/app/lib/privacy-mode';

/** The class that redacts an amount in privacy mode (styles/base/_privacy.scss). */
export const PRIVATE_CLASS = 'seneca-private';

/**
 * On a container whose amounts cannot be hovered themselves (SVG text without
 * pointer events): hovering or focusing the container shows them.
 */
export const PRIVATE_REVEAL_CLASS = 'seneca-private-reveal';

/**
 * An amount: in privacy mode a pencil scribble that shows the figure under the
 * pointer. `title` (the exact figure behind a rounded one) is dropped in privacy
 * mode, or the tooltip would give the number away.
 */
export function PrivateAmount({
  children,
  title,
  className,
}: {
  children: React.ReactNode;
  title?: string;
  className?: string;
}): React.JSX.Element {
  const privacy = usePrivacyMode();
  return (
    <span className={clsx(PRIVATE_CLASS, className)} title={privacy ? undefined : title}>
      {children}
    </span>
  );
}

/**
 * A sentence with amounts in it ("{{amount}} left of {{limit}}"): the words stay
 * readable and each substituted amount is a `PrivateAmount`. Placeholders are
 * `{{name}}` or `{name}`; one missing from `values` is left as written.
 */
export function fillTemplateNodes(
  template: string,
  values: Record<string, React.ReactNode>,
): React.ReactNode[] {
  return template.split(/(\{\{?\w+\}?\})/g).map((part, index) => {
    const name = part.match(/^\{\{?(\w+)\}?\}$/)?.[1];
    if (name === undefined || !(name in values)) {
      return part;
    }
    // biome-ignore lint/suspicious/noArrayIndexKey: a fixed split of one template
    return <PrivateAmount key={index}>{values[name]}</PrivateAmount>;
  });
}
