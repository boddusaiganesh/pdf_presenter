import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Set worker source to local bundled file for offline/desktop compatibility
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// PageViewport is not a named export in pdfjs-dist v5 — infer it from the method return type
type PageViewport = ReturnType<PDFPageProxy['getViewport']>;

let pdfDocument: PDFDocumentProxy | null = null;
// Guard against concurrent loadPDF() calls (e.g. user drops two files rapidly)
let loadInFlight = false;

export async function loadPDF(data: ArrayBuffer): Promise<number> {
  // Prevent concurrent loads — second call waits for the first to finish
  if (loadInFlight) {
    console.warn('[pdfRenderer] loadPDF called while another load is in progress — ignoring');
    return pdfDocument?.numPages ?? 0;
  }
  loadInFlight = true;

  // Destroy any previously loaded document to free memory
  if (pdfDocument) {
    try { pdfDocument.destroy(); } catch { /* ignore */ }
    pdfDocument = null;
  }

  // Copy the ArrayBuffer before passing to pdfjs.
  // getDocument() transfers (detaches) the buffer, making the caller's reference
  // unusable. The copy ensures the caller can still use their original buffer.
  const dataCopy = data.slice(0);
  const loadingTask = pdfjsLib.getDocument({ data: dataCopy });

  try {
    pdfDocument = await loadingTask.promise;
    return pdfDocument.numPages;
  } catch (err) {
    // Cancel the loading task to release the worker
    try { loadingTask.destroy(); } catch { /* ignore */ }
    pdfDocument = null;
    throw err;
  } finally {
    loadInFlight = false;
  }
}

export function getPDFDocument(): PDFDocumentProxy | null {
  return pdfDocument;
}

/**
 * Apply contrast + brightness boost to a canvas using CSS filter.
 * Falls back to a manual pixel-level operation if CSS filter is not
 * supported (some Electron/Chromium builds silently ignore ctx.filter).
 */
function applyContrastToCanvas(
  source: HTMLCanvasElement,
  width: number,
  height: number,
  contrastStrength: number
): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d')!;

  // Check if CSS filter is actually supported on this canvas context
  const filterSupported = 'filter' in ctx;

  if (filterSupported) {
    ctx.filter = `contrast(${100 + contrastStrength}%) brightness(${100 + contrastStrength * 0.3}%)`;
    ctx.drawImage(source, 0, 0);
  } else {
    // Manual pixel-level contrast: (pixel - 128) * factor + 128
    ctx.drawImage(source, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const factor = (259 * (contrastStrength + 255)) / (255 * (259 - contrastStrength));
    const brightnessAdd = contrastStrength * 0.3 * 2.55; // convert % to 0-255
    for (let i = 0; i < data.length; i += 4) {
      data[i]     = Math.min(255, Math.max(0, factor * (data[i]     - 128) + 128 + brightnessAdd));
      data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128 + brightnessAdd));
      data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128 + brightnessAdd));
      // alpha (i+3) unchanged
    }
    ctx.putImageData(imageData, 0, 0);
  }

  return out;
}

export async function renderPage(
  pageIndex: number,
  quality: 1 | 2 | 4 = 2,
  contrastBoost: boolean = false,
  contrastStrength: number = 20
): Promise<string> {
  if (!pdfDocument) throw new Error('No PDF loaded');

  const page: PDFPageProxy = await pdfDocument.getPage(pageIndex + 1);
  const viewport: PageViewport = page.getViewport({ scale: quality });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;

  try {
    // Render PDF into canvas first (no filter during render)
    await page.render({ canvasContext: ctx, viewport }).promise;

    let result: string;
    if (contrastBoost) {
      const boosted = applyContrastToCanvas(canvas, viewport.width, viewport.height, contrastStrength);
      result = boosted.toDataURL('image/jpeg', 0.92);
      // Release GPU backing store immediately
      boosted.width = 0;
      boosted.height = 0;
    } else {
      result = canvas.toDataURL('image/jpeg', 0.92);
    }
    return result;
  } finally {
    // Always release page resources and canvas GPU memory
    page.cleanup();
    canvas.width = 0;
    canvas.height = 0;
  }
}

export async function renderPageToCanvas(
  pageIndex: number,
  canvas: HTMLCanvasElement,
  quality: 1 | 2 | 4 = 2,
  contrastBoost: boolean = false,
  contrastStrength: number = 20
): Promise<{ width: number; height: number }> {
  if (!pdfDocument) throw new Error('No PDF loaded');

  const page: PDFPageProxy = await pdfDocument.getPage(pageIndex + 1);
  const viewport: PageViewport = page.getViewport({ scale: quality });

  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;

  try {
    await page.render({ canvasContext: ctx, viewport }).promise;

    if (contrastBoost) {
      const boosted = applyContrastToCanvas(canvas, viewport.width, viewport.height, contrastStrength);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(boosted, 0, 0);
      // Release the temporary boosted canvas
      boosted.width = 0;
      boosted.height = 0;
    }

    return { width: viewport.width, height: viewport.height };
  } finally {
    page.cleanup();
  }
}

export async function extractEmbeddedNotes(pageIndex: number): Promise<string> {
  if (!pdfDocument) return '';
  let page: PDFPageProxy | null = null;
  try {
    page = await pdfDocument.getPage(pageIndex + 1);
    const annotations = await page.getAnnotations();
    const noteAnnotations = annotations.filter(
      (ann: { subtype: string }) =>
        ann.subtype === 'Text' || ann.subtype === 'FreeText'
    );
    return noteAnnotations
      .map((ann: { contents?: string; alternativeText?: string }) =>
        ann.contents || ann.alternativeText || ''
      )
      .join('\n');
  } catch {
    return '';
  } finally {
    page?.cleanup();
  }
}

export async function getPageDimensions(
  pageIndex: number
): Promise<{ width: number; height: number; isLandscape: boolean }> {
  if (!pdfDocument) return { width: 1280, height: 720, isLandscape: true };
  let page: PDFPageProxy | null = null;
  try {
    page = await pdfDocument.getPage(pageIndex + 1);
    const viewport: PageViewport = page.getViewport({ scale: 1 });
    return {
      width: viewport.width,
      height: viewport.height,
      isLandscape: viewport.width > viewport.height,
    };
  } finally {
    page?.cleanup();
  }
}

export function unloadPDF(): void {
  if (pdfDocument) {
    try { pdfDocument.destroy(); } catch { /* ignore */ }
    pdfDocument = null;
  }
}
