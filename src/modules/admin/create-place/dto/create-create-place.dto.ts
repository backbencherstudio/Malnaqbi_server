import { Day } from '@prisma/client';
import { 
  IsString, 
  IsOptional, 
  IsArray, 
  IsNumber, 
  IsLatitude, 
  IsLongitude, 
  IsEnum,  
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

class AvailabilityDto {
  @IsEnum(Day)
  day: Day;

  @IsString()
  openTime: string;

  @IsString()
  closeTime: string;
}

export class CreateCreatePlaceDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  phone_number?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsString()
  category_id: string;

  @IsOptional()
  @IsArray()
  @Type(() => AvailabilityDto)
  @Transform((value)=>{
    return JSON.parse(value.value);
  })
  availability?: AvailabilityDto[];

//   @IsOptional()
//   @IsNumber()
//   @Transform(({ value }) => Number(value))
//   locationId: number;

//   @IsLatitude()
//   latitude: number;

//   @IsLongitude()
//   longitude: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform((value)=>{
    return JSON.parse(value.value);
  })
  type?: string[];

  @IsString()
  location?: string;
}