import { ForbiddenException } from '@nestjs/common';
import { WorkspacePluginsService } from '../../../../src/modules/workspaces/workspace-plugins.service';

describe('WorkspacePluginsService', () => {
  const repo = { findOne: jest.fn() };
  const service = new WorkspacePluginsService(repo as any);

  beforeEach(() => jest.clearAllMocks());

  it('reads the switch from the workspace settings', async () => {
    repo.findOne.mockResolvedValue({ id: 'ws-1', settings: { plugins: { webhooks: true } } });

    await expect(service.isEnabled('ws-1', 'webhooks')).resolves.toBe(true);
    await expect(service.isEnabled('ws-1', 'mcp')).resolves.toBe(false);
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 'ws-1' },
      select: { id: true, settings: true },
    });
  });

  it('refuses with PLUGIN_DISABLED when the plugin is off', async () => {
    repo.findOne.mockResolvedValue({ id: 'ws-1', settings: null });

    const error = await service.assertEnabled('ws-1', 'mcp').catch(e => e);
    expect(error).toBeInstanceOf(ForbiddenException);
    expect(error.getResponse()).toMatchObject({ code: 'PLUGIN_DISABLED', params: { plugin: 'mcp' } });
  });

  it('treats a missing workspace as having the plugin off', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(service.isEnabled('gone', 'webhooks')).resolves.toBe(false);
  });
});
