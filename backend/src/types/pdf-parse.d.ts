// pdf-parse 1.x ships no types; this covers the parts the backend calls.
declare module 'pdf-parse' {
  interface PdfParseOptions {
    max?: number;
    version?: string;
    pagerender?: (pageData: unknown) => Promise<string>;
  }

  interface PdfParseResult {
    text: string;
    numpages: number;
    numrender: number;
    version: string;
    info: unknown;
    metadata: unknown;
  }

  function pdfParse(dataBuffer: Uint8Array, options?: PdfParseOptions): Promise<PdfParseResult>;

  export = pdfParse;
}
