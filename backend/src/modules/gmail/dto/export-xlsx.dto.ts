import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class ExportXlsxDto {
  @ApiProperty({ description: 'Array of receipt IDs to export', type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  receiptIds: string[];
}
