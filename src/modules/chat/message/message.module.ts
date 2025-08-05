// message.module.ts
import { Global, Module } from '@nestjs/common';
import { MsgService } from './message.service';

import { MessageGateway } from './message.gateway'; // Import MessageGateway
import { PrismaService } from 'src/prisma/prisma.service'; // PrismaService import
import { MsgController } from './message.controller';

@Global()
@Module({
  controllers: [MsgController], // Add the MsgController
  providers: [MsgService, PrismaService, MessageGateway], // Add MessageGateway as a provider
  exports: [MsgService, MessageGateway], // Export MessageGateway if needed by other modules
})
export class MessageModule { }
