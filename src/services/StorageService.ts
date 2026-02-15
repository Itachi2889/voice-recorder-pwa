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
    await db.put('recordings', recording);
  }

  async getAllRecordings(): Promise<Recording[]> {
    const db = await this.getDB();
    const recordings = await db.getAll('recordings');

    // Convert date strings back to Date objects
    return recordings.map(rec => ({
      ...rec,
      date: new Date(rec.date),
    }));
  }

  async getRecording(id: string): Promise<Recording | undefined> {
    const db = await this.getDB();
    const recording = await db.get('recordings', id);

    if (recording) {
      return {
        ...recording,
        date: new Date(recording.date),
      };
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
