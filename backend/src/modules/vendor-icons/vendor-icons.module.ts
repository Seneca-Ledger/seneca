import { Module } from '@nestjs/common';
import { VendorIconsController } from './vendor-icons.controller';
import { VendorIconsService } from './vendor-icons.service';

@Module({
  controllers: [VendorIconsController],
  providers: [VendorIconsService],
})
export class VendorIconsModule {}
