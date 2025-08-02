import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, MinLength } from 'class-validator';

export class CreateBusinessOwnerDto {
  @IsNotEmpty()
  @ApiProperty()
  name?: string;


  @IsNotEmpty()
  @ApiProperty()
  address?: string;

  @IsNotEmpty()
  @ApiProperty()
  phone_number?: string;

  @IsNotEmpty()
  @MinLength(8, { message: 'Password should be minimum 8' })
  @ApiProperty()
  password: string;

  @ApiProperty({
    type: String,
    example: 'user',
  })
  type?: string;
}
