import { IsArray, IsString, IsOptional, IsNumber } from 'class-validator';

class OrderItemDto {
  @IsString()
  product_id: string;

  @IsNumber()
  quantity: number;
}

export class CreateOrderDto {


  @IsArray()
  @IsOptional()
  order_items: OrderItemDto[];

  @IsString()
  @IsOptional()
  pakage_name?: string;

  @IsString()
  @IsOptional()
  service_id?: string;

  @IsString()
  @IsOptional()
  payment_method?: string;  // Optional, default can be "wallet"

  @IsString()
  @IsOptional()
  payment_status?: string;  // Optional, default can be "pending"

  @IsNumber()
  @IsOptional()
  total_price?: number;
}
