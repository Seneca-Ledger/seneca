import { ApiProperty } from '@nestjs/swagger';

export class ApiKeyCreatedResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: 'Full key — shown only once, store it securely' })
  key: string;

  @ApiProperty()
  prefix: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  createdAt: Date;
}

export class ApiKeyListItemDto {
  @ApiProperty()
  id: string;
  @ApiProperty({ nullable: true, description: 'null = unrestricted (key made before scopes)' })
  scopes: string[] | null;

  @ApiProperty()
  name: string;

  @ApiProperty()
  prefix: string;

  @ApiProperty({ nullable: true })
  lastUsedAt: Date | null;

  @ApiProperty({ nullable: true })
  expiresAt: Date | null;

  @ApiProperty()
  createdAt: Date;
}
