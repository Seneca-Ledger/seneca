import { redirect } from 'next/navigation';

export default function NotificationSettingsRedirectPage() {
  redirect('/settings/profile?tab=notifications');
}
