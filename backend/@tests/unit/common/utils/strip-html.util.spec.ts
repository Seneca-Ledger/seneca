import { stripHtml } from '@/common/utils/strip-html.util';

describe('stripHtml', () => {
  it('strips html into normalized plain text', () => {
    expect(stripHtml('<p>Hello&nbsp;<strong>world</strong></p>')).toBe('Hello world');
  });
});
