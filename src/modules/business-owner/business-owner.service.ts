import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CreateBusinessOwnerDto } from './dto/create-business-owner.dto';
import { UpdateBusinessOwnerDto } from './dto/update-business-owner.dto';
import e from 'express';
import { verifyBusinessinfo } from './dto/verify-business.dtp';
import { PrismaService } from 'src/prisma/prisma.service';
import { StringHelper } from 'src/common/helper/string.helper';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';

@Injectable()
export class BusinessOwnerService {

  constructor(private readonly prisma: PrismaService) { }


  //------------------apply for business owner-------------------
  async createBusinessOwner(
    userId: string,
    createBusinessOwnerDto: verifyBusinessinfo,
    id_document?: Express.Multer.File,
    trade_license?: Express.Multer.File,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    let idDocFileName: string | undefined;
    let tradeLicenseFileName: string | undefined;

    try {
      if (id_document) {
        idDocFileName = await this.uploadDocument(
          id_document,
          appConfig().storageUrl.idDocument
        );
      }

      if (trade_license) {
        tradeLicenseFileName = await this.uploadDocument(
          trade_license,
          appConfig().storageUrl.tradeLicense
        );
      }
    } catch (error) {
      console.error('File upload failed:', error);
      return {
        success: false,
        message: 'File upload failed',
      };
    }

    const businessOwner = await this.prisma.businessOwner.create({
      data: {
        user_id: userId,
        business_name: createBusinessOwnerDto.business_name,
        business_type: createBusinessOwnerDto.business_type,
        id_document: idDocFileName,
        trade_license: tradeLicenseFileName,
      },
    });

    const result = {
      ...businessOwner,
      ...(idDocFileName && {
        id_document_url: SojebStorage.url(
          `${appConfig().storageUrl.idDocument}/${idDocFileName}`
        ),
      }),
      ...(tradeLicenseFileName && {
        trade_license_url: SojebStorage.url(
          `${appConfig().storageUrl.tradeLicense}/${tradeLicenseFileName}`
        ),
      }),
    };

    return {
      success: true,
      message: 'Business owner created successfully',
      data: result,
    };
  }
  private async uploadDocument(file: Express.Multer.File, folderPath: string): Promise<string> {
    const fileName = `${StringHelper.randomString()}-${file.originalname}`;
    await SojebStorage.put(`${folderPath}/${fileName}`, file.buffer);
    return fileName;
  }
  //-------------------apply for business owner end-------------------





  //------------------product management business owner-------------------


  //------------------get all orders-------------------

  async getAllOrders() {
    const orders = await this.prisma.order.findMany({
      select: {
        id: true,
        total_price: true,
        status: true,
        created_at: true,
        updated_at: true,
        user_id: true,
        user: {
          select: {
            name: true,
            email: true,
            phone_number: true,
          },
        },
        cart_items: {
          select: {
            quantity: true,
            product: {
              select: {
                id: true,
                title: true,
                price: true,
                business_owner: {
                  select: {
                    id: true,
                    business_name: true,
                    user_id: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!orders || orders.length === 0) {
      return {
        success: false,
        message: 'No orders found',
      };
    }

    const formattedOrders = orders.map(order => ({
      id: order.id,
      total_price: order.total_price,
      status: order.status,
      created_at: order.created_at,
      updated_at: order.updated_at,


      odered_user_details: {
        user_id: order.user_id,
        name: order.user?.name || 'Unknown User',
        email: order.user?.email || null,
        phone_number: order.user?.phone_number || null,
      },

      businessOwner_details:
        order.cart_items.length > 0
          ? {
            id: order.cart_items[0].product.business_owner.id,
            business_name: order.cart_items[0].product.business_owner.business_name,
            user_id: order.cart_items[0].product.business_owner.user_id,
          }
          : null,

      cart_details: order.cart_items.map(item => ({
        product_id: item.product.id,
        title: item.product.title,
        price: item.product.price,
        quantity: item.quantity,
      })),
    }));

    return {
      success: true,
      message: 'Orders fetched successfully',
      orders: formattedOrders,
    };
  }

  async getAllOrderByBusinessUserId(businessUserId: string) {
    const orders = await this.prisma.order.findMany({
      where: {
        cart_items: {
          some: {
            product: {
              business_owner: {
                user_id: businessUserId,
              },
            },
          },
        },
      },
      select: {
        id: true,
        total_price: true,
        status: true,
        created_at: true,
        updated_at: true,
        user_id: true,
        user: {
          select: {
            name: true,
            email: true,
            phone_number: true,
            city: true,
            country: true,
            address: true,
            state: true,
          },
        },
        cart_items: {
          select: {
            quantity: true,
            product: {
              select: {
                id: true,
                title: true,
                price: true,
                business_owner: {
                  select: {
                    id: true,
                    business_name: true,
                    user_id: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!orders || orders.length === 0) {
      return {
        success: false,
        message: 'No orders found for this business owner',
      };
    }

    const formattedOrders = orders.map(order => ({
      id: order.id,
      total_price: order.total_price,
      status: order.status,
      created_at: order.created_at,
      updated_at: order.updated_at,

      odered_user_details: {
        user_id: order.user_id,
        name: order.user?.name || 'Unknown User',
        email: order.user?.email || null,
        phone_number: order.user?.phone_number || null,
        city: order.user?.city || null,
        country: order.user?.country || null,
        address: order.user?.address || null,
        state: order.user?.state || null,
      },


      cart_details: order.cart_items
        .filter(item => item.product.business_owner.user_id === businessUserId)
        .map(item => ({
          product_id: item.product.id,
          title: item.product.title,
          price: item.product.price,
          quantity: item.quantity,
        })),
    }));

    return {
      success: true,
      message: 'Orders fetched successfully',
      orders: formattedOrders,
    };
  }




}
