import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

export function relativeTime(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diff = now - then;

  if (diff < MINUTE) {
    return 'Just now';
  }
  if (diff < HOUR) {
    return `${Math.floor(diff / MINUTE)} min ago`;
  }
  if (diff < DAY) {
    return `${Math.floor(diff / HOUR)}h ago`;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const thenDate = new Date(dateString);
  thenDate.setHours(0, 0, 0, 0);

  if (thenDate.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  }
  if (diff < 7 * DAY) {
    return `${Math.floor(diff / DAY)} days ago`;
  }

  return formatStoredDateWithOptions(
    dateString,
    { month: 'short', day: 'numeric', year: 'numeric' },
    'en-US',
  );
}
