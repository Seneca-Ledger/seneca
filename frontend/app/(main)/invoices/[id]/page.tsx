'use client';

import { useParams } from 'next/navigation';
import { InvoiceDetailView } from '../components/InvoiceDetailView';

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  return <InvoiceDetailView invoiceId={params.id} />;
}
