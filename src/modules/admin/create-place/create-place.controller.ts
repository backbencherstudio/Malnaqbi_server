import { Controller, Post, Body, UploadedFiles, UseInterceptors, UseGuards, Req, BadRequestException, InternalServerErrorException, Get, Param, Patch } from '@nestjs/common';
import { CreatePlaceService } from './create-place.service';
import { CreateCreatePlaceDto } from './dto/create-create-place.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';

@Controller('create-place')
export class CreatePlaceController {
  constructor(private readonly createPlaceService: CreatePlaceService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'place', maxCount: 1 }, 
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
    
    const placeImage = files?.place?.[0]; 

    return this.createPlaceService.create(
      req.user.id,  
      body,          
      placeImage,
    );
  }

 
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

}
