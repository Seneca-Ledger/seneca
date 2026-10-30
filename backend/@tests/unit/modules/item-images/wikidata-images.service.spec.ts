import type { MockInstance } from 'vitest';
import { BadGatewayException, NotFoundException } from '@nestjs/common';
import { EffectRuntime } from '@/common/effect/effect-runtime';
import { commonsTitle, fileOf, thumbUrlsOf } from '@/modules/item-images/commons-files.util';
import { searchTerms, WikidataImagesService } from '@/modules/item-images/wikidata-images.service';

const ITEM = 'Q1001';
const THUMB = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Example.svg/330px-Example.svg.png';

function imageInfo(thumburl: string, title = commonsTitle(FILE)) {
  return { query: { pages: { '-1': { title, imageinfo: [{ thumburl }] } } } };
}

/** Wikidata names the file, Commons names its thumbnail, the upload host serves it. */
function upstream(picture: () => Response, thumb = THUMB) {
  return async (input: unknown) => {
    const url = String(input);
    if (url.startsWith('https://www.wikidata.org/')) {
      return jsonResponse({ entities: { [ITEM]: entity(FILE) } });
    }
    if (url.startsWith('https://commons.wikimedia.org/')) {
      return jsonResponse(imageInfo(thumb));
    }
    return picture();
  };
}
const FILE = 'Example Mini Computer.svg';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function entity(file: string | null, label = 'Example Mini', description = 'small desktop') {
  return {
    labels: { en: { value: label } },
    descriptions: { en: { value: description } },
    claims: file ? { P18: [{ mainsnak: { datavalue: { value: file } } }] } : {},
  };
}

function createService() {
  const cacheManager = { get: vi.fn(async () => undefined), set: vi.fn(async () => undefined) };
  return {
    service: new WikidataImagesService(cacheManager as any, new EffectRuntime()),
    cacheManager,
  };
}

describe('WikidataImagesService', () => {
  let fetchSpy: MockInstance;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('drops trailing words until an item with a picture turns up', async () => {
    const searched: string[] = [];
    fetchSpy.mockImplementation(async (input: unknown) => {
      const url = new URL(String(input));
      if (url.searchParams.get('action') === 'wbsearchentities') {
        const term = url.searchParams.get('search') as string;
        searched.push(term);
        return jsonResponse({ search: term === 'Example Mini' ? [{ id: ITEM }] : [] });
      }
      return jsonResponse({ entities: { [ITEM]: entity(FILE) } });
    });
    const { service } = createService();

    const answer = await service.search('Example Mini X2');

    expect(searched).toEqual(['Example Mini X2', 'Example Mini']);
    expect(answer).toEqual({
      query: 'Example Mini',
      results: [{ id: ITEM, label: 'Example Mini', description: 'small desktop' }],
    });
  });

  it('leaves out items without a picture Commons can rasterise', async () => {
    fetchSpy.mockImplementation(async (input: unknown) => {
      const url = new URL(String(input));
      if (url.searchParams.get('action') === 'wbsearchentities') {
        return jsonResponse({ search: [{ id: 'Q1' }, { id: 'Q2' }, { id: 'Q3' }] });
      }
      return jsonResponse({
        entities: { Q1: entity(null), Q2: entity('Scan.tif'), Q3: entity('Photo.jpg', 'Kept') },
      });
    });
    const { service } = createService();

    const answer = await service.search('anything');

    expect(answer.results.map(result => result.id)).toEqual(['Q3']);
  });

  it('searches the reader’s language before English', async () => {
    const languages: string[] = [];
    fetchSpy.mockImplementation(async (input: unknown) => {
      const url = new URL(String(input));
      if (url.searchParams.get('action') === 'wbsearchentities') {
        languages.push(url.searchParams.get('language') as string);
      }
      return jsonResponse({ search: [] });
    });
    const { service } = createService();

    await service.search('word', 'de');

    expect(languages.slice(0, 2)).toEqual(['de', 'en']);
  });

  it('answers 502 when Wikidata does not answer', async () => {
    fetchSpy.mockRejectedValue(new TypeError('network down'));
    const { service } = createService();

    await expect(service.search('anything')).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('downloads the thumbnail Commons names for the item’s file', async () => {
    const bytes = Buffer.from([1, 2, 3]);
    fetchSpy.mockImplementation(
      upstream(() => new Response(new Uint8Array(bytes), { headers: { 'content-type': 'image/png' } })),
    );
    const { service } = createService();

    const picture = await service.picture(ITEM);

    expect(picture).toEqual({ body: bytes, contentType: 'image/png' });
    const commons = new URL(String(fetchSpy.mock.calls[1][0]));
    expect(commons.searchParams.get('titles')).toBe('File:Example Mini Computer.svg');
    expect(String(fetchSpy.mock.calls[2][0])).toBe(THUMB);
  });

  it('waits as long as Commons asks after a 429, then tries once more', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    let attempts = 0;
    fetchSpy.mockImplementation(
      upstream(() => {
        attempts += 1;
        return attempts === 1
          ? new Response('', { status: 429, headers: { 'retry-after': '1' } })
          : new Response(new Uint8Array([7]), { headers: { 'content-type': 'image/png' } });
      }),
    );
    const { service } = createService();

    const pending = service.picture(ITEM);
    await vi.advanceTimersByTimeAsync(1000);

    expect((await pending).body).toEqual(Buffer.from([7]));
    expect(attempts).toBe(2);
    vi.useRealTimers();
  });

  it('remembers the thumbnails of the results it shows, in one request', async () => {
    const commonsCalls: string[] = [];
    fetchSpy.mockImplementation(async (input: unknown) => {
      const url = new URL(String(input));
      if (url.hostname === 'commons.wikimedia.org') {
        commonsCalls.push(url.searchParams.get('titles') as string);
        return jsonResponse(imageInfo(THUMB));
      }
      if (url.searchParams.get('action') === 'wbsearchentities') {
        return jsonResponse({ search: [{ id: ITEM }] });
      }
      return jsonResponse({ entities: { [ITEM]: entity(FILE) } });
    });
    const { service, cacheManager } = createService();

    const answer = await service.search('Example Mini');

    expect(answer.results).toEqual([
      { id: ITEM, label: 'Example Mini', description: 'small desktop' },
    ]);
    expect(commonsCalls).toEqual(['File:Example Mini Computer.svg']);
    expect(cacheManager.set).toHaveBeenCalledWith(`item-image-thumb:v1:${ITEM}`, THUMB, expect.any(Number));
  });

  it('will not fetch a thumbnail address off the upload host', async () => {
    fetchSpy.mockImplementation(
      upstream(() => new Response('never'), 'https://example.com/330px-Example.png'),
    );
    const { service } = createService();

    await expect(service.picture(ITEM)).rejects.toBeInstanceOf(NotFoundException);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('is a 404 for an item without a picture', async () => {
    fetchSpy.mockImplementation(async () => jsonResponse({ entities: { [ITEM]: entity(null) } }));
    const { service } = createService();

    await expect(service.picture(ITEM)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses a picture that is not a raster', async () => {
    fetchSpy.mockImplementation(
      upstream(() => new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } })),
    );
    const { service } = createService();

    await expect(service.picture(ITEM)).rejects.toBeInstanceOf(BadGatewayException);
  });
});

describe('thumbUrlsOf', () => {
  it('reads the thumbnail address by page title', () => {
    expect(thumbUrlsOf(imageInfo(THUMB)).get('File:Example Mini Computer.svg')).toBe(THUMB);
  });

  it('accepts the thumbnail host Commons answers with today', () => {
    const url = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Example.jpg/330px-Example.jpg';
    expect(thumbUrlsOf(imageInfo(url)).get('File:Example Mini Computer.svg')).toBe(url);
  });

  it('refuses another host or scheme', () => {
    expect(thumbUrlsOf(imageInfo('http://upload.wikimedia.org/x.png')).size).toBe(0);
    expect(thumbUrlsOf(imageInfo('https://upload.wikimedia.org.example.com/x.png')).size).toBe(0);
    expect(thumbUrlsOf({}).size).toBe(0);
  });
});

describe('commonsTitle', () => {
  it('writes the title the way Commons answers it', () => {
    expect(commonsTitle('example_file name.jpg')).toBe('File:Example file name.jpg');
  });
});

describe('fileOf', () => {
  it('ignores a value that would add a path segment', () => {
    expect(fileOf(entity('../evil.png') as any)).toBeNull();
  });
});

describe('searchTerms', () => {
  it('keeps a model name before trying single words', () => {
    expect(searchTerms(['Example', 'Mini', 'X2'])).toEqual([
      'Example Mini X2',
      'Example Mini',
      'Mini',
      'Example',
    ]);
  });

  it('tries the thing before the brand', () => {
    expect(searchTerms(['ACME', 'armchair'])).toEqual(['ACME armchair', 'armchair', 'ACME']);
  });

  it('asks for a single word once', () => {
    expect(searchTerms(['bicycle'])).toEqual(['bicycle']);
  });
});
