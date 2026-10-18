import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceServiceSettings } from '../../entities';
import { ApplicationSettingsController } from './application-settings.controller';
import { ApplicationSettingsService } from './application-settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkspaceServiceSettings])],
  controllers: [ApplicationSettingsController],
  providers: [ApplicationSettingsService],
  exports: [ApplicationSettingsService],
})
export class ApplicationSettingsModule {}
