import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ViewPreference } from '../../entities/view-preference.entity';
import { ViewPreferencesController } from './view-preferences.controller';
import { ViewPreferencesService } from './view-preferences.service';

@Module({
  imports: [TypeOrmModule.forFeature([ViewPreference])],
  controllers: [ViewPreferencesController],
  providers: [ViewPreferencesService],
})
export class ViewPreferencesModule {}
