import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstanceSetting, WorkspaceServiceSettings } from '../../entities';
import { ApplicationSettingsController } from './application-settings.controller';
import { ApplicationSettingsService } from './application-settings.service';
import { InstanceSettingsController } from './instance-settings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WorkspaceServiceSettings, InstanceSetting])],
  controllers: [ApplicationSettingsController, InstanceSettingsController],
  providers: [ApplicationSettingsService],
  exports: [ApplicationSettingsService],
})
export class ApplicationSettingsModule {}
