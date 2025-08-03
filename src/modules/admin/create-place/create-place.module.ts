import { Module } from '@nestjs/common';
import { CreatePlaceService } from './create-place.service';
import { CreatePlaceController } from './create-place.controller';

@Module({
  controllers: [CreatePlaceController],
  providers: [CreatePlaceService],
})
export class CreatePlaceModule {}
