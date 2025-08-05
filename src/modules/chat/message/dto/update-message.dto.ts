import { PartialType } from '@nestjs/swagger';
import { MessageToAdminDto } from './create-message.dto';

export class UpdateMessageDto extends PartialType(MessageToAdminDto) {}
