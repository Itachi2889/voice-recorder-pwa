export class AudioRecorderService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private startTime: number = 0;

  async startRecording(): Promise<void> {
    try {
      // Check if MediaRecorder is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MediaRecorder is not supported in this browser');
      }

      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Determine the best audio format for the browser
      let options: MediaRecorderOptions = {};

      // iOS Safari supports audio/mp4, Chrome/Firefox support audio/webm
      if (MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/webm' };
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options = { mimeType: 'audio/mp4' };
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        options = { mimeType: 'audio/ogg' };
      }

      this.mediaRecorder = new MediaRecorder(this.stream, options);
      this.audioChunks = [];
      this.startTime = Date.now();

      // Collect audio data
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      // Request data every 100ms to ensure we capture audio
      // This is especially important for iOS Safari
      this.mediaRecorder.start(100);
    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  }

  async stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No active recording'));
        return;
      }

      // Check if recording is in a valid state to stop
      const state = this.mediaRecorder.state;
      if (state !== 'recording' && state !== 'paused') {
        reject(new Error(`Cannot stop recording - current state: ${state}`));
        return;
      }

      // Set timeout to prevent promise hanging
      const timeout = setTimeout(() => {
        reject(new Error('Stop recording timeout'));
      }, 5000);

      this.mediaRecorder.onstop = () => {
        clearTimeout(timeout);

        try {
          // Get the mime type from the MediaRecorder
          const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';

          // Ensure we have audio data
          if (this.audioChunks.length === 0) {
            reject(new Error('No audio data recorded'));
            return;
          }

          // Create blob from all chunks
          const audioBlob = new Blob(this.audioChunks, { type: mimeType });

          // Clean up
          this.cleanup();

          resolve(audioBlob);
        } catch (error) {
          reject(error);
        }
      };

      this.mediaRecorder.onerror = (event) => {
        clearTimeout(timeout);
        this.cleanup();
        reject(new Error(`MediaRecorder error: ${event}`));
      };

      try {
        this.mediaRecorder.stop();
      } catch (error) {
        clearTimeout(timeout);
        this.cleanup();
        reject(error);
      }
    });
  }

  getDuration(): number {
    if (!this.startTime) return 0;
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  async pauseRecording(): Promise<void> {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
    }
  }

  async resumeRecording(): Promise<void> {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
    }
  }

  private cleanup(): void {
    // Stop all tracks in the stream
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    this.mediaRecorder = null;
    this.audioChunks = [];
    this.startTime = 0;
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }
}
