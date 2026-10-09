import { redirect } from 'next/navigation';

// Everything waiting for a decision lives in Review now; old links land there.
export default function StatementsReviewRedirect(): never {
  redirect('/review');
}
