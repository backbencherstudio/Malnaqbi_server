import { IsString, IsOptional, IsInt, IsDateString } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsInt()
  status?: number;

  @IsString()
  slug: string;
}
