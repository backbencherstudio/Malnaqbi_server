import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class AddToCartDto {
  @IsString()
  product_id: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number = 1;
}
