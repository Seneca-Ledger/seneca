import { Module } from '@nestjs/common';
import { GeocodingService } from './geocoding.service';

@Module({
  providers: [GeocodingService],
  exports: [GeocodingService],
})
export class GeocodingModule {}
