import type { EntityManager } from 'typeorm';
import {
  isVersionWorkspace,
  notInVersionWorkspace,
  STANDARD_WORKSPACE,
} from '@/common/workspaces/version-workspaces';
import { Workspace, WorkspaceKind } from '@/entities/workspace.entity';

describe('version workspace filters', () => {
  it('matches the workspace relation of an ordinary workspace in find options', () => {
    expect(STANDARD_WORKSPACE).toEqual({ kind: WorkspaceKind.STANDARD });
  });

  it('leaves out rows of a past version by the given workspace column, and keeps rows without one', () => {
    expect(notInVersionWorkspace('payable.workspaceId')).toBe(
      "NOT EXISTS (SELECT 1 FROM workspaces version_ws WHERE version_ws.id = payable.workspaceId AND version_ws.kind = 'version')",
    );
  });

  describe('isVersionWorkspace', () => {
    const managerAnswering = (answer: boolean) =>
      ({ exists: jest.fn(async () => answer) }) as unknown as EntityManager & {
        exists: jest.Mock;
      };

    it('asks for a workspace of that id that is a past version', async () => {
      const manager = managerAnswering(true);

      await expect(isVersionWorkspace(manager, 'ws-1')).resolves.toBe(true);
      expect(manager.exists).toHaveBeenCalledWith(Workspace, {
        where: { id: 'ws-1', kind: WorkspaceKind.VERSION },
      });
    });

    it('says no for an ordinary workspace', async () => {
      await expect(isVersionWorkspace(managerAnswering(false), 'ws-1')).resolves.toBe(false);
    });

    it('says no without asking when there is no workspace at all', async () => {
      const manager = managerAnswering(true);

      await expect(isVersionWorkspace(manager, null)).resolves.toBe(false);
      await expect(isVersionWorkspace(manager, undefined)).resolves.toBe(false);
      expect(manager.exists).not.toHaveBeenCalled();
    });
  });
});
