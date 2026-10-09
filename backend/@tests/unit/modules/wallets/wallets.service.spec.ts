import { createRepoMock } from '../../../helpers/create-repo-mock';
import { Wallet } from '@/entities/wallet.entity';
import { WorkspaceMember } from '@/entities/workspace-member.entity';
import { WalletsService } from '@/modules/wallets/wallets.service';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { workspaceCurrencyProvider } from '../../../helpers/workspace-currency-stub';

describe('WalletsService', () => {
  let testingModule: TestingModule;
  let service: WalletsService;
  let walletRepository: Repository<Wallet>;

  const mockWallet: Partial<Wallet> = {
    id: 'wallet-1',
    name: 'Personal Card',
    currency: 'KZT',
    initialBalance: 10000,
    userId: '1',
    workspaceId: 'ws-1',
    isActive: true,
    bankName: 'Kaspi Bank',
  };

  beforeAll(async () => {
    testingModule = await Test.createTestingModule({
      providers: [
        WalletsService,
        {
          provide: getRepositoryToken(Wallet),
          useValue: createRepoMock<Wallet>(),
        },
        {
          provide: getRepositoryToken(WorkspaceMember),
          useValue: { ...createRepoMock<WorkspaceMember>(), exists: jest.fn(async () => true) },
        },
        workspaceCurrencyProvider('EUR'),
      ],
    }).compile();

    service = testingModule.get<WalletsService>(WalletsService);
    walletRepository = testingModule.get<Repository<Wallet>>(getRepositoryToken(Wallet));
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
      name: 'New Wallet',
      currency: 'USD',
      initialBalance: 5000,
      bankName: 'Bereke Bank',
    };

    it('should create a new wallet', async () => {
      jest.spyOn(walletRepository, 'create').mockReturnValue(mockWallet as Wallet);
      jest.spyOn(walletRepository, 'save').mockResolvedValue(mockWallet as Wallet);

      const result = await service.create('ws-1', 'user-1', createDto);

      expect(result).toEqual(mockWallet);
      expect(walletRepository.save).toHaveBeenCalled();
      expect(walletRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: 'ws-1', userId: 'user-1' }),
      );
    });

    it("falls back to the workspace's currency", async () => {
      const dtoWithoutCurrency = {
        name: 'Wallet',
      };

      const createSpy = jest
        .spyOn(walletRepository, 'create')
        .mockReturnValue(mockWallet as Wallet);
      jest.spyOn(walletRepository, 'save').mockResolvedValue(mockWallet as Wallet);

      await service.create('ws-1', 'user-1', dtoWithoutCurrency);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: 'EUR',
        }),
      );
    });

    it('should set default initial balance to 0', async () => {
      const dtoWithoutBalance = {
        name: 'Wallet',
      };

      const createSpy = jest
        .spyOn(walletRepository, 'create')
        .mockReturnValue(mockWallet as Wallet);
      jest.spyOn(walletRepository, 'save').mockResolvedValue(mockWallet as Wallet);

      await service.create('ws-1', 'user-1', dtoWithoutBalance);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          initialBalance: 0,
        }),
      );
    });

    it('should set isActive to true by default', async () => {
      const createSpy = jest
        .spyOn(walletRepository, 'create')
        .mockReturnValue(mockWallet as Wallet);
      jest.spyOn(walletRepository, 'save').mockResolvedValue(mockWallet as Wallet);

      await service.create('ws-1', 'user-1', createDto);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: true,
        }),
      );
    });

    it('should associate wallet with workspace', async () => {
      const createSpy = jest
        .spyOn(walletRepository, 'create')
        .mockReturnValue(mockWallet as Wallet);
      jest.spyOn(walletRepository, 'save').mockResolvedValue(mockWallet as Wallet);

      await service.create('ws-1', 'user-1', createDto);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-1',
        }),
      );
    });

    it('should support multiple currencies', async () => {
      const currencies = ['KZT', 'USD', 'EUR', 'RUB'];

      for (const currency of currencies) {
        const dto = { ...createDto, currency };
        const createSpy = jest
          .spyOn(walletRepository, 'create')
          .mockReturnValue(mockWallet as Wallet);
        jest.spyOn(walletRepository, 'save').mockResolvedValue(mockWallet as Wallet);

        await service.create('ws-1', 'user-1', dto);

        expect(createSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            currency,
          }),
        );
      }
    });
  });

  describe('findAll', () => {
    it('should return all wallets for workspace', async () => {
      const wallets = [mockWallet, { ...mockWallet, id: 'wallet-2' }];
      jest.spyOn(walletRepository, 'find').mockResolvedValue(wallets as Wallet[]);

      const result = await service.findAll('ws-1');

      expect(result).toHaveLength(2);
      expect(walletRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: 'ws-1' },
        }),
      );
    });

    it('should order wallets by name', async () => {
      const findSpy = jest
        .spyOn(walletRepository, 'find')
        .mockResolvedValue([mockWallet] as Wallet[]);

      await service.findAll('ws-1');

      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { name: 'ASC' },
        }),
      );
    });

    it('should return empty array if no wallets', async () => {
      jest.spyOn(walletRepository, 'find').mockResolvedValue([]);

      const result = await service.findAll('ws-1');

      expect(result).toEqual([]);
    });

    it('should include inactive wallets', async () => {
      const inactiveWallet = { ...mockWallet, isActive: false };
      jest.spyOn(walletRepository, 'find').mockResolvedValue([inactiveWallet] as Wallet[]);

      const result = await service.findAll('ws-1');

      expect(result.some(w => !w.isActive)).toBe(true);
    });
  });

  describe('findOne', () => {
    it('should return wallet by id', async () => {
      jest.spyOn(walletRepository, 'findOne').mockResolvedValue(mockWallet as Wallet);

      const result = await service.findOne('wallet-1', 'ws-1');

      expect(result).toEqual(mockWallet);
    });

    it('should throw NotFoundException if not found', async () => {
      jest.spyOn(walletRepository, 'findOne').mockResolvedValue(null);

      await expect(service.findOne('invalid', 'ws-1')).rejects.toThrow(NotFoundException);
    });

    it('should verify workspace ownership', async () => {
      const findOneSpy = jest
        .spyOn(walletRepository, 'findOne')
        .mockResolvedValue(mockWallet as Wallet);

      await service.findOne('wallet-1', 'ws-1');

      expect(findOneSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'wallet-1', workspaceId: 'ws-1' },
        }),
      );
    });

    it('should not return other workspace wallets', async () => {
      jest.spyOn(walletRepository, 'findOne').mockResolvedValue(null);

      await expect(service.findOne('wallet-1', 'ws-999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto = {
      name: 'Updated Wallet',
      initialBalance: 15000,
    };

    beforeEach(() => {
      jest.spyOn(walletRepository, 'findOne').mockResolvedValue(mockWallet as Wallet);
    });

    it('should update wallet', async () => {
      jest.spyOn(walletRepository, 'save').mockResolvedValue({
        ...mockWallet,
        ...updateDto,
      } as Wallet);

      const result = await service.update('wallet-1', 'ws-1', updateDto);

      expect(result.name).toBe(updateDto.name);
      expect(walletRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if wallet not found', async () => {
      jest.spyOn(walletRepository, 'findOne').mockResolvedValue(null);

      await expect(service.update('invalid', 'ws-1', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('should preserve workspaceId on update', async () => {
      const saveSpy = jest.spyOn(walletRepository, 'save').mockResolvedValue(mockWallet as Wallet);

      await service.update('wallet-1', 'ws-1', updateDto);

      const savedWallet = saveSpy.mock.calls[0][0];
      expect(savedWallet.workspaceId).toBe('ws-1');
    });

    it('should allow partial updates', async () => {
      const partialUpdate = { name: 'New Name Only' };
      jest.spyOn(walletRepository, 'save').mockResolvedValue(mockWallet as Wallet);

      await service.update('wallet-1', 'ws-1', partialUpdate);

      expect(walletRepository.save).toHaveBeenCalled();
    });

    it('should allow toggling isActive status', async () => {
      const toggleDto = { isActive: false };
      jest.spyOn(walletRepository, 'save').mockResolvedValue({
        ...mockWallet,
        isActive: false,
      } as Wallet);

      const result = await service.update('wallet-1', 'ws-1', toggleDto);

      expect(result.isActive).toBe(false);
    });

    it('should update currency', async () => {
      const currencyUpdate = { currency: 'USD' };
      jest.spyOn(walletRepository, 'save').mockResolvedValue({
        ...mockWallet,
        currency: 'USD',
      } as Wallet);

      const result = await service.update('wallet-1', 'ws-1', currencyUpdate);

      expect(result.currency).toBe('USD');
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      jest.spyOn(walletRepository, 'findOne').mockResolvedValue(mockWallet as Wallet);
    });

    it('should delete wallet', async () => {
      const removeSpy = jest
        .spyOn(walletRepository, 'remove')
        .mockResolvedValue(mockWallet as Wallet);

      await service.remove('wallet-1', 'ws-1');

      expect(removeSpy).toHaveBeenCalledWith(mockWallet);
    });

    it('should throw NotFoundException if wallet not found', async () => {
      jest.spyOn(walletRepository, 'findOne').mockResolvedValue(null);

      await expect(service.remove('invalid', 'ws-1')).rejects.toThrow(NotFoundException);
    });

    it('should verify workspace ownership before delete', async () => {
      jest.spyOn(walletRepository, 'findOne').mockResolvedValue(null);

      await expect(service.remove('wallet-1', 'ws-999')).rejects.toThrow(NotFoundException);
    });

    it('should handle wallets with transactions', async () => {
      // Should prevent deletion or cascade
      jest.spyOn(walletRepository, 'remove').mockResolvedValue(mockWallet as Wallet);

      await service.remove('wallet-1', 'ws-1');

      expect(walletRepository.remove).toHaveBeenCalled();
    });
  });
});
