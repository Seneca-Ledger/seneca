import { IsNumber, IsOptional, IsString, Length, Matches, Min } from 'class-validator';

/**
 * A coin the user keeps themselves: on an exchange, or in cold storage they would
 * rather not name an address for. One line per ticker; sending the same ticker
 * again replaces the amount rather than adding a second line.
 */
export class ManualHoldingDto {
  /** Ticker, e.g. `BTC`. Upper-cased by the service. */
  @IsString()
  @Length(2, 20)
  @Matches(/^[A-Za-z0-9.$]+$/, { message: 'A ticker is letters and digits' })
  asset: string;

  /** Amount held, as a decimal string: 18-decimal tokens overflow a number. */
  @IsString()
  @Matches(/^\d+(\.\d{1,18})?$/, { message: 'An amount is a positive decimal' })
  amount: string;

  /** What one unit cost, in the workspace currency. Omitted when unknown. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  costPerUnit?: number;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  label?: string;
}
