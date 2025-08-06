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
  async getAllOrders(userId: string) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          BusinessOwner: {
            select: {
              id: true,
              business_name: true,
              business_type: true,
            },
          },
        },
      });

      const products = await this.prisma.product.findMany({
        where: { business_owner_id: userId },
        include: {
          business_owner: {
            select: {
              id: true,
              business_name: true,
              business_type: true,
            },
          },
        },
      });

      const orders = await this.prisma.order.findMany({
        where: { user_id: userId },
        select: {
          id: true,
          total_price: true,
          status: true,
          created_at: true,
          updated_at: true,
          user_id: true,
        },
      })

      if (user.BusinessOwner.length === 0) {
        return {
          success: false,
          message: 'User is not a business owner',
        };

      }

      if (!user || user.type !== 'business_owner') {
        return {
          success: false,
          message: 'User not found or is not a business owner',
        };
      }



      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }


      return {
        success: true,
        return: orders,
      };
    } catch (error) {
      console.error('Error fetching orders:', error);

      throw new InternalServerErrorException('Failed to fetch orders');
    }
  }


}
