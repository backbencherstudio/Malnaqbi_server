import {
    IsString,
    IsOptional,
    IsInt,
    Min,
    Max,
    IsArray,
    ArrayNotEmpty,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateExperienceDto {
    @IsString()
    place_id: string;

    @IsOptional()
    @IsInt()
    @Type(() => Number)
    @Min(1)
    @Max(5)
    rating?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform((value)=>{
    return JSON.parse(value.value);
  })
    tags?: string[];

    @IsString()
    review_title?: string;

    @IsString()
    review_body?: string;

    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsString()
    description?: string;
}
