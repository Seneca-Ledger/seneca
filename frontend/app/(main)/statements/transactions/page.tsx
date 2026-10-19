import { redirect } from 'next/navigation';

const MONTH_START = /^(\d{4}-\d{2})-\d{2}$/;

// The separate transactions list is gone: a statement's rows open under it in
// Documents. Old links (bookmarks, ?startDate from the dashboard) keep their month.
export default async function StatementTransactionsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ startDate?: string }>;
}): Promise<never> {
  const month = MONTH_START.exec((await searchParams).startDate ?? '')?.[1];
  redirect(month ? `/statements/submit?month=${month}` : '/statements/submit');
}
