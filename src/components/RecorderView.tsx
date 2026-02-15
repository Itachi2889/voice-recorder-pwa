import { useState, useEffect } from 'react';
import { AudioRecorderService } from '../services/AudioRecorderService';
import { TranscriptionService } from '../services/TranscriptionService';
import { StorageService } from '../services/StorageService';
import type { Recording } from '../types/Recording';

const audioService = new AudioRecorderService();
const storageService = new StorageService();

interface RecorderViewProps {
  onNavigateToList?: () => void;
}

export default function RecorderView({ onNavigateToList }: RecorderViewProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);

  useEffect(() => {
    let interval: number;

    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration(audioService.getDuration());
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      await audioService.startRecording();
      setIsRecording(true);
      setRecordingDuration(0);
    } catch (error: any) {
      console.error('Failed to start recording:', error);
      const errorMessage = error?.message || 'Unknown error';
      alert(`Failed to start recording: ${errorMessage}\n\nPlease check microphone permissions.`);
    }
  };

  const stopRecording = async () => {
    try {
      const audioBlob = await audioService.stopRecording();
      setIsRecording(false);

      // Create Blob URL for playback
      const blobUrl = URL.createObjectURL(audioBlob);

      // Save recording
      const recording: Recording = {
        id: Date.now().toString(),
        uri: blobUrl,
        audioBlob: audioBlob,
        duration: recordingDuration,
        date: new Date(),
      };

      await storageService.saveRecording(recording);
      setRecordingDuration(0);

      // Ask user if they want to transcribe
      const transcribe = window.confirm(
        'Recording saved! Would you like to transcribe this recording now?'
      );

      if (transcribe) {
        await transcribeRecording(recording);
      }
    } catch (error: any) {
      console.error('Failed to stop recording:', error);
      setIsRecording(false);
      const errorMessage = error?.message || 'Unknown error';
      alert(`Failed to stop recording: ${errorMessage}`);
    }
  };

  const transcribeRecording = async (recording: Recording) => {
    try {
      setIsTranscribing(true);

      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) {
        alert('OpenAI API key not configured');
        return;
      }

      if (!recording.audioBlob) {
        alert('Audio data not available');
        return;
      }

      const transcriptionService = new TranscriptionService(apiKey);
      const result = await transcriptionService.transcribeAudio(recording.audioBlob);

      await storageService.updateRecording(recording.id, {
        transcript: result.text,
        isTranscribing: false,
      });

      alert('Recording transcribed successfully!');
    } catch (error) {
      console.error('Transcription error:', error);
      alert('Failed to transcribe recording. Please try again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="recorder-container">
      <h1 className="title">Voice Recorder</h1>

      {onNavigateToList && (
        <button className="view-recordings-button" onClick={onNavigateToList}>
          📝 View Recordings
        </button>
      )}

      <div className="timer-container">
        <div className="timer">{formatDuration(recordingDuration)}</div>
      </div>

      <button
        className={`record-button ${isRecording ? 'recording' : ''}`}
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isTranscribing}
      >
        <div className="record-button-inner" />
      </button>

      <p className="instruction">
        {isRecording ? 'Tap to stop recording' : 'Tap to start recording'}
      </p>

      {isTranscribing && <p className="transcribing-text">Transcribing...</p>}
    </div>
  );
}
