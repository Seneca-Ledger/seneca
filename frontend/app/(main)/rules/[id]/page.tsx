'use client';

import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import { RuleEditorView } from '@/app/components/rules/RuleEditorView';

export default function RuleEditorPage() {
  const params = useParams<{ id: string }>();
  // useSearchParams (a draft from `/rules/new?payee=…`) needs a boundary to render statically.
  return (
    <Suspense>
      <RuleEditorView id={params.id} />
    </Suspense>
  );
}
