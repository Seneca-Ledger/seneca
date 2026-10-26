import { ApiProperty } from '@nestjs/swagger';

export class StatementStageSkipDto {
  @ApiProperty()
  id: string;

  @ApiProperty({
    enum: [
      'STATEMENT_NOT_FOUND',
      'STATEMENT_EDIT_FORBIDDEN',
      'INVALID_STAGE_TRANSITION',
      'UNCATEGORIZED_TRANSACTIONS',
    ],
  })
  code: string;
}

export class UpdateStatementStageResultDto {
  @ApiProperty({
    type: [String],
    description: 'Statements now in the requested stage, including ones already there.',
  })
  updated: string[];

  @ApiProperty({ type: [StatementStageSkipDto] })
  skipped: StatementStageSkipDto[];
}
