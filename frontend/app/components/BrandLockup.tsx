import { APP_NAME } from '@/app/lib/brand';

/**
 * The emblem with the product name beside it. The name is text, not part of the
 * artwork, so APP_NAME renames it; the whole lockup scales with its font size.
 */
export function BrandLockup({ className }: { className?: string }) {
  return (
    <span className={className ? `seneca-lockup ${className}` : 'seneca-lockup'}>
      <span className="seneca-lockup__mark" aria-hidden="true" />
      <span className="seneca-lockup__name">{APP_NAME}</span>
    </span>
  );
}
