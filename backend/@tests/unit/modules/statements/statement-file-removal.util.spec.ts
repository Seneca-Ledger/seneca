/// <reference types="vitest/globals" />

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { removeStatementFile } from '@/modules/statements/statement-file-removal.util';

describe('removeStatementFile', () => {
  const logger = { error: vi.fn() };
  let filePath: string;

  beforeEach(() => {
    filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'statement-')), 'example.pdf');
    fs.writeFileSync(filePath, 'pdf');
  });

  const statement = () => ({ id: 'statement-1', workspaceId: 'workspace-1', filePath });

  it('keeps a file another statement of the workspace still reads', async () => {
    const statements = { count: vi.fn(async () => 1) };

    await removeStatementFile(statements as never, statement(), logger as never);

    expect(fs.existsSync(filePath)).toBe(true);
    expect(statements.count).toHaveBeenCalledWith({
      where: { workspaceId: 'workspace-1', filePath, id: expect.anything() },
    });
  });

  it('deletes a file no other statement reads', async () => {
    const statements = { count: vi.fn(async () => 0) };

    await removeStatementFile(statements as never, statement(), logger as never);

    expect(fs.existsSync(filePath)).toBe(false);
  });
});
