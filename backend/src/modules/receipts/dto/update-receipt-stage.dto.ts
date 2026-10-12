import { ApiProperty } from '@nestjs/swagger';

export class ReceiptStageSkipDto {
  @ApiProperty()
  id: string;

  @ApiProperty({
    enum: [
      'RECEIPT_NOT_FOUND',
      'RECEIPT_EDIT_FORBIDDEN',
      'INVALID_STAGE_TRANSITION',
      'MISSING_RECEIPT_DATA',
    ],
  })
  code: string;
}

export class UpdateReceiptStageResultDto {
  @ApiProperty({
    type: [String],
    description: 'Receipts now in the requested stage, including ones already there.',
  })
  updated: string[];

  @ApiProperty({ type: [ReceiptStageSkipDto] })
  skipped: ReceiptStageSkipDto[];
}
