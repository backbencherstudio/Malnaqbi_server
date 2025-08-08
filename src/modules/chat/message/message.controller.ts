import { Controller, Post, Body, Get, Param, Patch, UseGuards, Req } from '@nestjs/common';
import { MsgService } from './message.service';
import { MessageToAdminDto, MessageToUserDto } from './dto/create-message.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';


@Controller('messages')
export class MsgController {
  constructor(private readonly msgService: MsgService) { }

  @Post('message-to-admin')
  async sendMessageToAdmin(@Body() messageToAdminDto: MessageToAdminDto) {
    return this.msgService.sendMessageToAdmin(messageToAdminDto.userId, messageToAdminDto.message);
  }

  @Post('message-to-user')
  async sendMessageToUser(@Body() messageToUserDto: MessageToUserDto) {
    return this.msgService.sendMessageToUser(
      messageToUserDto.adminId,
      messageToUserDto.userId,
      messageToUserDto.message
    );
  }
  @Get('conversations')
  async getConversations() {
    return this.msgService.getAllConversations();
  }
  @Get('user/:id')
  async getOneConversation(@Param('id') userId: string) {
    return this.msgService.getOneConversationByUserID(userId);
  }

  @Get('conversation/:id')
  async getConversation(@Param('id') conversationId: string) {
    return this.msgService.getOneConversation(conversationId);
  }

  @Patch('conversation/:id/toggle-status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async updateConversationStatus(
    @Req() req: any,
    @Param('id') conversationId: string,
    @Body('status') status: 'RESOLEVED' | 'OPEN'
  ) {
    const userId = req.user?.userId;
    console.log(`Updating conversation ${conversationId} status to ${status} for user ${userId}`);

    return this.msgService.toggleConversationStatus(conversationId, userId);
  }
}
