import { stripHtml } from '@/common/utils/strip-html.util';

describe('stripHtml', () => {
  it('strips html into normalized plain text', () => {
    expect(stripHtml('<p>Hello&nbsp;<strong>world</strong></p>')).toBe('Hello world');
  });

  it('drops script and style bodies, closing tags with spaces included', () => {
    expect(stripHtml('a<style>p{}</style >b<SCRIPT src=x>alert(1)</script\n>c')).toBe('a b c');
  });

  it('decodes entities once', () => {
    expect(stripHtml('Fish &amp;lt; chips &amp; peas &#169;')).toBe('Fish &lt; chips & peas');
  });
});
