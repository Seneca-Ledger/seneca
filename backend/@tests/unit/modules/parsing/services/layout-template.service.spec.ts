import { FileType, type Statement } from '@/entities/statement.entity';
import type { LayoutTemplate } from '@/modules/parsing/helpers/layout-template.helper';
import type { ParsedStatement } from '@/modules/parsing/interfaces/parsed-statement.interface';
import type { IParser } from '@/modules/parsing/interfaces/parser.interface';
import { LayoutTemplateService } from '@/modules/parsing/services/layout-template.service';

const taughtParse = vi.fn();
vi.mock('@/modules/parsing/parsers/taught-pdf.parser', () => ({
  TaughtPdfParser: class {
    constructor(readonly template: LayoutTemplate) {}
    parse(...args: unknown[]) {
      return taughtParse(this.template, ...args);
    }
  },
}));

const TEXT = 'Value Date  Narration  Withdrawn  Deposited  Closing';
const template = (phrase: string): LayoutTemplate => ({
  headings: [
    { phrase, role: 'date' },
    { phrase: 'narration', role: 'description' },
  ],
  columns: [],
  skip: [],
  balances: {},
});
const reading = (rows: number, chainPassed = true): ParsedStatement => ({
  metadata: { accountNumber: '', currency: 'USD', dateFrom: new Date(), dateTo: new Date() },
  transactions: Array.from({ length: rows }, () => ({
    transactionDate: new Date(),
    counterpartyName: 'ACME Store',
    paymentPurpose: 'ACME Store',
    debit: 1,
    currency: 'USD',
  })),
  checks: [{ code: 'balance_chain', passed: chainPassed }],
});

const pdf = { id: 'statement-1', workspaceId: 'ws-1', fileType: FileType.PDF } as Statement;

function setup(
  rows: Array<{ id: string; template: LayoutTemplate }>,
  own: { id: string; template: LayoutTemplate } | null = null,
) {
  const templates = {
    findOne: vi.fn(async () => own),
    find: vi.fn(async () => rows),
    increment: vi.fn(async () => undefined),
  };
  const service = new LayoutTemplateService(templates as never, {} as never);
  return { service, templates };
}

const parserReturning = (parsed: ParsedStatement | Error): IParser =>
  ({
    canParse: vi.fn(),
    parse: vi.fn(async () => {
      if (parsed instanceof Error) {
        throw parsed;
      }
      return parsed;
    }),
  }) as IParser;

describe('LayoutTemplateService.parse', () => {
  beforeEach(() => taughtParse.mockReset());

  it("keeps a good reading without looking for the workspace's layouts", async () => {
    const { service, templates } = setup([{ id: 't1', template: template('value date') }]);
    const good = reading(3);
    expect(await service.parse(parserReturning(good), pdf, '/file.pdf', TEXT)).toBe(good);
    expect(templates.find).not.toHaveBeenCalled();
  });

  it("reads with the workspace's layout when the parser finds no rows", async () => {
    const { service, templates } = setup([{ id: 't1', template: template('value date') }]);
    const taught = reading(2);
    taughtParse.mockResolvedValue(taught);
    const read = await service.parse(parserReturning(reading(0)), pdf, '/file.pdf', TEXT);
    expect(read.transactions).toBe(taught.transactions);
    expect(read.layout?.taughtTemplate).toBe('t1');
    expect(templates.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: 'ws-1' } }),
    );
    expect(templates.increment).toHaveBeenCalledWith(
      { id: 't1', workspaceId: 'ws-1' },
      'usedCount',
      1,
    );
  });

  it('tries only layouts whose headings the file prints', async () => {
    const { service } = setup([
      { id: 'other', template: template('posting date') },
      { id: 't1', template: template('value date') },
    ]);
    taughtParse.mockResolvedValue(reading(2));
    await service.parse(parserReturning(reading(0)), pdf, '/file.pdf', TEXT);
    expect(taughtParse).toHaveBeenCalledTimes(1);
    expect(taughtParse.mock.calls[0][0].headings[0].phrase).toBe('value date');
  });

  it('keeps the better reading: a broken taught one does not replace a broken own one', async () => {
    const { service, templates } = setup([{ id: 't1', template: template('value date') }]);
    const own = reading(5, false);
    taughtParse.mockResolvedValue(reading(5, false));
    expect(await service.parse(parserReturning(own), pdf, '/file.pdf', TEXT)).toBe(own);
    expect(templates.increment).not.toHaveBeenCalled();

    const fixed = reading(5);
    taughtParse.mockResolvedValue(fixed);
    expect((await service.parse(parserReturning(own), pdf, '/file.pdf', TEXT)).transactions).toBe(
      fixed.transactions,
    );
  });

  it("reads a file the parser throws on, or throws the parser's error when nothing reads it", async () => {
    const taught = reading(1, false);
    taughtParse.mockResolvedValue(taught);
    const failure = new Error('Unsupported layout');
    const read = await setup([{ id: 't1', template: template('value date') }]).service.parse(
      parserReturning(failure),
      pdf,
      '/file.pdf',
      TEXT,
    );
    expect(read.transactions).toBe(taught.transactions);
    await expect(
      setup([]).service.parse(parserReturning(failure), pdf, '/file.pdf', TEXT),
    ).rejects.toBe(failure);
  });

  it('leaves files other than PDF to their parser', async () => {
    const { service, templates } = setup([{ id: 't1', template: template('value date') }]);
    const empty = reading(0);
    const csv = { ...pdf, fileType: FileType.CSV } as Statement;
    expect(await service.parse(parserReturning(empty), csv, '/file.csv', TEXT)).toBe(empty);
    expect(templates.find).not.toHaveBeenCalled();
  });

  it('reads a statement taught by hand with its own layout, whatever the parser makes of it', async () => {
    const mine = { id: 'mine', template: template('value date') };
    const { service, templates } = setup([], mine);
    const taught = reading(4);
    taughtParse.mockResolvedValue(taught);
    const parser = parserReturning(reading(9));
    const read = await service.parse(parser, pdf, '/file.pdf', TEXT);
    expect(read.transactions).toBe(taught.transactions);
    expect(read.layout?.taughtTemplate).toBe('mine');
    expect(templates.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: 'ws-1', statementId: 'statement-1' } }),
    );
    expect(parser.parse).not.toHaveBeenCalled();

    // A layout that reads no rows of it gives way to the parser.
    taughtParse.mockResolvedValue(reading(0));
    expect((await service.parse(parser, pdf, '/file.pdf', TEXT)).transactions).toHaveLength(9);
  });
});
