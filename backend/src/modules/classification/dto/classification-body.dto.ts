import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

/**
 * Inline structural types on a `@Body()` leave the global ValidationPipe with an
 * `Object` metatype, so nothing was validated — `transactionIds` could arrive as
 * anything, including a non-array that then threw deeper in the service.
 */
export class ClassifyBulkDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  transactionIds: string[];
}
