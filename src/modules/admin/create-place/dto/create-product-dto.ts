import { IsString, IsOptional, IsNumber, IsDecimal, IsDateString, IsBoolean } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsNumber()
  @Transform(({ value }) => {
    const parsedValue = parseFloat(value);
    if (isNaN(parsedValue)) {
      throw new Error('Price must be a valid decimal number');
    }
    return parsedValue;
  })
  price: number;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => {
    const parsedValue = Number(value);
    if (isNaN(parsedValue)) {
      throw new Error('in_stock must be a valid number');
    }
    return parsedValue;
  })
  in_stock?: number;

  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  images?: string;

  @IsString()
  @IsOptional()
  offer_title?: string;

  @IsDateString()
  @Transform(({ value }) => {
    return new Date(value).toISOString();
  })
  @Type(() => Date)
  start_date?: Date;

  @IsDateString()
  @Transform(({ value }) => {
    return new Date(value).toISOString();
  })
  @Type(() => Date)
  end_date?: Date;

  @IsOptional()
  @IsBoolean()
  qr_code_required?: boolean = false;

  @IsOptional()
  @IsBoolean()
  offer_active?: boolean = false;

  @IsString()
  place_id: string;
}
