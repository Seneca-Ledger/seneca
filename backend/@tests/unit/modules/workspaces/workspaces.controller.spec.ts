import { requestAppOrigin } from '@/modules/workspaces/request-app-origin.util';
import { WorkspacesController } from '@/modules/workspaces/workspaces.controller';

describe('WorkspacesController', () => {
  it('uses Origin header when present', async () => {
    const workspacesService = {
      getWorkspaceOverview: vi.fn(async () => ({ ok: true })),
      inviteMember: vi.fn(),
      removeMember: vi.fn(),
      getInvitationInfo: vi.fn(),
      acceptInvitation: vi.fn(),
    };
    const controller = new WorkspacesController(workspacesService as any);

    const res = await controller.getMyWorkspace(
      { id: 'u1' } as any,
      { headers: { origin: 'https://app.example.com' } } as any,
    );

    expect(res).toEqual({ ok: true });
    expect(workspacesService.getWorkspaceOverview).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u1' }),
      'https://app.example.com',
    );
  });

  it('falls back to x-forwarded-host when origin/referer missing', async () => {
    const workspacesService = {
      getWorkspaceOverview: vi.fn(async () => ({ ok: true })),
      inviteMember: vi.fn(),
      removeMember: vi.fn(),
      getInvitationInfo: vi.fn(),
      acceptInvitation: vi.fn(async () => ({ ok: true })),
    };
    const controller = new WorkspacesController(workspacesService as any);

    await controller.acceptInvitation({ id: 'u1' } as any, 't1');

    const origin = requestAppOrigin({
      headers: { 'x-forwarded-host': 'api.example.com', 'x-forwarded-proto': 'http' },
    } as any);
    expect(origin).toBe('http://api.example.com');
  });
});
