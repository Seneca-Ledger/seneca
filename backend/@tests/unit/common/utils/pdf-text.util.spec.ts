jest.mock('pdf-parse', () => jest.fn(async () => ({ text: 'parsed' })));

import pdfParse from 'pdf-parse';
import { parsePdf } from '@/common/utils/pdf-text.util';

describe('parsePdf', () => {
  it('hands pdf.js a buffer that owns its memory, not a slice of a pool', async () => {
    // What Node 24 returns for a small Buffer: a view into a shared pool.
    const pool = Buffer.alloc(65_536, 0x41);
    const pdf = pool.subarray(22_768, 22_768 + 4);
    pdf.write('%PDF');

    await expect(parsePdf(pdf)).resolves.toEqual({ text: 'parsed' });

    const passed = (pdfParse as unknown as jest.Mock).mock.calls[0][0] as Buffer;
    expect(passed.byteOffset).toBe(0);
    expect(passed.buffer.byteLength).toBe(4);
    expect(passed.toString()).toBe('%PDF');
  });
});
