import { BankName, FileType } from '@/entities/statement.entity';
import type { LayoutTransaction } from '@/modules/parsing/helpers/pdf-layout-table.helper';
import {
  BancoDoBrasilParser,
  bancoDoBrasilClosingBalance,
  bancoDoBrasilCounterparty,
  isBancoDoBrasilStatement,
} from '@/modules/parsing/parsers/banco-do-brasil.parser';

/** The lines the PDF text layer reads: the bank's name is only in its logo. */
const STATEMENT = [
  'Extrato de Conta Corrente',
  'Cliente: SAMPLE OWNER',
  'Lançamentos',
  'Dia Histórico Valor',
  'S A L D O 1.535,65 (+)',
  'Informações Adicionais',
  'CHEQUE ESPECIAL - LIMITES 0,00 (+)',
].join('\n');

const row = (firstLine: string, below: string) =>
  ({ firstLine, description: `${firstLine} ${below}`.trim() }) as LayoutTransaction;

describe('BancoDoBrasilParser', () => {
  it('knows its statement by the title, the table header and the overdraft block', () => {
    expect(isBancoDoBrasilStatement(STATEMENT)).toBe(true);
    expect(isBancoDoBrasilStatement('Extrato de Conta Corrente\nDia Histórico Valor')).toBe(false);
  });

  it('reads the closing balance from the letter-spaced SALDO row', () => {
    expect(bancoDoBrasilClosingBalance(STATEMENT)).toBe(1535.65);
    expect(bancoDoBrasilClosingBalance('S A L D O 20,00 (-)')).toBe(-20);
  });

  it.each([
    [row('PIX - Recebido', '07:50 00011122233344 MEMBER ONE'), 'MEMBER ONE'],
    [row('TED Transf.Eletr.Disponiv', '237 2750 10000000001 MEMBER TWO'), 'MEMBER TWO'],
    [row('Saque no TAA', '19:23 SAA-EXAMPLE'), 'SAA-EXAMPLE'],
    [row('SAQUEterminal', 'Cobrança referente 10/07/2023'), 'SAQUEterminal'],
  ])('names the other side of %o', (transaction, expected) => {
    expect(bancoDoBrasilCounterparty(transaction)).toBe(expected);
  });

  it('parses its files under its own bank or under OTHER, and PDFs only', async () => {
    const parser = new BancoDoBrasilParser();
    await expect(
      parser.canParse(BankName.BANCO_DO_BRASIL, FileType.PDF, 'x.pdf', STATEMENT),
    ).resolves.toBe(true);
    await expect(parser.canParse(BankName.OTHER, FileType.PDF, 'x.pdf', STATEMENT)).resolves.toBe(true);
    await expect(parser.canParse(BankName.AXIS, FileType.PDF, 'x.pdf', STATEMENT)).resolves.toBe(false);
  });
});
