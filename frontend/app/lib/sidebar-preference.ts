// Whether the sidebar is pinned to the icon rail. A cookie, not localStorage, so
// the server renders the page at the right width and nothing jumps on load.
export const SIDEBAR_COLLAPSED_COOKIE = 'seneca-sidebar-collapsed';

export const parseSidebarCollapsedCookie = (value: string | undefined): boolean => value === '1';
