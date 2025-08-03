import { PartialType } from '@nestjs/swagger';
import { CreateCreatePlaceDto } from './create-create-place.dto';

export class UpdateCreatePlaceDto extends PartialType(CreateCreatePlaceDto) {}
