import { Controller, Post, Body, UploadedFiles, UseInterceptors, UseGuards, Req, BadRequestException, InternalServerErrorException, Get, Param, Patch } from '@nestjs/common';
import { CreatePlaceService } from './create-place.service';
import { CreateCreatePlaceDto } from './dto/create-create-place.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { CreateProductDto } from './dto/create-product-dto';

@Controller('create-place')
export class CreatePlaceController {
  constructor(private readonly createPlaceService: CreatePlaceService) {}

  //------------------------create place------------------------
  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'img', maxCount: 1 }, 
    ])
  )
  async createPlace(
    @Req() req: any,
    @Body() body: CreateCreatePlaceDto,
    @UploadedFiles() files: { place?: Express.Multer.File[] },
  ) {
    // if (typeof body.availability === 'string') {
    //   body.availability = JSON.parse(body.availability);
    // }
    console.log('Received body:', body);
    
    
    const placeImage = files?.place?.[0]; 

    return this.createPlaceService.create(
      req.user.id,  
      body,          
      placeImage,
    );
  }
//------------------------create place end------------------------


    //------------------------create product------------------------
@Post('product')
@ApiBearerAuth()
@ApiConsumes('multipart/form-data')
@UseGuards(JwtAuthGuard)
@UseInterceptors(FileFieldsInterceptor([{ name: 'images', maxCount: 1 }]))
async createProduct(
  @Body() body: CreateProductDto,
  @UploadedFiles() files: { images?: Express.Multer.File[] },
  @Req() req: any,
) {
  const imageFiles = files?.images;

  if (!imageFiles || imageFiles.length === 0) {
    return { success: false, message: 'No image uploaded' };
  }

  return this.createPlaceService.createProduct(body, imageFiles, req.user.id);
}
  //------------------------create product end ------------------------




  //---------------start get all products------------------//
@Get('products')
async getAllProducts() {
  try {
    return await this.createPlaceService.getAllProducts();
  } catch (error) {
    throw new InternalServerErrorException('Failed to retrieve products');
  }
}

@Get('products/:id')
async getProductById(@Param('id') id: string) {
  const product = await this.createPlaceService.getProductById(id);
  if (!product) {
    throw new BadRequestException('Product not found');
  }
  return product;
}

//---------------end get all products------------------//


 //------------------For Places------------------//
  @Get()
  async getAllPlaces() {
    try {
      return await this.createPlaceService.findAll();
    } catch (error) {
      throw new InternalServerErrorException('Failed to retrieve places');
    }
  }

  @Get(':id')
  async getPlaceById(@Req() req: any, @Param('id') id: string) {
    const place = await this.createPlaceService.findOne(id);
    if (!place) {
      throw new BadRequestException('Place not found');
    }
    return place;
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async updatePlace(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: CreateCreatePlaceDto,
  ) {
    const updatedPlace = await this.createPlaceService.update(id, body);
    if (!updatedPlace) {
      throw new BadRequestException('Failed to update place');
    }
    return updatedPlace;
  }
//------------------For Places End------------------//



}
