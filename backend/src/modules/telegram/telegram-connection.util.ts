import type { TelegramConnection } from '../../contracts';
import type { User } from '../../entities/user.entity';

/**
 * Whether the user's chat is connected, and whether the bot answers for
 * `workspaceId` (it serves one workspace: the one Connect was pressed in; a
 * chat connected before that was recorded serves the registration workspace).
 */
export function telegramConnectionOf(
  user: Pick<User, 'telegramChatId' | 'telegramWorkspaceId' | 'workspaceId'>,
  workspaceId: string,
): TelegramConnection {
  const connected = Boolean(user.telegramChatId);
  return {
    connected,
    inThisWorkspace: connected && (user.telegramWorkspaceId ?? user.workspaceId) === workspaceId,
  };
}
