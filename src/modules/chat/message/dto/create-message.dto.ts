import { IsString, IsNotEmpty } from 'class-validator';

 export class MessageToAdminDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  message: string;
}


export class MessageToUserDto {
  @IsString()
  adminId: string;

  @IsString()
  userId: string;

  @IsString()
  message: string;
}
