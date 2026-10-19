'use client';

import { Button, type ButtonProps } from './button';

export function DetailActionButton({ variant = 'outline', ...props }: ButtonProps) {
  return <Button variant={variant} size="sm" {...props} />;
}
