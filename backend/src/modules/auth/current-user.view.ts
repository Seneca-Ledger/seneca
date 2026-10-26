import type { CurrentUser } from '../../contracts';
import type { User } from '../../entities/user.entity';

/** The `GET /auth/me` body, field by field: nothing the client does not read. */
export function toCurrentUser(user: User): CurrentUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    workspaceId: user.workspaceId,
    permissions: user.permissions,
    telegramId: user.telegramId,
    telegramChatId: user.telegramChatId,
    locale: user.locale,
    timeZone: user.timeZone,
    dateFormat: user.dateFormat,
    firstDayOfWeek: user.firstDayOfWeek,
    uiDensity: user.uiDensity,
    reduceMotion: user.reduceMotion,
    showDailyQuote: user.showDailyQuote,
    themePreference: user.themePreference,
    mapStylePreference: user.mapStylePreference,
    lastLogin: user.lastLogin?.toISOString() ?? null,
    avatarUrl: user.avatarUrl,
    onboardingCompletedAt: user.onboardingCompletedAt?.toISOString() ?? null,
    welcomeTutorialSeenAt: user.welcomeTutorialSeenAt?.toISOString() ?? null,
    pageHintsSeen: user.pageHintsSeen ?? {},
  };
}
