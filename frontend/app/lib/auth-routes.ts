/**
 * Screens of the `(auth)` route group. They bring their own full-page layout,
 * so the app chrome (sidebar, top bar, mobile bottom bar) must stay off them.
 * Adding a page to `app/(auth)` means adding it here.
 */
export const AUTH_ROUTE_PREFIXES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
];
