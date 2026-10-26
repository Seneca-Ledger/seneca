'use client';

import { Suspense } from 'react';
import { RulesView } from '@/app/components/rules/RulesView';

export default function RulesPage() {
  // useSearchParams (the `?focus=` link) needs a boundary to render statically.
  return (
    <Suspense>
      <RulesView />
    </Suspense>
  );
}
