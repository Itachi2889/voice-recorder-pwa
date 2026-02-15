import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { Recording } from '../types/Recording';

interface VoiceRecorderDB extends DBSchema {
  recordings: {
    key: string;
    value: Recording;
    indexes: { 'by-date': Date };
  };
}

export class StorageService {
  private dbName = 'VoiceRecorderDB';
  private version = 1;
  private db: IDBPDatabase<VoiceRecorderDB> | null = null;

  private async getDB(): Promise<IDBPDatabase<VoiceRecorderDB>> {
    if (!this.db) {
      this.db = await openDB<VoiceRecorderDB>(this.dbName, this.version, {
        upgrade(db) {
          // Create recordings object store
          if (!db.objectStoreNames.contains('recordings')) {
            const store = db.createObjectStore('recordings', { keyPath: 'id' });
            store.createIndex('by-date', 'date');
          }
        },
      });
    }
    return this.db;
  }

  async saveRecording(recording: Recording): Promise<void> {
    const db = await this.getDB();

    // Convert Blob to ArrayBuffer for storage (IndexedDB compatibility)
    if (recording.audioBlob) {
      const arrayBuffer = await recording.audioBlob.arrayBuffer();
      const mimeType = recording.audioBlob.type;

      // Store without the Blob (only ArrayBuffer)
      const recordingToStore = {
        ...recording,
        audioBlob: undefined, // Don't store Blob directly
        audioData: arrayBuffer,
        mimeType: mimeType,
      };

      await db.put('recordings', recordingToStore);
    } else {
      await db.put('recordings', recording);
    }
  }

  async getAllRecordings(): Promise<Recording[]> {
    const db = await this.getDB();
    const recordings = await db.getAll('recordings');

    // Convert date strings to Date objects and ArrayBuffer to Blob
    return recordings.map(rec => {
      const recording: Recording = {
        ...rec,
        date: new Date(rec.date),
      };

      // Reconstruct Blob from ArrayBuffer
      if (rec.audioData && rec.mimeType) {
        recording.audioBlob = new Blob([rec.audioData], { type: rec.mimeType });
        // Regenerate Blob URL if needed
        if (!recording.uri) {
          recording.uri = URL.createObjectURL(recording.audioBlob);
        }
      }

      return recording;
    });
  }

  async getRecording(id: string): Promise<Recording | undefined> {
    const db = await this.getDB();
    const rec = await db.get('recordings', id);

    if (rec) {
      const recording: Recording = {
        ...rec,
        date: new Date(rec.date),
      };

      // Reconstruct Blob from ArrayBuffer
      if (rec.audioData && rec.mimeType) {
        recording.audioBlob = new Blob([rec.audioData], { type: rec.mimeType });
        // Regenerate Blob URL if needed
        if (!recording.uri) {
          recording.uri = URL.createObjectURL(recording.audioBlob);
        }
      }

      return recording;
    }

    return undefined;
  }

  async updateRecording(id: string, updates: Partial<Recording>): Promise<void> {
    const db = await this.getDB();
    const recording = await db.get('recordings', id);

    if (recording) {
      const updated = { ...recording, ...updates };
      await db.put('recordings', updated);
    }
  }

  async deleteRecording(id: string): Promise<void> {
    const db = await this.getDB();
    const recording = await db.get('recordings', id);

    // Revoke the Blob URL to free memory
    if (recording && recording.uri) {
      URL.revokeObjectURL(recording.uri);
    }

    await db.delete('recordings', id);
  }

  async clearAll(): Promise<void> {
    const db = await this.getDB();
    const recordings = await db.getAll('recordings');

    // Revoke all Blob URLs
    recordings.forEach(rec => {
      if (rec.uri) {
        URL.revokeObjectURL(rec.uri);
      }
    });

    await db.clear('recordings');
  }
}
