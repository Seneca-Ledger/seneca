'use client';

import Button from '@mui/material/Button';
import Link from 'next/link';
import type React from 'react';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { useIntlayer } from '@/app/i18n';

/** Where people report a page that should exist. */
const CONTACT_EMAIL = 'peterbaikov12@proton.me';

/**
 * Shown for any URL no route matches, and wherever a page calls `notFound()`.
 * Client-side because the button takes `next/link` as its component, which a
 * server component cannot pass across the boundary.
 */
export function NotFoundView(): React.JSX.Element {
  const t = useIntlayer('notFoundPage');

  return (
    <EmptyState
      illustration="page-error"
      size="lg"
      title={t.title}
      description={
        <>
          {t.description}{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>
            {CONTACT_EMAIL}
          </a>
        </>
      }
      action={
        <Button component={Link} href="/" variant="contained" color="primary">
          {t.backHome}
        </Button>
      }
    />
  );
}
