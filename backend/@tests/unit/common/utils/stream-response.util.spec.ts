import type { Mock } from 'vitest';
import { buildContentDisposition } from '@/common/utils/http-file.util';
import { pipeFileStreamResponse } from '@/common/utils/stream-response.util';

type MockResponse = {
  headersSent: boolean;
  setHeader: Mock;
  status: Mock;
  json: Mock;
  destroy: Mock;
};

type MockStream = {
  on: Mock;
  pipe: Mock;
  emitError: (error: NodeJS.ErrnoException) => void;
};

describe('pipeFileStreamResponse', () => {
  const createResponse = (): MockResponse => {
    const response: MockResponse = {
      headersSent: false,
      setHeader: vi.fn(),
      status: vi.fn(),
      json: vi.fn(),
      destroy: vi.fn(),
    };

    response.status.mockReturnValue(response);

    return response;
  };

  const createStream = (): MockStream => {
    const handlers: Record<string, (error: NodeJS.ErrnoException) => void> = {};

    return {
      on: vi.fn((event: string, handler: (error: NodeJS.ErrnoException) => void) => {
        handlers[event] = handler;
      }),
      pipe: vi.fn(),
      emitError: (error: NodeJS.ErrnoException) => handlers.error?.(error),
    };
  };

  it('sets headers and pipes the stream for downloads', () => {
    const response = createResponse();
    const stream = createStream();

    pipeFileStreamResponse(response as never, stream as never, {
      disposition: 'attachment',
      fileName: 'statement.pdf',
      mimeType: 'application/pdf',
      errorMessage: 'Failed to download file',
    });

    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      buildContentDisposition('attachment', 'statement.pdf'),
    );
    expect(stream.pipe).toHaveBeenCalledWith(response);
  });

  it('returns not found when the file is missing on disk', () => {
    const response = createResponse();
    const stream = createStream();

    pipeFileStreamResponse(response as never, stream as never, {
      disposition: 'inline',
      fileName: 'statement.pdf',
      mimeType: 'application/pdf',
      errorMessage: 'Failed to read file',
    });

    stream.emitError({ code: 'ENOENT' } as NodeJS.ErrnoException);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'NOT_FOUND',
        message: 'File not found on disk',
      },
    });
  });

  it('destroys the response when the stream fails after headers were sent', () => {
    const response = createResponse();
    response.headersSent = true;
    const stream = createStream();
    const error = { code: 'EIO' } as NodeJS.ErrnoException;

    pipeFileStreamResponse(response as never, stream as never, {
      disposition: 'attachment',
      fileName: 'statement.pdf',
      mimeType: 'application/pdf',
      errorMessage: 'Failed to download file',
    });

    stream.emitError(error);

    expect(response.destroy).toHaveBeenCalledWith(error);
    expect(response.status).not.toHaveBeenCalled();
  });
});
