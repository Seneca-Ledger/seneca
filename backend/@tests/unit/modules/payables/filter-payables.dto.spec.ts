import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePayableBody, FilterPayablesBody, MarkPayablePaidBody, UpdatePayableBody } from '@/contracts';
import { FilterPayablesDto } from '@/modules/payables/dto/filter-payables.dto';
import { rejectedFields } from '../../../helpers/schema-body';

describe('Payables request validation', () => {
  it('rejects invalid due dates and non-uuid linked ids for create/update/export/mark-paid', () => {
    expect(
      rejectedFields(CreatePayableBody, {
        vendor: 'Acme',
        amount: 10,
        dueDate: 'not-a-date',
        linkedTransactionId: 'bad-id',
        statementId: 'also-bad',
      }),
    ).toEqual(expect.arrayContaining(['dueDate', 'linkedTransactionId', 'statementId']));
    expect(
      rejectedFields(UpdatePayableBody, {
        dueDate: 'still-not-a-date',
        linkedTransactionId: 'bad-id',
        statementId: 'also-bad',
      }),
    ).toEqual(expect.arrayContaining(['dueDate', 'linkedTransactionId', 'statementId']));
    expect(
      rejectedFields(FilterPayablesBody, { dueDateFrom: 'bad-date', dueDateTo: 'bad-date' }),
    ).toEqual(['dueDateFrom', 'dueDateTo']);
    expect(rejectedFields(MarkPayablePaidBody, { linkedTransactionId: 'bad-id' })).toEqual([
      'linkedTransactionId',
    ]);
  });

  it('rejects invalid dates in the list query too', async () => {
    const filters = plainToInstance(FilterPayablesDto, {
      dueDateFrom: 'bad-date',
      dueDateTo: 'bad-date',
    });
    expect(await validate(filters)).not.toHaveLength(0);
  });

  it('allows clearing nullable update fields while keeping other inherited validation rules', () => {
    expect(
      rejectedFields(UpdatePayableBody, {
        vendor: 'Acme',
        amount: 10,
        linkedTransactionId: null,
        comment: null,
        statementId: null,
      }),
    ).toEqual([]);
  });
});
