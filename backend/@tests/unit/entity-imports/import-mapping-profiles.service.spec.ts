import { ForbiddenException } from '@nestjs/common';
import {
  headerSignature,
  ImportMappingProfilesService,
} from '../../../src/modules/entity-imports/import-mapping-profiles.service';

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const PROFILE_ID = '33333333-3333-4333-8333-333333333333';
const HEADERS = ['Date', 'Payee', 'Amount'];

const build = () => {
  const stored = { id: PROFILE_ID, target: 'transactions', mapping: { date: 0, merchant: 1, amount: 2 } };
  const repository = {
    findOne: vi.fn().mockResolvedValue(stored),
    findOneOrFail: vi.fn().mockResolvedValue(stored),
    upsert: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({ affected: 1 }),
  };
  const entityImport = { ensurePermission: vi.fn().mockResolvedValue(undefined) };
  const service = new ImportMappingProfilesService(repository as never, entityImport as never);
  return { service, repository, entityImport, stored };
};

describe('headerSignature', () => {
  it('ignores case, spacing and blank trailing cells', () => {
    expect(headerSignature([' date ', 'Payee  Name', '', ''])).toBe(headerSignature(['DATE', 'payee name']));
  });

  it('tells different header rows apart', () => {
    expect(headerSignature(HEADERS)).not.toBe(headerSignature(['Amount', 'Payee', 'Date']));
  });
});

describe('ImportMappingProfilesService', () => {
  it('looks a mapping up by workspace, target and header row', async () => {
    const { service, repository, stored } = build();
    await expect(service.match(WORKSPACE_ID, { target: 'transactions', headers: HEADERS })).resolves.toEqual({
      profile: stored,
    });
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { workspaceId: WORKSPACE_ID, target: 'transactions', headerSignature: headerSignature(HEADERS) },
    });
  });

  it('keeps only known fields and existing columns when saving', async () => {
    const { service, repository, entityImport } = build();
    await service.save(USER_ID, WORKSPACE_ID, {
      target: 'transactions',
      headers: HEADERS,
      mapping: { date: 0, merchant: 1, amount: 2, vendor: 1, purpose: 7 },
    });
    expect(entityImport.ensurePermission).toHaveBeenCalledWith(USER_ID, WORKSPACE_ID, 'transactions', undefined);
    expect(repository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: WORKSPACE_ID, mapping: { date: 0, merchant: 1, amount: 2 } }),
      { conflictPaths: ['workspaceId', 'target', 'headerSignature'] },
    );
  });

  it('saves nothing for someone who may not import into the target', async () => {
    const { service, repository, entityImport } = build();
    entityImport.ensurePermission.mockRejectedValue(new ForbiddenException());
    await expect(
      service.save(USER_ID, WORKSPACE_ID, { target: 'transactions', headers: HEADERS, mapping: {} }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.upsert).not.toHaveBeenCalled();
  });

  it('forgets a mapping of the workspace, and forgetting a missing one is a no-op', async () => {
    const { service, repository } = build();
    await expect(service.remove(USER_ID, WORKSPACE_ID, PROFILE_ID)).resolves.toEqual({ ok: true });
    expect(repository.delete).toHaveBeenCalledWith({ id: PROFILE_ID, workspaceId: WORKSPACE_ID });

    repository.findOne.mockResolvedValue(null);
    repository.delete.mockClear();
    await expect(service.remove(USER_ID, WORKSPACE_ID, PROFILE_ID)).resolves.toEqual({ ok: true });
    expect(repository.delete).not.toHaveBeenCalled();
  });
});
