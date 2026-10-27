/// <reference types="vitest/globals" />

import { UnrecoverableError } from 'bullmq';
import { StatementStatus } from '@/entities/statement.entity';
import { WorkspaceKind } from '@/entities/workspace.entity';
import {
  MAX_PARSING_ATTEMPTS,
  StaleStatementReaper,
  StatementParsingProcessor,
} from '@/modules/parsing/queue/statement-parsing.processor';
import { StatementRejected } from '@/modules/parsing/services/statement-processing.service';

describe('StatementParsingProcessor', () => {
  const statementRepository = {
    exists: vi.fn(async () => false),
    increment: vi.fn(async () => undefined),
    find: vi.fn(async () => []),
    update: vi.fn(async () => undefined),
  };
  const statementProcessingService = { processStatement: vi.fn(async () => undefined) };
  const statementSiblings = { importOtherAccounts: vi.fn(async () => []) };

  beforeEach(() => vi.clearAllMocks());

  /** A job on its (attemptsMade + 1)th try out of the 3 the queue allows. */
  const job = (attemptsMade: number) =>
    ({ data: { statementId: 'stmt-1' }, attemptsMade, opts: { attempts: 3 } }) as never;

  const processor = () =>
    new StatementParsingProcessor(
      statementRepository as never,
      statementProcessingService as never,
      statementSiblings as never,
    );

  it('counts the attempt before parsing so a crash still leaves a trace', async () => {
    await processor().process(job(0));

    expect(statementRepository.increment).toHaveBeenCalledWith(
      { id: 'stmt-1' },
      'parsingAttempts',
      1,
    );
    expect(statementProcessingService.processStatement).toHaveBeenCalledWith('stmt-1', {
      finalAttempt: false,
    });
  });

  it('imports the other accounts of the file once the upload is parsed', async () => {
    await processor().process(job(0));

    expect(statementSiblings.importOtherAccounts).toHaveBeenCalledWith('stmt-1');
  });

  it('does not retry a parsed upload when its other accounts fail to queue', async () => {
    statementSiblings.importOtherAccounts.mockRejectedValueOnce(new Error('redis down'));

    await expect(processor().process(job(0))).resolves.toBeUndefined();
  });

  it('marks the last of the queue attempts as final', async () => {
    await processor().process(job(2));

    expect(statementProcessingService.processStatement).toHaveBeenCalledWith('stmt-1', {
      finalAttempt: true,
    });
  });

  it('stops retrying a statement no attempt can parse', async () => {
    statementProcessingService.processStatement.mockRejectedValueOnce(
      new StatementRejected({ message: 'No parser found for bank other' }) as never,
    );

    const failure = processor().process(job(0));

    await expect(failure).rejects.toBeInstanceOf(UnrecoverableError);
    await expect(failure).rejects.toThrow('No parser found for bank other');
  });

  it('propagates failures so the queue retries with backoff', async () => {
    statementProcessingService.processStatement.mockRejectedValueOnce(new Error('parser blew up'));

    await expect(
      processor().process(job(1)),
    ).rejects.toThrow('parser blew up');
    expect(statementSiblings.importOtherAccounts).not.toHaveBeenCalled();
  });

  it('drops a job for a statement of a past version without counting or parsing it', async () => {
    statementRepository.exists.mockResolvedValueOnce(true);

    await processor().process(job(0));

    expect(statementRepository.exists).toHaveBeenCalledWith({
      where: { id: 'stmt-1', workspace: { kind: WorkspaceKind.VERSION } },
    });
    expect(statementRepository.increment).not.toHaveBeenCalled();
    expect(statementProcessingService.processStatement).not.toHaveBeenCalled();
  });
});

describe('StaleStatementReaper', () => {
  const statementRepository = {
    find: vi.fn(),
    update: vi.fn(async () => ({ affected: 1 })),
  };
  const queue = { enqueue: vi.fn(async () => undefined) };

  beforeEach(() => vi.clearAllMocks());

  const reaper = () => new StaleStatementReaper(statementRepository as never, queue as never);

  it('re-queues a statement stranded in PROCESSING', async () => {
    statementRepository.find.mockResolvedValueOnce([{ id: 'stmt-1', parsingAttempts: 1 }]);
    statementRepository.update.mockResolvedValueOnce({ affected: 1 });

    await reaper().reap();

    expect(statementRepository.update).toHaveBeenCalledWith(
      { id: 'stmt-1', status: StatementStatus.PROCESSING },
      { status: StatementStatus.UPLOADED },
    );
    expect(queue.enqueue).toHaveBeenCalledWith('stmt-1');
  });

  it('abandons a statement that has burned its attempts instead of looping', async () => {
    statementRepository.find.mockResolvedValueOnce([
      { id: 'stmt-poison', parsingAttempts: MAX_PARSING_ATTEMPTS },
    ]);

    await reaper().reap();

    expect(queue.enqueue).not.toHaveBeenCalled();
    expect(statementRepository.update).toHaveBeenCalledWith(
      { id: 'stmt-poison', status: StatementStatus.PROCESSING },
      expect.objectContaining({ status: StatementStatus.ERROR }),
    );
  });

  it('does nothing when no statement is stale', async () => {
    statementRepository.find.mockResolvedValueOnce([]);

    await reaper().reap();

    expect(statementRepository.update).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it('looks only at statements of ordinary workspaces, never a past version', async () => {
    statementRepository.find.mockResolvedValueOnce([]);

    await reaper().reap();

    expect(statementRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspace: { kind: WorkspaceKind.STANDARD } }),
      }),
    );
  });

  it('does not re-queue (or clobber) a statement that already left PROCESSING by the time the conditional update runs', async () => {
    // Simulates the real race this guards against: the statement heartbeated
    // or finished between the reaper's SELECT and this UPDATE, so the
    // WHERE status = PROCESSING clause no longer matches.
    statementRepository.find.mockResolvedValueOnce([{ id: 'stmt-1', parsingAttempts: 1 }]);
    statementRepository.update.mockResolvedValueOnce({ affected: 0 });

    await reaper().reap();

    expect(statementRepository.update).toHaveBeenCalledWith(
      { id: 'stmt-1', status: StatementStatus.PROCESSING },
      { status: StatementStatus.UPLOADED },
    );
    expect(queue.enqueue).not.toHaveBeenCalled();
  });
});
