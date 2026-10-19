import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const mockSpawn = jest.fn();
const mockSpawnSync = jest.fn();

jest.mock('child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
  spawnSync: (...args: unknown[]) => mockSpawnSync(...args),
}));

class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = jest.fn();
}

describe('pdf-parser.util resilience', () => {
  let tmpDir: string;

  const touchFile = (name: string) => {
    const filePath = path.join(tmpDir, name);
    fs.writeFileSync(filePath, '');
    return filePath;
  };

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    mockSpawn.mockReset();
    // Python resolution succeeds on the first candidate every time.
    mockSpawnSync.mockReturnValue({ error: undefined, status: 0 });
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-parser-resilience-'));
  });

  afterEach(() => {
    jest.useRealTimers();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('kills the process and rejects when it exceeds the timeout', async () => {
    const { extractTextFromPdf } = await import('@/common/utils/pdf-parser.util');
    const proc = new FakeChildProcess();
    mockSpawn.mockReturnValue(proc);

    const resultPromise = extractTextFromPdf(touchFile('slow.pdf'));
    const assertion = expect(resultPromise).rejects.toThrow(/timed out/);

    jest.advanceTimersByTime(60_000);
    await assertion;

    expect(proc.kill).toHaveBeenCalledWith('SIGKILL');
  });

  it('kills the process and rejects when stdout exceeds the size cap', async () => {
    const { extractTextFromPdf } = await import('@/common/utils/pdf-parser.util');
    const proc = new FakeChildProcess();
    mockSpawn.mockReturnValue(proc);

    const resultPromise = extractTextFromPdf(touchFile('huge.pdf'));
    const assertion = expect(resultPromise).rejects.toThrow(/exceeded.*bytes/);

    // One 101MB chunk blows past the 100MB cap in a single write.
    proc.stdout.emit('data', Buffer.alloc(101 * 1024 * 1024, 'a'));

    await assertion;
    expect(proc.kill).toHaveBeenCalledWith('SIGKILL');
  });

  it('caches a successful parse and reuses it for a second call to the same path', async () => {
    const { extractTextFromPdf } = await import('@/common/utils/pdf-parser.util');
    const filePath = touchFile('cached.pdf');

    const runOnce = async () => {
      const proc = new FakeChildProcess();
      mockSpawn.mockReturnValueOnce(proc);
      const promise = extractTextFromPdf(filePath);
      proc.stdout.emit('data', Buffer.from(JSON.stringify({ text: 'hello', rows: [], tables: [] })));
      proc.emit('close', 0);
      return promise;
    };

    const first = await runOnce();
    expect(first).toBe('hello');
    expect(mockSpawn).toHaveBeenCalledTimes(1);

    const second = await extractTextFromPdf(filePath);
    expect(second).toBe('hello');
    // No second spawn: served from cache.
    expect(mockSpawn).toHaveBeenCalledTimes(1);
  });

  it('evicts the oldest cache entry once more than 20 distinct files have been parsed', async () => {
    const { extractTextFromPdf } = await import('@/common/utils/pdf-parser.util');
    const filePaths = Array.from({ length: 21 }, (_, i) => touchFile(`file-${i}.pdf`));

    const parseFile = async (filePath: string) => {
      const proc = new FakeChildProcess();
      mockSpawn.mockReturnValueOnce(proc);
      const promise = extractTextFromPdf(filePath);
      proc.stdout.emit(
        'data',
        Buffer.from(JSON.stringify({ text: filePath, rows: [], tables: [] })),
      );
      proc.emit('close', 0);
      return promise;
    };

    for (const filePath of filePaths) {
      await parseFile(filePath);
    }

    expect(mockSpawn).toHaveBeenCalledTimes(21);

    // file-0 was evicted (the 21st insert pushed the cache over its 20-entry cap) — re-parsing it spawns again.
    await parseFile(filePaths[0]);
    expect(mockSpawn).toHaveBeenCalledTimes(22);

    // file-20 (the most recent before the re-parse) is still cached — no new spawn.
    mockSpawn.mockClear();
    const cached = await extractTextFromPdf(filePaths[20]);
    expect(cached).toBe(filePaths[20]);
    expect(mockSpawn).not.toHaveBeenCalled();
  });
});
