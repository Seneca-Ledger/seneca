import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { SchemaResponse } from '../../common/effect/schema-response';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JurisdictionRateList, TaxJurisdictionList } from '../../contracts';
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
  async findOne(@Param('code') code: string) {
    return this.jurisdictionsService.findByCode(code);
  }

  /**
   * `?date=YYYY-MM-DD` narrows to the rates in force on that day; without it
   * you get every version, which is what the settings timeline wants.
   */
  @Get(':code/rates')
  @SchemaResponse(JurisdictionRateList)
  async findRates(@Param('code') code: string, @Query('date') date?: string) {
    const jurisdiction = await this.jurisdictionsService.findByCode(code);

    return date
      ? this.jurisdictionsService.findRatesForDate(jurisdiction.id, date)
      : this.jurisdictionsService.findAllRates(jurisdiction.id);
  }
}
