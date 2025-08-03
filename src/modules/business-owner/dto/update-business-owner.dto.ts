import { PartialType } from '@nestjs/swagger';
import { CreateBusinessOwnerDto } from './create-business-owner.dto';

export class UpdateBusinessOwnerDto extends PartialType(CreateBusinessOwnerDto) {}
