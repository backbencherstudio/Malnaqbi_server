import { Module } from '@nestjs/common';
import { BusinessOwnerService } from './business-owner.service';
import { BusinessOwnerController } from './business-owner.controller';

@Module({
  controllers: [BusinessOwnerController],
  providers: [BusinessOwnerService],
})
export class BusinessOwnerModule {}
