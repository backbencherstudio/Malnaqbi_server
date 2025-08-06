import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MessageGateway } from './message.gateway'; // Path to your MessageGateway file
import { PrismaService } from 'src/prisma/prisma.service'; // Assuming PrismaService is correctly imported
import { MessageStatus } from '@prisma/client'; // Import the MessageStatus enum

@Injectable()
export class MsgService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messageGateway: MessageGateway,
) {}
// Send message to admin (even if admin is not currently online)
async sendMessageToAdmin(userId: string, message: string): Promise<{ success: boolean, message: string, data: any }> {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
  });
 

  if (!user) {
    throw new Error('User not found');
  }

  if (user.type !== 'user') {
    return {
      message: 'Only users can send messages to admin',
      success: false,
      data: null,
    };
  }

  let conversation = await this.prisma.conversation.findFirst({
    where: {
      creator_id: userId,
    },
  });

 let is_new_conversation = false;

  if (!conversation) {
    is_new_conversation = true;
    conversation = await this.prisma.conversation.create({
      data: {
        creator_id: userId,
        participant_id: "cmdy3sc690001repcewppl7sj",
      },
      include: {
        creator: {
          select: {
            id: true, 
            phone_number: true,
            type: true,
          },
        },
        participant: {
          select: {
            id: true,
            status: true,
            phone_number: true,
            type: true,
          },
        },
        messages: {
          orderBy: {
            created_at: 'asc', 
          },
        }, 
      },
    });

    //     const conversation_final = await this.prisma.conversation.findUnique({
    //   where: { id: conversation.id },
    //   include: {
    //     creator: {
    //       select: {
    //         id: true, // Select only the specified fields for creator
    //         created_at: true,
    //         status: true,
    //         email: true,
    //         phone_number: true,
    //         billing_id: true,
    //         type: true,
    //       },
    //     },
    //     participant: {
    //       select: {
    //         id: true, // Select only the specified fields for participant
    //         created_at: true,
    //         status: true,
    //         email: true,
    //         phone_number: true,
    //         billing_id: true,
    //         type: true,
    //       },
    //     },
    //     messages: {
    //       orderBy: {
    //         created_at: 'asc', // Order messages by creation date
    //       },
    //     }, // Include all messages related to the conversation
    //   },
    // });

     


    console.log('New conversation created: ', conversation.id);
  }

  const newMessage = await this.prisma.message.create({
    data: {
      sender_id: userId, 
      receiver_id: (await this.prisma.user.findFirst({
        where: {
          type: 'admin',
        },
        select: { id: true },
      }))?.id,
      message,
      status: 'PENDING',
      conversation_id: conversation.id,
    },
  });

  conversation['messages'].push(newMessage);

  if(is_new_conversation){
    this.messageGateway.server.emit('new_conversation', {
      // conversationId: conversation.id,
      // userId,
      // message,
      conversation
    });

  }


  if (this.messageGateway.adminSocketIds.length > 0) {
    this.messageGateway.adminSocketIds.forEach(adminSocketId => {
      this.messageGateway.server.to(adminSocketId).emit('message_from_user', {
        userId,
        message,
        username: user.name || 'Unknown User', 
        messageId: newMessage.id,
        conversationId: conversation.id,
      });
    });

    await this.prisma.message.update({
      where: { id: newMessage.id },
      data: { status: 'SENT' }, 
    });

    return { success: true, message: 'Message sent to admin', data: newMessage };
  } else {
    return { success: true, message: 'Message sent, waiting for admin to come online', data: newMessage };
  }
}
// Send message to user from admin (even if user is not currently online)
async sendMessageToUser(adminId: string, userId: string, message: string) {
  const admin = await this.prisma.user.findUnique({
    where: { id: adminId },
  });

  if (!admin || admin.type !== 'admin') {
    return {
      message: 'Only admins can send messages to users',
      success: false,
      data: null,
    };
  }

  const userSocketId = this.messageGateway.getSocketIdByUserId(userId);

  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    select: { type: true },
  });

  if (user.type !== 'user') {
    return {
      message: 'Your type is not user, you cannot send message to admin',
      success: false,
      data: null,
    };
  }

  let conversation = await this.prisma.conversation.findFirst({
    where: {
      creator_id: userId,
    },
  });

  if (conversation) {
    if (conversation.participant_id !== adminId) {
      conversation = await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { participant_id: adminId },
      });
      console.log('Conversation updated with new admin participant_id');
    }
  }

  if (!conversation) {
    conversation = await this.prisma.conversation.create({
      data: {
        participant: { connect: { id: adminId } },
        creator: { connect: { id: userId } },
      },
    });
    console.log('New conversation created: ', conversation.id);
  }

  const newMessage = await this.prisma.message.create({
    data: {
      sender_id: adminId,
      receiver_id: userId,
      message,
      status: MessageStatus.PENDING,
      conversation_id: conversation.id,
    },
  });

  if (userSocketId) {
    this.messageGateway.server
      .to(userSocketId)
      .emit('message_from_admin', { message, messageId: newMessage.id });

    await this.prisma.message.update({
      where: { id: newMessage.id },
      data: { status: MessageStatus.SENT },
    });

    return { success: true, message: `Message sent to user ${userId}`, data: newMessage };
  } else {
    return { success: true, message: `Message sent to user ${userId}, waiting for them to log in`, data: newMessage };
  }
}
async broadcastAdminMessage(message: string, senderId: string) {
  this.messageGateway.adminSocketIds.forEach(adminSocketId => {
    if (adminSocketId !== senderId) {
      this.messageGateway.server.to(adminSocketId).emit('admin_message_received', {
        senderId,
        message,
        timestamp: new Date().toISOString(),
      });
    }
  });
}
// Mark message as delivered
async markMessageAsDelivered(messageId: string) {
    const message = await this.prisma.message.update({
      where: { id: messageId },
      data: { status: MessageStatus.DELIVERED },
    });

    return { success: true, message: 'Message marked as delivered', data: message };
}
// Mark message as read
async markMessageAsRead(messageId: string) {
    const message = await this.prisma.message.update({
      where: { id: messageId },
      data: { status: MessageStatus.READ },
    });

    return { success: true, message: 'Message marked as read', data: message };
}
//get messages using conversation id 
async getMessagesByConversation(conversationId: string) {
  return this.prisma.message.findMany({
    where: { conversation_id: conversationId },
    orderBy: {
      created_at: 'asc', // Order messages by creation date
    },
  });
}
//get all converation
async getAllConversations() {
  try {
    const conversations = await this.prisma.conversation.findMany({
      include: {
        creator: {
          select: {
            id: true, // Select only the specified fields for creator
            status: true,
            name: true,
            phone_number: true,

            type: true,
          },
        },
        participant: {
          select: {
            id: true, 
            status: true,
            phone_number: true,

            type: true,
          },
        },
        messages: true,
      },
      orderBy: {
        created_at: 'asc', 
      },
    });

    return conversations;
  } catch (error) {
    console.error('Error fetching conversations:', error);
    throw new Error('Could not fetch conversations');
  }
}
//get one conversation
async getOneConversation(conversationId: string) {
  try {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        creator: {
          select: {
            id: true, // Select only the specified fields for creator
            created_at: true,
            status: true,
            email: true,
            phone_number: true,
            billing_id: true,
            type: true,
          },
        },
        participant: {
          select: {
            id: true, // Select only the specified fields for participant
            created_at: true,
            status: true,
            email: true,
            phone_number: true,
            billing_id: true,
            type: true,
          },
        },
        messages: {
          orderBy: {
            created_at: 'asc', // Order messages by creation date
          },
        }, // Include all messages related to the conversation
      },
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    return conversation;
  } catch (error) {
    console.error('Error fetching conversation:', error);
    throw new Error('Could not fetch the conversation');
  }
}
// Get one conversation by user ID
async getOneConversationByUserID(userID: string) {
  if (!userID) {
    throw new Error('Invalid userID');
  }

  try {
    // Step 2: Log the userID and start fetching the conversation
    console.log(`Fetching conversation for user: ${userID}`);

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        OR: [
          { creator_id: userID }, 
          { participant_id: userID }, 
        ],
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            phone_number: true,
            type: true,
          },
        },
        participant: {
          select: {
            id: true,
            phone_number: true,
            type: true,
          },
        },
        messages: {
          orderBy: {
            created_at: 'asc', 
          },
        },
      },
    });

    // Step 3: Log the result of the query for debugging
   // console.log('Conversation fetched:', conversation);

    if (!conversation) {
      throw new Error(`No conversation found for user: ${userID}`);
    }

    return conversation;
  } catch (error) {
    console.error('Error fetching conversation:', error.message);
    throw new Error(`Could not fetch conversation for user ${userID}: ${error.message}`);
  }
}
}