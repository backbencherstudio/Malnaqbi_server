import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { use } from 'passport';
import { Server, Socket } from 'socket.io';
import { PrismaService } from 'src/prisma/prisma.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class MessageGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;
  public users: Record<string, string> = {};
  public adminSocketIds: string[] = []; 
  public readonly ADMIN_ID: string | null = null;

  constructor(private readonly prisma: PrismaService) {}
  async afterInit(server: Server) {
    console.log('WebSocket Gateway initialized');
  }
  async handleConnection(socket: Socket) {
    console.log(`Client connected: ${socket.id}`);
  }
  async handleDisconnect(socket: Socket) {
    console.log(`Client disconnected: ${socket.id}`);
    const userId = this.users[socket.id];
    // Handle user disconnection
    if (userId) {
      delete this.users[socket.id];
      console.log(`User ${userId} disconnected`);

      if (this.adminSocketIds.length > 0) {
        this.adminSocketIds.forEach(adminSocketId => {
          this.server.to(adminSocketId).emit('user_disconnected', userId);
        });
      }
    }
    // Remove admin socketId from the list if an admin disconnects
    if (this.adminSocketIds.includes(socket.id)) {
      this.adminSocketIds = this.adminSocketIds.filter(id => id !== socket.id);
      console.log('Admin disconnected');
    }
  }
  // Register an admin and add their socketId to adminSocketIds
  @SubscribeMessage('register_admin')
  async handleAdminRegister(socket: Socket, adminId: string) {
  console.log(`Admin registration attempt: ${adminId}`);
 console.log("id", { id: adminId, type: 'admin' });
 
    try {
      const existingAdmin = await this.prisma.user.findUnique({
        where: { id: adminId, type: 'admin' },
      });

      if (!existingAdmin) {
        socket.emit('registration_error', 'Admin not found');
        console.log(`Admin ${adminId} not found`);
        
        return;
      }

      // Add admin socketId to the list of active admins
      if (!this.adminSocketIds.includes(socket.id)) {
        this.adminSocketIds.push(socket.id);
      }

      this.users[socket.id] = adminId;

      socket.emit('admin_registered', {
        success: true,
        message: 'Admin successfully registered',
      });

      console.log(`Admin ${adminId} registered with socket ID: ${socket.id}`);
    } catch (error) {
      console.error(`Admin registration error: ${error.message}`);
      socket.emit('registration_error', 'Admin registration failed');
    }
  }
  // Handle user registration
  @SubscribeMessage('register_user')
  async handleUserRegister(socket: Socket, userId: string) {
    console.log(`user registration attempt: ${userId}`);

    try {
      const existingUser = await this.prisma.user.findUnique({
        where: { id: userId, type: 'user' }, // Ensure user is not an admin
      });

      if (!existingUser) {
        socket.emit('registration_error', 'User not found');
        return;
      }

      if (existingUser.type === 'admin') {
        socket.emit('registration_error', 'Admins must use /register_admin');
        return;
      }

      // Register user
      this.users[socket.id] = userId;

      socket.emit('user_registered', {
        success: true,
        userId: existingUser.id,
        conversationId: 'default-conversation-id',
      });

      console.log(`User ${userId} registered with socket ID: ${socket.id}`);

      // Notify all admins about the new user registration
      if (this.adminSocketIds.length > 0) {
        this.adminSocketIds.forEach(adminSocketId => {
          this.server.to(adminSocketId).emit('new_conversation', {
            userId: existingUser.id,
            socketId: socket.id,
            username : existingUser.name || 'Unknown User',
          });
        });
      }
    } catch (error) {
      console.error(`User registration error: ${error.message}`);
      socket.emit('registration_error', 'User registration failed');
    }
  }
  // Handle message from user to all admins
 @SubscribeMessage('message_to_admin')
async handleMessageToAdmin(socket: Socket, message: string) {
  const userId = this.users[socket.id];

  if (!userId) {
    socket.emit('error', 'User not registered.');
    return;
  }

  if (this.adminSocketIds.length === 0) {
    socket.emit('error', 'No admins are currently online.');
    return;
  }

  const admin = await this.prisma.user.findFirst({
    where: {
      type: 'admin', 
    },
    select: { id: true }, 
  });

  if (!admin) {
    socket.emit('error', 'No admin found.');
    return;
  }

  // Send the message to all connected admins
  this.adminSocketIds.forEach(adminSocketId => {
    this.server.to(adminSocketId).emit('message_from_user', {
      userId,
      message,
      socketId: socket.id,
      receiver_id: admin.id, 
    });
  });

  console.log(`Message from ${userId} to all admins: ${message}`);
}
// Handle message from admin to a user
@SubscribeMessage('message_to_user')
async handleMessageToUser(socket: Socket, data: { userId: string; message: string }) {
  const senderId = this.users[socket.id];
  const sender = await this.prisma.user.findUnique({
    where: { id: senderId },
  });

  if (!sender || sender.type !== 'admin') {
    socket.emit('error', 'Only admin can send messages to users.');
    return;
  }

  const userSocketId = this.getSocketIdByUserId(data.userId);

  if (!userSocketId) {
    socket.emit('error', `User ${data.userId} not online.`);
    return;
  }

  // Emit the message to the specific user
  this.server.to(userSocketId).emit('message_from_admin', {
    message: data.message,
    timestamp: new Date().toISOString(),
  });

  console.log(`Message from admin to ${data.userId}: ${data.message}`);

  this.adminSocketIds.forEach(adminSocketId => {
    if (adminSocketId !== socket.id) { 
      this.server.to(adminSocketId).emit('admin_message_received', {
        message: data.message,
        userId: data.userId,
        timestamp: new Date().toISOString(),
        senderId: this.users[socket.id], 
      });
    }
  });
}
  public getSocketIdByUserId(userId: string): string | undefined {
    return Object.keys(this.users).find(socketId => this.users[socketId] === userId);
  }
}
