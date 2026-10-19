import { redirect } from 'next/navigation';

/** Telegram settings now live inside the Notifications tab. */
export default function TelegramSettingsRedirectPage() {
  redirect('/settings/profile?tab=notifications&section=telegram');
}
