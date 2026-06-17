import jsPDF from 'jspdf';
import JSZip from 'jszip';
import { Session } from '../store/useStore';

export async function exportAnnotatedPDF(
  session: Session,
  renderedPages: Record<number, string>,
  fabricCanvases: Record<string, string>, // slideId -> PNG dataURL
  withAnnotations: boolean = true
): Promise<void> {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'px',
    format: [1280, 720],
  });

  const slides = session.slides.filter((s) => !s.hidden);

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    if (i > 0) pdf.addPage([1280, 720], 'landscape');

    if (slide.type === 'pdf' && slide.pdfPageIndex !== undefined) {
      const imgData = renderedPages[slide.pdfPageIndex];
      if (imgData) {
        pdf.addImage(imgData, 'JPEG', 0, 0, 1280, 720);
      }
    } else if (slide.type === 'blank-white') {
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, 1280, 720, 'F');
    } else if (slide.type === 'blank-black') {
      pdf.setFillColor(0, 0, 0);
      pdf.rect(0, 0, 1280, 720, 'F');
    }

    // Overlay annotation if available
    if (withAnnotations && fabricCanvases[slide.id]) {
      pdf.addImage(fabricCanvases[slide.id], 'PNG', 0, 0, 1280, 720);
    }
  }

  pdf.save(`${session.name}_${withAnnotations ? 'annotated' : 'clean'}.pdf`);
}

export async function exportSlideAsImage(
  slideDataURL: string,
  annotationDataURL: string | null,
  filename: string,
  format: 'png' | 'jpg' = 'png'
): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d')!;

  // Draw slide
  if (slideDataURL) {
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, 0, 0, 1280, 720); resolve(); };
      img.src = slideDataURL;
    });
  }

  // Draw annotation
  if (annotationDataURL) {
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, 0, 0, 1280, 720); resolve(); };
      img.src = annotationDataURL;
    });
  }

  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
  const quality = format === 'jpg' ? 0.92 : undefined;
  const dataURL = canvas.toDataURL(mimeType, quality);

  const a = document.createElement('a');
  a.href = dataURL;
  a.download = `${filename}.${format}`;
  a.click();
}

export async function exportAllSlidesAsZip(
  session: Session,
  renderedPages: Record<number, string>,
  fabricCanvases: Record<string, string>
): Promise<void> {
  const zip = new JSZip();
  const slides = session.slides.filter((s) => !s.hidden);

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d')!;

    if (slide.type === 'pdf' && slide.pdfPageIndex !== undefined) {
      const imgData = renderedPages[slide.pdfPageIndex];
      if (imgData) {
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => { ctx.drawImage(img, 0, 0, 1280, 720); resolve(); };
          img.src = imgData;
        });
      }
    } else {
      ctx.fillStyle = slide.type === 'blank-black' ? '#000000' : '#ffffff';
      ctx.fillRect(0, 0, 1280, 720);
    }

    if (fabricCanvases[slide.id]) {
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => { ctx.drawImage(img, 0, 0, 1280, 720); resolve(); };
        img.src = fabricCanvases[slide.id];
      });
    }

    const dataURL = canvas.toDataURL('image/png');
    const base64 = dataURL.split(',')[1];
    zip.file(`slide_${String(i + 1).padStart(3, '0')}.png`, base64, { base64: true });
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${session.name}_slides.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportSessionFile(session: Session): Promise<void> {
  const { get } = await import('idb-keyval');
  const pdfData = await get(`pdf_data_${session.id}`);
  const dataToExport = { ...session, pdfData };
  const data = JSON.stringify(dataToExport, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${session.name}.pdfpro`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importSessionFile(file: File): Promise<Session> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const session = JSON.parse(e.target?.result as string);
        if (session.pdfData) {
          const { set } = await import('idb-keyval');
          await set(`pdf_data_${session.id}`, session.pdfData);
          delete session.pdfData;
        }
        resolve(session);
      } catch {
        reject(new Error('Invalid session file'));
      }
    };
    reader.readAsText(file);
  });
}

export function exportSpeakerNotes(session: Session): void {
  const notes = session.slides
    .map((slide, i) => {
      const content = slide.note.content.replace(/<[^>]+>/g, '');
      return `Slide ${i + 1}:\n${content || '(no notes)'}\n`;
    })
    .join('\n---\n\n');

  const blob = new Blob([notes], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${session.name}_notes.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportPostSessionPackage(
  session: Session,
  timings: Record<string, number>
): void {
  const lines: string[] = [`Post-Session Report: ${session.name}`, `Generated: ${new Date().toLocaleString()}`, ''];
  
  session.slides.forEach((slide, i) => {
    const seconds = Math.round(timings[slide.id] || 0);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    lines.push(`Slide ${i + 1}: ${mins}m ${secs}s`);
    const note = slide.note.content.replace(/<[^>]+>/g, '').trim();
    if (note) lines.push(`  Notes: ${note}`);
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${session.name}_post_session.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
