import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferenceData } from '../../entities/reference-data.entity';
import { Workspace } from '../../entities/workspace.entity';
import { PublicHolidaysService } from './public-holidays.service';
import { REFERENCE_FETCH, type ReferenceFetch } from './reference-fetch';
import { TedbVatRatesService } from './tedb-vat-rates.service';
import { ViesService } from './vies.service';

/**
 * Public reference data from outside sources: holidays, the EU's VAT rates
 * and VAT-number checks. Knows nothing about workspaces' own tax setup; the
 * tax modules compare against it.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ReferenceData, Workspace])],
  providers: [
    // A function of its own so tests can swap the network for a fake.
    { provide: REFERENCE_FETCH, useValue: ((input, init) => fetch(input, init)) as ReferenceFetch },
    PublicHolidaysService,
    TedbVatRatesService,
    ViesService,
  ],
  exports: [PublicHolidaysService, TedbVatRatesService, ViesService],
})
export class ReferenceDataModule {}
