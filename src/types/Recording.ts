export type Recording = {
  id: string;
  uri: string; // Blob URL for web (instead of file URI)
  audioBlob?: Blob; // Runtime Blob (not stored in IndexedDB)
  audioData?: ArrayBuffer; // Stored in IndexedDB (for persistence)
  mimeType?: string; // Audio mime type (for reconstructing Blob)
  duration: number;
  date: Date;
  transcript?: string;
  isTranscribing?: boolean;
  title?: string;
}

export type TranscriptionResult = {
  text: string;
  segments?: Array<{
    text: string;
    start: number;
    end: number;
  }>;
}
