import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCreatePlaceDto } from './dto/create-create-place.dto';
import * as path from 'path';
import appConfig from 'src/config/app.config';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import axios from 'axios';
import { CreateProductDto } from './dto/create-product-dto';
import e from 'express';
@Injectable()
export class CreatePlaceService {
  constructor(private readonly prisma: PrismaService) { }
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

      const imageUrl = place.image
        ? SojebStorage.url(`${appConfig().storageUrl.place}/${place.image}`)
        : null;

      return {
        success: true,
        message: 'Place created successfully',
        // data: {
        //   ...place,
        //   latitude,
        //   longitude,
        //   image: imageUrl,
        // },
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
    const places = await this.prisma.place.findMany({
      include: {
        category: true,
        availability: true,
        ExperienceReview: {
          select: {
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
          },
        },
        _count: {
          select: {
            ExperienceReview: true,
          },
        },
      },
    });

    const result = places.map((place) => {
      const reviews = place.ExperienceReview;
      const totalReviews = reviews.length;
      const avgRating =
        totalReviews > 0
          ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / totalReviews
          : 0;

      return {
        ...place,
        avgRating: parseFloat(avgRating.toFixed(1)),
        totalReviews: place._count.ExperienceReview,
        image_url: place.image
          ? SojebStorage.url(`${appConfig().storageUrl.place}/${place.image}`)
          : null,
      };
    });

    return result;
  }
  async findOne(id: string) {
    const place = await this.prisma.place.findUnique({
      where: { id },
      include: {
        category: true,
        availability: true,
        ExperienceReview: {
          select: {
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
          },
        },
        Product: {
          select: {
            id: true,
            title: true,
            description: true,
            price: true,
            in_stock: true,
            type: true,
            image: true,
            offer_title: true,
            start_date: true,
            end_date: true,
            qr_code_required: true,
            offer_active: true,
          },
        },
        _count: {
          select: {
            ExperienceReview: true,
          },
        },
      },
    });

    if (!place) return null;

    const reviews = place.ExperienceReview;
    const totalReviews = reviews.length;
    const avgRating =
      totalReviews > 0
        ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / totalReviews
        : 0;



    return {
      ...place,
      avgRating: parseFloat(avgRating.toFixed(1)),
      totalReviews: place._count.ExperienceReview,
      image_url: place.image
        ? SojebStorage.url(`${appConfig().storageUrl.place}/${place.image}`)
        : null, // Return the full image URL
    };
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


  //---------------start create product------------------//
  async createProduct(
    createProductDto: CreateProductDto,
    imageFiles: Express.Multer.File[],
    userId: string
  ) {
    const {
      title,
      description,
      price,
      in_stock,
      type,
      offer_title,
      start_date,
      end_date,
      place_id,
      qr_code_required,
      offer_active,
    } = createProductDto;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || (user.type !== 'BUSINESS_OWNER' && user.type !== 'ADMIN')) {
      return { success: false, message: 'Unauthorized: Only Business Owners and Admins can create products' };
    }

    const existingBusinessOwner = await this.prisma.businessOwner.findFirst({
      where: { user_id: userId }
    });
    if (!existingBusinessOwner) {
      return { success: false, message: 'Business Owner not found for the user' };
    }

    const place = await this.prisma.place.findUnique({
      where: { id: place_id },
      select: { id: true, business_owner_id: true },
    });

    if (!place) {
      return { success: false, message: 'Place not found' };
    }

    if (place.business_owner_id !== existingBusinessOwner.id) {
      return { success: false, message: 'Unauthorized: You can only create products for your own places' };
    }

    const imageName = await this.uploadProductImage(imageFiles[0]);

    const product = await this.prisma.product.create({
      data: {
        title,
        description,
        price,
        in_stock,
        user_id: userId,
        business_owner_id: existingBusinessOwner.id,
        type,
        image: imageName,
        offer_title,
        start_date,
        place_id,
        end_date,
        qr_code_required,
        offer_active,
      },
    });

    product.image = SojebStorage.url(`${appConfig().storageUrl.place}/${imageName}`);

    return {
      success: true,
      message: 'Product created successfully',
      // data: product,
    };
  }
  private async uploadProductImage(file: Express.Multer.File): Promise<string> {
    const fileName = `${Date.now()}-${file.originalname}`;

    await SojebStorage.put(
      `${appConfig().storageUrl.place}/${fileName}`,
      file.buffer
    );

    return fileName;
  }
  //---------------end create product------------------//

  //---------------start get all products------------------//
  async getAllProducts() {
    const products = await this.prisma.product.findMany({
      include: {
        place: {
          select: {
            id: true,
            title: true,
            image: true,
          },
        },
      },
    });

    const formattedProducts = products.map((product) => ({
      ...product,
      image_url: product.image
        ? SojebStorage.url(`${appConfig().storageUrl.place.replace(/\/$/, '')}/${product.image}`)
        : null,
      place: {
        ...product.place,
        place_image_url: product.place.image
          ? SojebStorage.url(`${appConfig().storageUrl.place.replace(/\/$/, '')}/${product.place.image}`)
          : null,
      },
    }));

    return formattedProducts;
  }
  async getProductById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        place: {
          select: {
            id: true,
            title: true,
            image: true,
          },
        },
      },
    });

    if (!product) return null;

    // Format the product and place image URLs
    return {
      ...product,
      image_url: product.image
        ? SojebStorage.url(`${appConfig().storageUrl.place.replace(/\/$/, '')}/${product.image}`) // Format image URL for product
        : null,
      place: {
        ...product.place,
        place_image_url: product.place.image
          ? SojebStorage.url(`${appConfig().storageUrl.place.replace(/\/$/, '')}/${product.place.image}`) // Format image URL for place
          : null,
      },
    };
  }
  //---------------end get all products------------------//



}


