import type { Mock } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { runExecutable } from '@/common/utils/thumbnail-command.util';

vi.mock('node:util', () => ({
  promisify: vi.fn(() => vi.fn().mockResolvedValue({ stdout: '', stderr: '' })),
}));

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

describe('thumbnail command execution', () => {
  it('uses execFile arguments so shell metacharacters in paths are not interpreted', async () => {
    const execFileAsync = vi.fn().mockResolvedValue({ stdout: '', stderr: '' });
    (promisify as unknown as Mock).mockReturnValue(execFileAsync);

    await runExecutable('python3', [
      '/app/scripts/generate-thumbnail.py',
      '/uploads/id.p$(touch owned)f',
      '/tmp/thumb.png',
      '320',
    ]);

    expect(promisify).toHaveBeenCalledWith(execFile);
    expect(execFileAsync).toHaveBeenCalledWith('python3', [
      '/app/scripts/generate-thumbnail.py',
      '/uploads/id.p$(touch owned)f',
      '/tmp/thumb.png',
      '320',
    ]);
  });
});
