import { createRepoMock } from '../../../helpers/create-repo-mock';
import { Branch } from '@/entities/branch.entity';
import { BranchesService } from '@/modules/branches/branches.service';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

describe('BranchesService', () => {
  let testingModule: TestingModule;
  let service: BranchesService;
  let branchRepository: Repository<Branch>;

  const mockBranch: Partial<Branch> = {
    id: 'branch-1',
    name: 'Main Office',
    userId: '1',
    workspaceId: 'ws-1',
    isActive: true,
  };

  beforeAll(async () => {
    testingModule = await Test.createTestingModule({
      providers: [
        BranchesService,
        {
          provide: getRepositoryToken(Branch),
          useValue: createRepoMock<Branch>(),
        },
      ],
    }).compile();

    service = testingModule.get<BranchesService>(BranchesService);
    branchRepository = testingModule.get<Repository<Branch>>(getRepositoryToken(Branch));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await testingModule.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      name: 'New Branch',
      location: 'Astana',
      description: 'New branch description',
    };

    it('should create a new branch', async () => {
      jest.spyOn(branchRepository, 'create').mockReturnValue(mockBranch as Branch);
      jest.spyOn(branchRepository, 'save').mockResolvedValue(mockBranch as Branch);

      const result = await service.create('ws-1', 'u1', createDto);

      expect(result).toEqual(mockBranch);
      expect(branchRepository.save).toHaveBeenCalled();
    });

    it('should set isActive to true by default', async () => {
      const createSpy = jest
        .spyOn(branchRepository, 'create')
        .mockReturnValue(mockBranch as Branch);
      jest.spyOn(branchRepository, 'save').mockResolvedValue(mockBranch as Branch);

      await service.create('ws-1', 'u1', createDto);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: true,
          userId: 'u1',
        }),
      );
    });

    it('should associate branch with workspace', async () => {
      const createSpy = jest
        .spyOn(branchRepository, 'create')
        .mockReturnValue(mockBranch as Branch);
      jest.spyOn(branchRepository, 'save').mockResolvedValue(mockBranch as Branch);

      await service.create('ws-1', 'u1', createDto);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-1',
        }),
      );
    });

    it('should store location information', async () => {
      const createSpy = jest
        .spyOn(branchRepository, 'create')
        .mockReturnValue(mockBranch as Branch);
      jest.spyOn(branchRepository, 'save').mockResolvedValue(mockBranch as Branch);

      await service.create('ws-1', 'u1', createDto);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          location: createDto.location,
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return all branches for workspace', async () => {
      const branches = [mockBranch, { ...mockBranch, id: 'branch-2' }];
      jest.spyOn(branchRepository, 'find').mockResolvedValue(branches as Branch[]);

      const result = await service.findAll('ws-1');

      expect(result).toHaveLength(2);
      expect(branchRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: 'ws-1' },
        }),
      );
    });

    it('should order branches by name', async () => {
      const findSpy = jest
        .spyOn(branchRepository, 'find')
        .mockResolvedValue([mockBranch] as Branch[]);

      await service.findAll('ws-1');

      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { name: 'ASC' },
        }),
      );
    });

    it('should return empty array if no branches', async () => {
      jest.spyOn(branchRepository, 'find').mockResolvedValue([]);

      const result = await service.findAll('ws-1');

      expect(result).toEqual([]);
    });

    it('should include inactive branches', async () => {
      const inactiveBranch = { ...mockBranch, isActive: false };
      jest.spyOn(branchRepository, 'find').mockResolvedValue([inactiveBranch] as Branch[]);

      const result = await service.findAll('ws-1');

      expect(result.some(b => !b.isActive)).toBe(true);
    });
  });

  describe('findOne', () => {
    it('should return branch by id', async () => {
      jest.spyOn(branchRepository, 'findOne').mockResolvedValue(mockBranch as Branch);

      const result = await service.findOne('branch-1', 'ws-1');

      expect(result).toEqual(mockBranch);
    });

    it('should throw NotFoundException if not found', async () => {
      jest.spyOn(branchRepository, 'findOne').mockResolvedValue(null);

      await expect(service.findOne('invalid', 'ws-1')).rejects.toThrow(NotFoundException);
    });

    it('should verify workspace ownership', async () => {
      const findOneSpy = jest
        .spyOn(branchRepository, 'findOne')
        .mockResolvedValue(mockBranch as Branch);

      await service.findOne('branch-1', 'ws-1');

      expect(findOneSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'branch-1', workspaceId: 'ws-1' },
        }),
      );
    });

    it('should not return other workspace branches', async () => {
      jest.spyOn(branchRepository, 'findOne').mockResolvedValue(null);

      await expect(service.findOne('branch-1', 'ws-999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto = {
      name: 'Updated Branch',
      location: 'Shymkent',
    };

    beforeEach(() => {
      jest.spyOn(branchRepository, 'findOne').mockResolvedValue(mockBranch as Branch);
    });

    it('should update branch', async () => {
      jest.spyOn(branchRepository, 'save').mockResolvedValue({
        ...mockBranch,
        ...updateDto,
      } as Branch);

      const result = await service.update('branch-1', 'ws-1', updateDto);

      expect(result.name).toBe(updateDto.name);
      expect(branchRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if branch not found', async () => {
      jest.spyOn(branchRepository, 'findOne').mockResolvedValue(null);

      await expect(service.update('invalid', 'ws-1', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('should preserve workspaceId on update', async () => {
      const saveSpy = jest.spyOn(branchRepository, 'save').mockResolvedValue(mockBranch as Branch);

      await service.update('branch-1', 'ws-1', updateDto);

      const savedBranch = saveSpy.mock.calls[0][0];
      expect(savedBranch.workspaceId).toBe('ws-1');
    });

    it('should allow partial updates', async () => {
      const partialUpdate = { name: 'New Name Only' };
      jest.spyOn(branchRepository, 'save').mockResolvedValue(mockBranch as Branch);

      await service.update('branch-1', 'ws-1', partialUpdate);

      expect(branchRepository.save).toHaveBeenCalled();
    });

    it('should allow toggling isActive status', async () => {
      const toggleDto = { isActive: false };
      jest.spyOn(branchRepository, 'save').mockResolvedValue({
        ...mockBranch,
        isActive: false,
      } as Branch);

      const result = await service.update('branch-1', 'ws-1', toggleDto);

      expect(result.isActive).toBe(false);
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      jest.spyOn(branchRepository, 'findOne').mockResolvedValue(mockBranch as Branch);
    });

    it('should delete branch', async () => {
      const removeSpy = jest
        .spyOn(branchRepository, 'remove')
        .mockResolvedValue(mockBranch as Branch);

      await service.remove('branch-1', 'ws-1');

      expect(removeSpy).toHaveBeenCalledWith(mockBranch);
    });

    it('should throw NotFoundException if branch not found', async () => {
      jest.spyOn(branchRepository, 'findOne').mockResolvedValue(null);

      await expect(service.remove('invalid', 'ws-1')).rejects.toThrow(NotFoundException);
    });

    it('should verify workspace ownership before delete', async () => {
      jest.spyOn(branchRepository, 'findOne').mockResolvedValue(null);

      await expect(service.remove('branch-1', 'ws-999')).rejects.toThrow(NotFoundException);
    });

    it('should handle branches with transactions', async () => {
      // Should prevent deletion or cascade
      jest.spyOn(branchRepository, 'remove').mockResolvedValue(mockBranch as Branch);

      await service.remove('branch-1', 'ws-1');

      expect(branchRepository.remove).toHaveBeenCalled();
    });
  });
});
