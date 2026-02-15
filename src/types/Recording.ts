export type Recording = {
  id: string;
  uri: string; // Blob URL for web (instead of file URI)
  audioBlob?: Blob; // Store the actual Blob data
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
