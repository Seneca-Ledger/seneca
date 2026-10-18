import type { DataSource, Repository } from 'typeorm';
import { Workspace } from '@/entities';
import {
  DemoWorkspaceService,
  demoAnchorDate,
} from '@/modules/workspaces/demo-workspace/demo-workspace.service';
import { seedDemoWorkspace } from '@/modules/workspaces/demo-workspace/demo-workspace.seeder';
import type { WorkspacesService } from '@/modules/workspaces/workspaces.service';

// The seeder is covered on its own; here only what is handed to it matters.
jest.mock('@/modules/workspaces/demo-workspace/demo-workspace.seeder', () => ({
  seedDemoWorkspace: jest.fn(async () => undefined),
}));

const uniqueViolation = Object.assign(new Error('duplicate key'), {
  code: '23505',
  constraint: 'UQ_workspaces_demo_of_user',
});

function setup(options: { existing?: string | null; fail?: Error } = {}) {
  const workspaceRepository = {
    findOne: jest.fn(async () => (options.existing ? { id: options.existing } : null)),
    delete: jest.fn(async () => ({ affected: 1 })),
  };
  const manager = {
    update: jest.fn(async () => ({ affected: 1 })),
  };
  const dataSource = {
    transaction: jest.fn(async (work: (m: unknown) => Promise<void>) => {
      await work(manager);
      if (options.fail) throw options.fail;
    }),
  };
  const workspacesService = {
    createWorkspace: jest.fn(async () => ({ id: 'ws-new', name: 'Demo' })),
    getWorkspaceById: jest.fn(async (id: string) => ({ id, name: 'Demo' })),
  };
  const service = new DemoWorkspaceService(
    workspaceRepository as unknown as Repository<Workspace>,
    dataSource as unknown as DataSource,
    workspacesService as unknown as WorkspacesService,
  );
  return { service, workspaceRepository, workspacesService, manager };
}

describe('DemoWorkspaceService', () => {
  const env = process.env.DEMO_DATA_ANCHOR_DATE;
  afterEach(() => {
    if (env === undefined) delete process.env.DEMO_DATA_ANCHOR_DATE;
    else process.env.DEMO_DATA_ANCHOR_DATE = env;
  });

  it('answers the existing demo without making another', async () => {
    const { service, workspacesService } = setup({ existing: 'ws-old' });
    await expect(service.getOrCreate('user-1', 'Demo')).resolves.toEqual({
      workspace: { id: 'ws-old', name: 'Demo' },
      created: false,
    });
    expect(workspacesService.createWorkspace).not.toHaveBeenCalled();
  });

  it('creates an EUR workspace through the normal path and marks it as the user’s demo', async () => {
    const { service, workspacesService, manager } = setup();
    await expect(service.getOrCreate('user-1', 'Демо')).resolves.toEqual({
      workspace: { id: 'ws-new', name: 'Demo' },
      created: true,
    });
    expect(workspacesService.createWorkspace).toHaveBeenCalledWith('user-1', {
      name: 'Демо',
      currency: 'EUR',
    });
    expect(manager.update).toHaveBeenCalledWith(
      Workspace,
      { id: 'ws-new' },
      { demoOfUserId: 'user-1' },
    );
    expect(seedDemoWorkspace).toHaveBeenCalledWith(
      manager,
      { workspaceId: 'ws-new', userId: 'user-1' },
      expect.objectContaining({ anchor: expect.any(String) }),
    );
  });

  it('deletes the half-made workspace when filling it fails', async () => {
    const failure = new Error('insert failed');
    const { service, workspaceRepository } = setup({ fail: failure });
    await expect(service.getOrCreate('user-1', 'Demo')).rejects.toBe(failure);
    expect(workspaceRepository.delete).toHaveBeenCalledWith({ id: 'ws-new' });
  });

  it('loses a race gracefully: removes its own workspace and answers the winner’s', async () => {
    const { service, workspaceRepository } = setup({ fail: uniqueViolation });
    // No demo yet when it starts; the other request's by the time it fails.
    workspaceRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'ws-winner' } as never);
    await expect(service.getOrCreate('user-1', 'Demo')).resolves.toEqual({
      workspace: { id: 'ws-winner', name: 'Demo' },
      created: false,
    });
    expect(workspaceRepository.delete).toHaveBeenCalledWith({ id: 'ws-new' });
  });

  it('anchors on DEMO_DATA_ANCHOR_DATE when set, else on today', () => {
    delete process.env.DEMO_DATA_ANCHOR_DATE;
    expect(demoAnchorDate(new Date('2026-10-18T12:00:00Z'))).toBe('2026-10-18');
    process.env.DEMO_DATA_ANCHOR_DATE = '2026-09-28';
    expect(demoAnchorDate(new Date('2026-10-18T12:00:00Z'))).toBe('2026-09-28');
    process.env.DEMO_DATA_ANCHOR_DATE = '2026-02-30';
    expect(() => demoAnchorDate()).toThrow('YYYY-MM-DD');
  });
});
