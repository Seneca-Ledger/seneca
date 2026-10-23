import { redirect } from 'next/navigation';
import { AllTransactionsView } from './components/AllTransactionsView';

const MONTH_START = /^(\d{4}-\d{2})-\d{2}$/;

// Old links (bookmarks, ?startDate from the dashboard) open on their month.
export default async function AllTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ startDate?: string }>;
}): Promise<React.JSX.Element> {
  const month = MONTH_START.exec((await searchParams).startDate ?? '')?.[1];
  if (month) {
    redirect(`/statements/transactions?month=${month}`);
  }
  return <AllTransactionsView />;
}
