import type { TranscriptionResult } from '../types/Recording';

export class TranscriptionService {
  private apiEndpoint = 'https://api.openai.com/v1/audio/transcriptions';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async transcribeAudio(audioBlob: Blob): Promise<TranscriptionResult> {
    try {
      console.log('Preparing to transcribe audio blob');

      // Create form data
      const formData = new FormData();

      // Determine file extension from blob type
      let fileName = 'recording.webm';
      if (audioBlob.type.includes('mp4')) {
        fileName = 'recording.mp4';
      } else if (audioBlob.type.includes('ogg')) {
        fileName = 'recording.ogg';
      } else if (audioBlob.type.includes('wav')) {
        fileName = 'recording.wav';
      }

      formData.append('file', audioBlob, fileName);
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'verbose_json');

      console.log('Sending transcription request to OpenAI...');

      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Transcription failed: ${errorData.error?.message || response.statusText}`
        );
      }

      const data = await response.json();
      console.log('Transcription successful');

      return {
        text: data.text,
        segments: data.segments?.map((segment: any) => ({
          text: segment.text,
          start: segment.start,
          end: segment.end,
        })),
      };
    } catch (error) {
      console.error('Transcription error:', error);
      throw error;
    }
  }
}
