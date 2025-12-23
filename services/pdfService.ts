
import { RedactionIntensity } from '../types';

// Declare global PDF.js
declare const pdfjsLib: any;

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

export const processPdfFile = async (
  file: File,
  intensity: RedactionIntensity,
  onProgress: (progress: number) => void
): Promise<HTMLCanvasElement[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  const canvases: HTMLCanvasElement[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 }); // High quality render
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) continue;

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context, viewport }).promise;

    // Apply Redaction Overlays
    applyCanvasRedaction(canvas, intensity);
    
    canvases.push(canvas);
    onProgress(Math.round((i / numPages) * 100));
  }

  return canvases;
};

export const applyCanvasRedaction = (canvas: HTMLCanvasElement, intensity: RedactionIntensity) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (intensity === 100) {
    // Full page redaction
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
    return;
  }

  if (intensity === 0) return;

  // Random box redaction logic
  // We simulate "finding" blocks of content by dividing the page into a grid
  // and randomly selecting cells to redact based on intensity.
  const rows = 40;
  const cols = 30;
  const cellW = canvas.width / cols;
  const cellH = canvas.height / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (Math.random() * 100 < intensity) {
        ctx.fillStyle = 'black';
        // Add some jitter for a more "organic" redaction look
        const jitterX = (Math.random() - 0.5) * (cellW * 0.2);
        const jitterY = (Math.random() - 0.5) * (cellH * 0.2);
        ctx.fillRect(
          c * cellW + jitterX, 
          r * cellH + jitterY, 
          cellW * 1.1, 
          cellH * 1.1
        );
      }
    }
  }
};
