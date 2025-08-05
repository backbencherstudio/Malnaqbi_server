import { Controller, Get, Post, Body, Patch, Param, Delete, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { BusinessOwnerService } from './business-owner.service';
import { CreateBusinessOwnerDto } from './dto/create-business-owner.dto';
import { UpdateBusinessOwnerDto } from './dto/update-business-owner.dto';
import { FileFieldsInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { verifyBusinessinfo } from './dto/verify-business.dtp';

@Controller('business-owner')
export class BusinessOwnerController {
  constructor(private readonly businessOwnerService: BusinessOwnerService) {}



  @Post('verfy-application')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'id_document', maxCount: 1 },
    { name: 'trade_license', maxCount: 1 },
  ]))
  async createBusinessOwner(
    @Req() req: any,
    @Body() body: verifyBusinessinfo,
    @UploadedFiles() files: { id_document?: Express.Multer.File[], trade_license?: Express.Multer.File[] },
  ) {
    const id_document = files?.id_document?.[0];
    const trade_license = files?.trade_license?.[0];
  
    return this.businessOwnerService.createBusinessOwner(
      req.user.id,
      body,
      id_document,
      trade_license,
    );
  }
  

  @Get('orders')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async getAllOrders(@Req() req: any) {
    const userId = req.user.userId;
    return this.businessOwnerService.getAllOrders(userId);
  }


}
