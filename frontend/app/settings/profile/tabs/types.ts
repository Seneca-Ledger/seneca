import type { User } from '@/app/hooks/useAuth';
import type { SettingsSectionId } from '@/app/settings/profile/helpers/settings-url-state';

/**
 * Auth comes from the page: `useAuth` is a plain hook that refetches `/auth/me`
 * on every mount, so calling it per tab would blank the user on each switch.
 */
export type SettingsTabProps = {
  section: SettingsSectionId | null;
  user: User;
  setUser: (user: User) => void;
  logout: () => Promise<void>;
};
