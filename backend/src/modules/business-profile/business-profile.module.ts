import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceBusinessProfile } from '../../entities/workspace-business-profile.entity';
import { BusinessProfileController } from './business-profile.controller';
import { BusinessProfileService } from './business-profile.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkspaceBusinessProfile])],
  controllers: [BusinessProfileController],
  providers: [BusinessProfileService],
  exports: [BusinessProfileService],
})
export class BusinessProfileModule {}
