import { Controller, Get, UseGuards } from '@nestjs/common';
import { SchemaParams, SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  JurisdictionParams,
  JurisdictionRateList,
  TaxJurisdictionList,
  TaxRatesOnDateQuery,
} from '../../contracts';
import { JurisdictionsService } from './jurisdictions.service';

/**
 * Global reference data, so this controller guards on JWT only — there is no
 * workspace context to check and no per-workspace permission that would mean
 * anything here.
 */
@Controller('tax/jurisdictions')
@UseGuards(JwtAuthGuard)
export class JurisdictionsController {
  constructor(private readonly jurisdictionsService: JurisdictionsService) {}

  @Get()
  @SchemaResponse(TaxJurisdictionList)
  async findAll() {
    return this.jurisdictionsService.findAll();
  }

  @Get(':code')
  async findOne(@SchemaParams(JurisdictionParams) { code }: JurisdictionParams) {
    return this.jurisdictionsService.findByCode(code);
  }

  /**
   * `?date=YYYY-MM-DD` narrows to the rates in force on that day; without it
   * you get every version, which is what the settings timeline wants.
   */
  @Get(':code/rates')
  @SchemaResponse(JurisdictionRateList)
  async findRates(
    @SchemaParams(JurisdictionParams) { code }: JurisdictionParams,
    @SchemaQuery(TaxRatesOnDateQuery) query: TaxRatesOnDateQuery,
  ) {
    const jurisdiction = await this.jurisdictionsService.findByCode(code);

    return query.date
      ? this.jurisdictionsService.findRatesForDate(jurisdiction.id, query.date)
      : this.jurisdictionsService.findAllRates(jurisdiction.id);
  }
}
