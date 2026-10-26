import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { readWorkspaceProfile } from '../../common/utils/workspace-profile.util';
import {
  ActorType,
  AuditAction,
  BalanceAccount,
  BalanceSnapshot,
  EntityType,
  Workspace,
} from '../../entities';
import { AuditService } from '../audit/audit.service';
import { BalanceService } from './balance.service';
import {
  ACCOUNTING_ONLY_LINES,
  ACCOUNTING_ONLY_SECTIONS,
  ACCOUNTING_TO_PERSONAL_SECTION,
  PERSONAL_BALANCE_ACCOUNTS,
} from './balance-personal-accounts';

/** Moves a household that was seeded with the company chart onto its own. */
@Injectable()
export class BalancePersonalLayoutService {
  constructor(
    @InjectRepository(BalanceAccount)
    private readonly balanceAccountRepository: Repository<BalanceAccount>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    private readonly balanceService: BalanceService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Rewrites an existing household workspace onto the personal chart.
   *
   * Nothing that holds a value is deleted: an accounting line keeps its name
   * and its history and moves under the household section closest to it, so
   * the allocation stops reading like a filing and starts reading like a
   * person's things. Running it twice changes nothing the second time.
   */
  async applyPersonalLayout(userId: string, workspaceId: string): Promise<{ moved: number }> {
    await this.balanceService.seedDefaultAccounts(workspaceId);
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      select: { id: true, settings: true },
    });
    if (readWorkspaceProfile(workspace) !== 'home') {
      throw new BadRequestException(appError('BALANCE_PERSONAL_LAYOUT_HOME_ONLY'));
    }

    let moved = 0;
    await this.balanceAccountRepository.manager.transaction(async manager => {
      const accounts = manager.getRepository(BalanceAccount);
      const existing = await accounts.find({ where: { workspaceId } });
      const byCode = new Map(existing.map(account => [account.code, account]));

      // The household sections first: everything else is moved underneath them.
      let position = 0;
      for (const definition of PERSONAL_BALANCE_ACCOUNTS) {
        position += 1;
        const parent = definition.parentCode ? byCode.get(definition.parentCode) : null;
        const present = byCode.get(definition.code);
        if (present) {
          // A code both charts use — cash, investments, the equity lines. It
          // keeps its history and its value, but not the accounting wording:
          // "III. Cash" is a form, "Cash" is what someone calls their money.
          const parentId = parent?.id ?? null;
          const renamed =
            present.name !== definition.name ||
            present.nameEn !== definition.nameEn ||
            present.nameKk !== definition.nameKk;
          if (
            present.parentId !== parentId ||
            renamed ||
            present.position !== definition.position
          ) {
            await accounts.update(
              { id: present.id, workspaceId },
              {
                parentId,
                position: definition.position,
                name: definition.name,
                nameEn: definition.nameEn,
                nameKk: definition.nameKk,
              },
            );
            present.parentId = parentId;
            present.position = definition.position;
            present.name = definition.name;
            present.nameEn = definition.nameEn;
            present.nameKk = definition.nameKk;
            moved += 1;
          }
          continue;
        }
        const created = await accounts.save(
          accounts.create({
            workspaceId,
            parentId: parent?.id ?? null,
            code: definition.code,
            name: definition.name,
            nameEn: definition.nameEn,
            nameKk: definition.nameKk,
            accountType: definition.accountType,
            subType: definition.subType,
            isEditable: definition.isEditable ?? true,
            isAutoComputed: definition.isAutoComputed ?? false,
            autoSource: definition.autoSource ?? null,
            position: definition.position,
            isSystem: true,
            isExpandable: definition.isExpandable ?? false,
          }),
        );
        byCode.set(created.code, created);
      }

      for (const [from, to] of Object.entries(ACCOUNTING_TO_PERSONAL_SECTION)) {
        const account = byCode.get(from);
        const section = byCode.get(to);
        if (!(account && section) || account.parentId === section.id) {
          continue;
        }
        await accounts.update({ id: account.id, workspaceId }, { parentId: section.id, position });
        position += 1;
        moved += 1;
      }

      // A borrowed-capital section is a container: its children are the debts.
      const borrowed = byCode.get('LIABILITY_BORROWED');
      const loans = byCode.get('LIABILITY_LOANS');
      if (borrowed && loans) {
        const children = existing.filter(account => account.parentId === borrowed.id);
        for (const child of children) {
          await accounts.update({ id: child.id, workspaceId }, { parentId: loans.id });
          moved += 1;
        }
      }

      // Share capital means nothing to a household; an empty one goes.
      for (const code of ACCOUNTING_ONLY_LINES) {
        const line = byCode.get(code);
        if (!line) {
          continue;
        }
        const entered = await manager
          .getRepository(BalanceSnapshot)
          .count({ where: { workspaceId, accountId: line.id } });
        if (entered === 0) {
          await accounts.delete({ id: line.id, workspaceId });
          byCode.delete(code);
        }
      }

      // What is left of the accounting chart is an empty heading.
      for (const code of ACCOUNTING_ONLY_SECTIONS) {
        const section = byCode.get(code);
        if (!section) {
          continue;
        }
        const stillUsed = await accounts.count({ where: { workspaceId, parentId: section.id } });
        if (stillUsed === 0) {
          await accounts.delete({ id: section.id, workspaceId });
        }
      }
    });

    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.WORKSPACE,
      entityId: workspaceId,
      action: AuditAction.UPDATE,
      meta: { kind: 'balance_personal_layout', moved },
    });

    return { moved };
  }
}
