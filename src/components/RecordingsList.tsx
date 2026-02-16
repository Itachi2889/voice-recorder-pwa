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
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareRecordingId, setShareRecordingId] = useState<string | null>(null);
  const [shareIncludeTranscript, setShareIncludeTranscript] = useState(true);
  const [shareIncludeAudio, setShareIncludeAudio] = useState(true);

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

  const shareRecording = (recording: Recording) => {
    if (recording.transcript) {
      // Show dialog with checkboxes
      setShareRecordingId(recording.id);
      setShareIncludeTranscript(true);
      setShareIncludeAudio(true);
      setShowShareDialog(true);
    } else {
      // No transcript, just share audio
      shareAudioFile(recording);
    }
  };

  const handleShareConfirm = async () => {
    const recording = recordings.find(r => r.id === shareRecordingId);
    if (!recording) return;

    setShowShareDialog(false);

    try {
      if (!shareIncludeTranscript && !shareIncludeAudio) {
        alert('Please select at least one option to share!');
        return;
      }

      if (shareIncludeTranscript && shareIncludeAudio) {
        await shareBoth(recording);
      } else if (shareIncludeTranscript) {
        await shareTranscript(recording);
      } else if (shareIncludeAudio) {
        await shareAudioFile(recording);
      }
    } catch (error: any) {
      console.error('Share error:', error);
      const errorMessage = error?.message || 'Unknown error';
      alert(`Failed to share: ${errorMessage}`);
    }
  };

  const shareAudioFile = async (recording: Recording) => {
    try {
      if (!recording.audioBlob) {
        alert('Audio file not available');
        return;
      }

      // Determine file extension and ensure proper MIME type
      let ext: string;
      let mimeType: string;

      if (recording.audioBlob.type.includes('mp4') || recording.audioBlob.type.includes('m4a')) {
        // Use .m4a for better WhatsApp compatibility
        ext = 'm4a';
        mimeType = 'audio/mp4';
      } else if (recording.audioBlob.type.includes('ogg')) {
        ext = 'ogg';
        mimeType = 'audio/ogg';
      } else {
        // WebM fallback
        ext = 'webm';
        mimeType = 'audio/webm';
      }

      const fileName = `recording-${new Date(recording.date).toISOString().slice(0, 19).replace(/:/g, '-')}.${ext}`;

      const file = new File(
        [recording.audioBlob],
        fileName,
        { type: mimeType }
      );

      // Check if sharing is supported
      if (navigator.share) {
        // First check if we can share files
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: 'Voice Recording',
            });
            return; // Success!
          } catch (shareErr: any) {
            // User cancelled or share failed
            if (shareErr.name === 'AbortError') {
              console.log('Share cancelled by user');
              return; // User cancelled, don't show error
            }
            console.error('Share failed:', shareErr);
            throw new Error(`Cannot share: ${shareErr.message || 'File format not supported by the selected app'}`);
          }
        } else {
          throw new Error('File sharing is not supported on this device/browser');
        }
      } else {
        throw new Error('Web Share API is not supported on this browser');
      }
    } catch (error: any) {
      console.error('Share audio error:', error);

      // Fallback: download the file
      if (!recording.audioBlob) {
        alert(`Failed to share: ${error.message}`);
        return;
      }

      try {
        const ext = recording.audioBlob.type.includes('mp4') ? 'm4a' :
                    recording.audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
        const fileName = `recording-${new Date(recording.date).toISOString().slice(0, 19).replace(/:/g, '-')}.${ext}`;

        const url = URL.createObjectURL(recording.audioBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert(`${error.message}\n\nAudio file downloaded instead: ${fileName}`);
      } catch (downloadError) {
        alert(`Failed to share or download: ${error.message}`);
      }
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

      // Determine file extension and MIME type
      let ext: string;
      let mimeType: string;

      if (recording.audioBlob.type.includes('mp4') || recording.audioBlob.type.includes('m4a')) {
        ext = 'm4a';
        mimeType = 'audio/mp4';
      } else if (recording.audioBlob.type.includes('ogg')) {
        ext = 'ogg';
        mimeType = 'audio/ogg';
      } else {
        ext = 'webm';
        mimeType = 'audio/webm';
      }

      const fileName = `recording-${new Date(recording.date).toISOString().slice(0, 19).replace(/:/g, '-')}.${ext}`;

      const file = new File(
        [recording.audioBlob],
        fileName,
        { type: mimeType }
      );

      const message = `Recording from ${formatDate(recording.date)}\n\nTranscript:\n${recording.transcript}`;

      // Try to share file + text together
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'Voice Recording with Transcript',
            text: message,
          });
          return; // Success!
        } catch (shareError: any) {
          // User cancelled
          if (shareError.name === 'AbortError') {
            console.log('Share cancelled by user');
            return;
          }
          console.error('File sharing failed:', shareError);
          // Fall through to fallback
        }
      }

      // Fallback: share transcript and download audio separately
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Recording Transcript',
            text: message,
          });

          // Also download audio file
          const url = URL.createObjectURL(recording.audioBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          alert('Transcript shared! Audio file downloaded separately.');
          return;
        } catch (fallbackError: any) {
          if (fallbackError.name === 'AbortError') {
            console.log('Share cancelled by user');
            return;
          }
          console.error('Transcript sharing also failed:', fallbackError);
        }
      }

      // Last resort: copy to clipboard and download
      await navigator.clipboard.writeText(recording.transcript || '');
      const url = URL.createObjectURL(recording.audioBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert('Sharing not available on this browser. Transcript copied to clipboard and audio file downloaded.');
    } catch (error: any) {
      console.error('Share both error:', error);
      const errorMessage = error?.message || 'Unknown error';
      alert(`Failed to share: ${errorMessage}\n\nTranscript copied to clipboard.`);
      if (recording.transcript) {
        await navigator.clipboard.writeText(recording.transcript);
      }
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

      {/* Share Dialog */}
      {showShareDialog && (
        <div className="modal-overlay" onClick={() => setShowShareDialog(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">What would you like to share?</h3>

            <div className="share-options">
              <label className="share-option">
                <input
                  type="checkbox"
                  checked={shareIncludeTranscript}
                  onChange={(e) => setShareIncludeTranscript(e.target.checked)}
                />
                <span>Transcript</span>
              </label>

              <label className="share-option">
                <input
                  type="checkbox"
                  checked={shareIncludeAudio}
                  onChange={(e) => setShareIncludeAudio(e.target.checked)}
                />
                <span>Audio file</span>
              </label>
            </div>

            <div className="modal-buttons">
              <button className="modal-button cancel" onClick={() => setShowShareDialog(false)}>
                Cancel
              </button>
              <button className="modal-button confirm" onClick={handleShareConfirm}>
                Share
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
