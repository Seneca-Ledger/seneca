import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Budget } from '../../entities/budget.entity';
import { Goal } from '../../entities/goal.entity';
import { Invoice } from '../../entities/invoice.entity';
import { Note } from '../../entities/note.entity';
import { Receipt } from '../../entities/receipt.entity';
import { Statement } from '../../entities/statement.entity';
import { Transaction } from '../../entities/transaction.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Note,
      Statement,
      Receipt,
      WorkspaceMember,
      Transaction,
      Budget,
      Goal,
      Invoice,
    ]),
  ],
  controllers: [NotesController],
  providers: [NotesService],
  exports: [NotesService],
})
export class NotesModule {}
