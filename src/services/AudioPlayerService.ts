export class AudioPlayerService {
  private audio: HTMLAudioElement | null = null;
  private currentUri: string | null = null;

  async playAudio(uri: string): Promise<void> {
    try {
      // If playing the same file, just resume
      if (this.currentUri === uri && this.audio) {
        if (this.audio.paused) {
          await this.audio.play();
        } else {
          this.audio.pause();
        }
        return;
      }

      // Stop and clean up current audio if exists
      await this.stopAudio();

      // Create new audio element
      this.audio = new Audio(uri);
      this.currentUri = uri;

      // Set up event listeners
      this.audio.addEventListener('ended', () => {
        this.stopAudio();
      });

      this.audio.addEventListener('error', (e) => {
        console.error('Audio playback error:', e);
        this.stopAudio();
      });

      // Play the audio
      await this.audio.play();
    } catch (error) {
      console.error('Error playing audio:', error);
      throw error;
    }
  }

  async pauseAudio(): Promise<void> {
    if (this.audio && !this.audio.paused) {
      this.audio.pause();
    }
  }

  async stopAudio(): Promise<void> {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio = null;
    }
    this.currentUri = null;
  }

  isPlaying(uri?: string): boolean {
    if (!this.audio) return false;
    if (uri && this.currentUri !== uri) return false;
    return !this.audio.paused;
  }

  getCurrentTime(): number {
    return this.audio?.currentTime || 0;
  }

  getDuration(): number {
    return this.audio?.duration || 0;
  }

  setVolume(volume: number): void {
    if (this.audio) {
      this.audio.volume = Math.max(0, Math.min(1, volume));
    }
  }
}
