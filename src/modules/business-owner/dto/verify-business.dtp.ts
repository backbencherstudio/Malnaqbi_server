import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";

export class verifyBusinessinfo {
  @IsNotEmpty()
  @ApiProperty()
  business_name: string;
  
  @IsNotEmpty()
  @ApiProperty()
  business_type: string;

  @ApiProperty({ type: 'string', format: 'binary', required: false })
  id_document?: any;  
  
  @ApiProperty({ type: 'string', format: 'binary', required: false })
  trade_license?: any;
}
