import { useState, useEffect } from 'react';
import { StorageService } from '../services/StorageService';
import { TranscriptionService } from '../services/TranscriptionService';
import { AudioPlayerService } from '../services/AudioPlayerService';
import type { Recording } from '../types/Recording';

const storageService = new StorageService();
const audioPlayerService = new AudioPlayerService();

interface RecordingsListProps {
  onNavigateBack?: () => void;
}

export default function RecordingsList({ onNavigateBack }: RecordingsListProps) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    loadRecordings();
  }, []);

  const loadRecordings = async () => {
    try {
      setRefreshing(true);
      const data = await storageService.getAllRecordings();
      // Sort by date, newest first
      data.sort((a, b) => b.date.getTime() - a.date.getTime());
      setRecordings(data);
    } catch (error) {
      console.error('Failed to load recordings:', error);
      alert('Failed to load recordings');
    } finally {
      setRefreshing(false);
    }
  };

  const deleteRecording = async (id: string) => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this recording?'
    );

    if (confirmed) {
      try {
        await storageService.deleteRecording(id);
        await loadRecordings();
      } catch (error) {
        console.error('Failed to delete recording:', error);
        alert('Failed to delete recording');
      }
    }
  };

  const togglePlayback = async (recording: Recording) => {
    try {
      if (playingId === recording.id) {
        await audioPlayerService.stopAudio();
        setPlayingId(null);
      } else {
        await audioPlayerService.playAudio(recording.uri);
        setPlayingId(recording.id);
      }
    } catch (error) {
      console.error('Playback error:', error);
      alert('Failed to play recording');
      setPlayingId(null);
    }
  };

  const shareRecording = async (recording: Recording) => {
    try {
      // Check if Web Share API is available
      if (!navigator.share) {
        alert('Sharing is not supported on this browser');
        return;
      }

      if (recording.transcript) {
        // Offer three options
        const choice = prompt(
          'What would you like to share?\n\n1 - Transcript only\n2 - Audio file only\n3 - Both transcript and audio\n\nEnter 1, 2, or 3:'
        );

        if (choice === '1') {
          await shareTranscript(recording);
        } else if (choice === '2') {
          await shareAudioFile(recording);
        } else if (choice === '3') {
          await shareBoth(recording);
        } else if (choice) {
          alert('Invalid choice. Please enter 1, 2, or 3.');
        }
      } else {
        await shareAudioFile(recording);
      }
    } catch (error) {
      console.error('Share error:', error);
      alert('Failed to share recording');
    }
  };

  const shareAudioFile = async (recording: Recording) => {
    try {
      if (!recording.audioBlob) {
        alert('Audio file not available');
        return;
      }

      // Determine file extension
      const ext = recording.audioBlob.type.includes('mp4')
        ? 'mp4'
        : recording.audioBlob.type.includes('ogg')
        ? 'ogg'
        : 'webm';

      const file = new File(
        [recording.audioBlob],
        `recording-${recording.id}.${ext}`,
        { type: recording.audioBlob.type }
      );

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Voice Recording',
          text: `Recording from ${formatDate(recording.date)}`,
        });
      } else {
        // Fallback: download the file
        const url = URL.createObjectURL(recording.audioBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recording-${recording.id}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert(`Audio file downloaded as: recording-${recording.id}.${ext}`);
      }
    } catch (error) {
      console.error('Share audio error:', error);
      alert('Failed to share audio file');
    }
  };

  const shareTranscript = async (recording: Recording) => {
    try {
      if (!recording.transcript) {
        alert('No transcript available');
        return;
      }

      const message = `Recording from ${formatDate(recording.date)}\n\nTranscript:\n${recording.transcript}`;

      await navigator.share({
        title: 'Recording Transcript',
        text: message,
      });
    } catch (error) {
      console.error('Share transcript error:', error);
      // Copy to clipboard as fallback
      navigator.clipboard.writeText(recording.transcript || '');
      alert('Transcript copied to clipboard');
    }
  };

  const shareBoth = async (recording: Recording) => {
    try {
      if (!recording.audioBlob || !recording.transcript) {
        alert('Audio or transcript not available');
        return;
      }

      // Determine file extension
      const ext = recording.audioBlob.type.includes('mp4')
        ? 'mp4'
        : recording.audioBlob.type.includes('ogg')
        ? 'ogg'
        : 'webm';

      const file = new File(
        [recording.audioBlob],
        `recording-${recording.id}.${ext}`,
        { type: recording.audioBlob.type }
      );

      const message = `Recording from ${formatDate(recording.date)}\n\nTranscript:\n${recording.transcript}`;

      if (navigator.canShare && navigator.canShare({ files: [file], text: message })) {
        await navigator.share({
          files: [file],
          title: 'Voice Recording with Transcript',
          text: message,
        });
      } else {
        // Fallback: share transcript and download audio
        await navigator.share({
          title: 'Recording Transcript',
          text: message,
        });

        // Also download audio file
        const url = URL.createObjectURL(recording.audioBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recording-${recording.id}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('Transcript shared! Audio file downloaded separately.');
      }
    } catch (error) {
      console.error('Share both error:', error);
      alert('Failed to share. Transcript copied to clipboard.');
      navigator.clipboard.writeText(recording.transcript || '');
    }
  };

  const transcribeRecording = async (recording: Recording) => {
    try {
      // Update UI to show transcribing state
      await storageService.updateRecording(recording.id, {
        isTranscribing: true,
      });
      await loadRecordings();

      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) {
        await storageService.updateRecording(recording.id, {
          isTranscribing: false,
        });
        await loadRecordings();
        alert('OpenAI API key not configured');
        return;
      }

      if (!recording.audioBlob) {
        await storageService.updateRecording(recording.id, {
          isTranscribing: false,
        });
        await loadRecordings();
        alert('Audio data not available');
        return;
      }

      const transcriptionService = new TranscriptionService(apiKey);
      const result = await transcriptionService.transcribeAudio(recording.audioBlob);

      await storageService.updateRecording(recording.id, {
        transcript: result.text,
        isTranscribing: false,
      });

      await loadRecordings();
      alert('Recording transcribed successfully!');
    } catch (error: any) {
      console.error('Transcription error:', error);

      await storageService.updateRecording(recording.id, {
        isTranscribing: false,
      });
      await loadRecordings();

      const errorMessage = error.message || 'Unknown error';
      alert(`Transcription Error: ${errorMessage}`);
    }
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="recordings-container">
      <div className="header">
        {onNavigateBack && (
          <button className="back-button" onClick={onNavigateBack}>
            ← Back
          </button>
        )}
        <h1 className="title">Recordings</h1>
      </div>

      {refreshing && <p className="loading">Loading...</p>}

      {recordings.length === 0 && !refreshing ? (
        <div className="empty-container">
          <p className="empty-text">No recordings yet</p>
          <p className="empty-subtext">Start recording to see your recordings here</p>
        </div>
      ) : (
        <div className="recordings-list">
          {recordings.map((recording) => (
            <div key={recording.id} className="recording-item">
              <div
                className="recording-info"
                onContextMenu={(e) => {
                  e.preventDefault();
                  deleteRecording(recording.id);
                }}
              >
                <div className="recording-header">
                  <span className="recording-date">{formatDate(recording.date)}</span>
                  <span className="recording-duration">{formatDuration(recording.duration)}</span>
                </div>

                {recording.transcript && (
                  <p className="transcript-preview">{recording.transcript}</p>
                )}

                {recording.isTranscribing && (
                  <p className="transcribing-label">Transcribing...</p>
                )}
              </div>

              <div className="button-row">
                <button
                  className="play-button"
                  onClick={() => togglePlayback(recording)}
                >
                  {playingId === recording.id ? '⏸️ Pause' : '▶️ Play'}
                </button>

                <button className="share-button" onClick={() => shareRecording(recording)}>
                  📤 Share
                </button>

                {!recording.transcript && !recording.isTranscribing && (
                  <button
                    className="transcribe-button"
                    onClick={() => transcribeRecording(recording)}
                  >
                    🎯 Transcribe
                  </button>
                )}

                <button
                  className="delete-button"
                  onClick={() => deleteRecording(recording.id)}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="refresh-button" onClick={loadRecordings} disabled={refreshing}>
        🔄 Refresh
      </button>
    </div>
  );
}
