import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCreatePlaceDto } from './dto/create-create-place.dto';
import * as path from 'path';
import appConfig from 'src/config/app.config';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import axios from 'axios';
@Injectable()
export class CreatePlaceService {
  constructor(private readonly prisma: PrismaService) { }
  // async create(
  //   userId: string,
  //   createPlaceDto: CreateCreatePlaceDto,
  //   image?: Express.Multer.File
  // ) {
  //   const user = await this.prisma.user.findUnique({
  //     where: { id: userId },
  //     select: { id: true, type: true },
  //   });

  //   if (!user) {
  //     return {
  //       success: false,
  //       message: 'User not found',
  //     };
  //   }

  //   if (user.type !== 'BUSINESS_OWNER' && user.type !== 'ADMIN') {
  //     return {
  //       success: false,
  //       message: 'Unauthorized user type',
  //     };
  //   }

  //   let {
  //     title,
  //     description,
  //     phone_number,
  //     category_id,
  //     availability,
  //     // locationId,
  //     // latitude,
  //     // longitude,
  //     location,
  //     type,
  //   } = createPlaceDto;



  // // Convert latitude and longitude to numbers if they are passed as strings
  // // latitude = parseFloat(latitude as any);  // Convert to number
  // // longitude = parseFloat(longitude as any);  // Convert to number

  // //   console.log('Latitude:', latitude);
  // //   console.log('Longitude:', longitude);
  // //   console.log('Latitude Type:', typeof latitude);
  // //   console.log('Longitude Type:', typeof longitude);
  // //   if (typeof latitude !== 'number' || typeof longitude !== 'number') {
  // //     throw new Error('Invalid latitude or longitude values');
  // //   }

  //   let imageFileName: string | undefined;

  //   if (image) {
  //     imageFileName = await this.uploadImage(image);
  //   }

  //   try {
  //     const place = await this.prisma.place.create({
  //       data: {
  //         title,
  //         description,
  //         phone_number,
  //         category_id,
  //         image: imageFileName,
  //         type,
  //         location,
  //         user_id: userId,
  //         availability: {
  //           create: availability?.map((item) => ({
  //             day: item.day,
  //             openTime: item.openTime,
  //             closeTime: item.closeTime,
  //           })),
  //         },
  //       },
  //     });

  //     return {
  //       success: true,
  //       message: 'Place created successfully',
  //       data: place,
  //     };
  //   } catch (error) {
  //     console.error('Error creating place:', error);
  //     return {
  //       success: false,
  //       message: 'There was an error creating the place',
  //     };
  //   }
  // }

  async create(
    userId: string,
    createPlaceDto: CreateCreatePlaceDto,
    image?: Express.Multer.File
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, type: true, phone_number: true },
    });

    const existingBusinessOwner = await this.prisma.businessOwner.findFirst({
      where: { user_id: userId }
    });

    if (!user || !existingBusinessOwner) {
      return {
        success: false,
        message: 'User not found',
      };
    }

    if (!user) {
      return {
        success: false,
        message: 'User not found',
      };
    }

    if (user.type !== 'BUSINESS_OWNER' && user.type !== 'ADMIN') {
      return {
        success: false,
        message: 'Unauthorized user type',
      };
    }

    let {
      title,
      description,
      phone_number,
      category_id,
      availability,
      location,
      type,
    } = createPlaceDto;

    const geoResult = await this.getLatLongFromLocation(location);

    if (!geoResult.success) {
      return {
        success: false,
        message: geoResult.message || 'Failed to get latitude and longitude for the location.',
      };
    }

    const { latitude, longitude } = geoResult;

    let imageFileName: string | undefined;

    if (image) {
      imageFileName = await this.uploadImage(image);
    }

    try {
      const place = await this.prisma.place.create({
        data: {
          title,
          description,
          phone_number: user.phone_number,
          business_owner_id: existingBusinessOwner.id,
          category_id,
          location,
          latitude,
          longitude,
          image: imageFileName,
          type,
          user_id: userId,
          availability: {
            create: availability?.map((item) => ({
              day: item.day,
              openTime: item.openTime,
              closeTime: item.closeTime,
            })),
          },
        },
      });

      return {
        success: true,
        message: 'Place created successfully',
        data: {
          ...place,
          latitude,
          longitude,
        },
      };
    } catch (error) {
      console.error('Error creating place:', error);
      return {
        success: false,
        message: 'There was an error creating the place',
      };
    }
  }
  async getLatLongFromLocation(location: string) {

    const apiKey = process.env.MAP_CREDENTAILS;

    try {
      const response = await axios.get(
        `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(location)}&key=${apiKey}&language=en&pretty=1`
      );

      if (response.data && response.data.results && response.data.results.length > 0) {
        const { lat, lng } = response.data.results[0].geometry;

        return {
          success: true,
          latitude: lat,
          longitude: lng,
        };
      } else {
        return {
          success: false,
          message: 'Location not found',
        };
      }
    } catch (error) {
      console.error('Error fetching geolocation:', error);
      return {
        success: false,
        message: `Error fetching geolocation: ${error.message}`,
      };
    }
  }
  private async uploadImage(file: Express.Multer.File): Promise<string> {
    const fileName = `${Date.now()}-${file.originalname}`;
    await SojebStorage.put(
      `${appConfig().storageUrl.place}/${fileName}`,
      file.buffer,
    );
    return fileName;
  }
  //--------------end of create place service-----------------//
  //--------------only ADMIN and BUSINESS_OWNER can create place-----------------//


  //------------------get all places------------------//
  async findAll() {
    return this.prisma.place.findMany({
      include: {
        category: true,
        availability: true,
        ExperienceReview:{
          select:
          {
            id: true,
            rating: true,
            review_title: true,
            review_body: true,
            imgage: true,
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          }
        }
      },
    });
  }
  async findOne(id: string) {
    return this.prisma.place.findUnique({
      where: { id },
      include: {
        category: true,
        availability: true,
        ExperienceReview:{
          select:
          {
            id: true,
            rating: true,
            review_title: true,
            review_body: true,
            imgage: true,
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          }
        }
      },
    });
  }
  //--------------end of get all places-----------------//


  //need to test this service
  async update(id: string, updatePlaceDto: CreateCreatePlaceDto) {
    const { title, description, phone_number, category_id, availability, location, type } = updatePlaceDto;

    return this.prisma.place.update({
      where: { id },
      data: {
        title,
        description,
        phone_number,
        category_id,
        location,
        type,
        availability: {
          deleteMany: {},
          create: availability?.map((item) => ({
            day: item.day,
            openTime: item.openTime,
            closeTime: item.closeTime,
          })),
        },
      },
    });
  }
  // Delete a place by ID (soft delete)
  async remove(id: string) {
    return this.prisma.place.update({
      where: { id },
      data: {
        deleted_at: new Date(),
      },
    });
  }




}
