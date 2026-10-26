import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tag } from '../../entities/tag.entity';
import { User } from '../../entities/user.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { AuditModule } from '../audit/audit.module';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tag, User, WorkspaceMember]), AuditModule],
  controllers: [TagsController],
  providers: [TagsService],
  exports: [TagsService],
})
export class TagsModule {}
