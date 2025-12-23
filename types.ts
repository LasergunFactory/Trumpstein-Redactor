
export type RedactionIntensity = number; // 0 to 100

export interface RedactedPage {
  canvas: HTMLCanvasElement;
  pageNumber: number;
}

export enum RedactionMode {
  RANDOM = 'RANDOM',
  AI_SENSITIVE = 'AI_SENSITIVE'
}

export interface RedactionResult {
  pages: RedactedPage[];
  originalText?: string;
  redactedText?: string;
}
