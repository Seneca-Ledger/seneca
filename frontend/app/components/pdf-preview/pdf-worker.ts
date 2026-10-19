/**
 * Points pdf.js at the worker bundled with the app.
 *
 * This used to load the worker from `https://unpkg.com/pdfjs-dist@<version>/...`,
 * which made a core feature depend on a public CDN being reachable — wrong for
 * a self-hosted deployment, which may have no outbound internet at all, and
 * blocked outright by the app's own Content-Security-Policy (`default-src
 * 'self'`). `new URL(..., import.meta.url)` makes the bundler emit the worker as
 * a local asset and hand back a same-origin URL.
 */
type PdfJsLike = { GlobalWorkerOptions: { workerSrc: string } };

export function configureBundledPdfWorker(pdfjs: PdfJsLike): void {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
}
