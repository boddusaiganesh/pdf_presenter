// @ts-nocheck
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Set worker source to local bundled file for offline/desktop compatibility
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

let pdfDocument: any = null;

export async function loadPDF(data: ArrayBuffer): Promise<number> {
  const loadingTask = pdfjsLib.getDocument({ data });
  pdfDocument = await loadingTask.promise;
  return pdfDocument.numPages;
}

export function getPDFDocument(): any {
  return pdfDocument;
}

export async function renderPage(
  pageIndex: number,
  quality: 1 | 2 | 4 = 2,
  contrastBoost: boolean = false,
  contrastStrength: number = 20
): Promise<string> {
  if (!pdfDocument) throw new Error('No PDF loaded');

  const page = await pdfDocument.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: quality });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;

  // Render PDF into canvas first (no filter during render)
  await page.render({ canvasContext: ctx, viewport }).promise;

  // Apply contrast as a post-processing step on a second canvas
  // This ensures PDF.js internal drawing is not affected by the filter
  if (contrastBoost) {
    const canvas2 = document.createElement('canvas');
    canvas2.width = viewport.width;
    canvas2.height = viewport.height;
    const ctx2 = canvas2.getContext('2d')!;
    ctx2.filter = `contrast(${100 + contrastStrength}%) brightness(${100 + contrastStrength * 0.3}%)`;
    ctx2.drawImage(canvas, 0, 0);
    return canvas2.toDataURL('image/jpeg', 0.92);
  }

  return canvas.toDataURL('image/jpeg', 0.92);
}

export async function renderPageToCanvas(
  pageIndex: number,
  canvas: HTMLCanvasElement,
  quality: 1 | 2 | 4 = 2,
  contrastBoost: boolean = false,
  contrastStrength: number = 20
): Promise<{ width: number; height: number }> {
  if (!pdfDocument) throw new Error('No PDF loaded');

  const page = await pdfDocument.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: quality });

  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;

  await page.render({ canvasContext: ctx, viewport }).promise;

  // Post-process contrast on the same canvas
  if (contrastBoost) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = viewport.width;
    tempCanvas.height = viewport.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.filter = `contrast(${100 + contrastStrength}%) brightness(${100 + contrastStrength * 0.3}%)`;
    tempCtx.drawImage(canvas, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tempCanvas, 0, 0);
  }

  return { width: viewport.width, height: viewport.height };
}

export async function extractEmbeddedNotes(pageIndex: number): Promise<string> {
  if (!pdfDocument) return '';
  try {
    const page = await pdfDocument.getPage(pageIndex + 1);
    const annotations = await page.getAnnotations();
    const noteAnnotations = annotations.filter(
      (ann: any) => ann.subtype === 'Text' || ann.subtype === 'FreeText'
    );
    return noteAnnotations.map((ann: any) => ann.contents || ann.alternativeText || '').join('\n');
  } catch {
    return '';
  }
}

export async function getPageDimensions(pageIndex: number): Promise<{ width: number; height: number; isLandscape: boolean }> {
  if (!pdfDocument) return { width: 1280, height: 720, isLandscape: true };
  const page = await pdfDocument.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: 1 });
  return {
    width: viewport.width,
    height: viewport.height,
    isLandscape: viewport.width > viewport.height,
  };
}

export function unloadPDF() {
  if (pdfDocument) {
    pdfDocument.destroy();
    pdfDocument = null;
  }
}
