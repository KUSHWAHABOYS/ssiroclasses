// Studio Library: Persistent IndexedDB storage for PPT/PDF Decks, Videos, and Photos
// 100% In-Device Private Storage (Zero cloud, Zero telemetry, GBs capacity)

export type LibraryItemType = 'presentation' | 'image' | 'video';

export interface LibraryItem {
  id: string;
  name: string;
  type: LibraryItemType;
  blob: Blob;
  size: number;
  dateAdded: number;
  thumbnail?: string;
}

const DB_NAME = 'SmartStudioLibraryDB';
const DB_VERSION = 1;
const STORE_NAME = 'library_items';

export class LibraryStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('type', 'type', { unique: false });
            store.createIndex('dateAdded', 'dateAdded', { unique: false });
            store.createIndex('name', 'name', { unique: false });
          }
        };
        req.onsuccess = () => {
          // Request persistent storage so browser never auto-cleans under pressure
          if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
            navigator.storage.persist().catch(() => {});
          }
          resolve(req.result);
        };
        req.onerror = () => reject(req.error);
      });
    }
    return this.dbPromise;
  }

  async addItem(file: File): Promise<LibraryItem> {
    const db = await this.getDB();
    const type = this.detectType(file);
    const id = `lib_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    let thumbnail: string | undefined = undefined;
    if (type === 'image') {
      try {
        thumbnail = await this.generateImageThumbnail(file);
      } catch {}
    }

    const item: LibraryItem = {
      id,
      name: file.name,
      type,
      blob: file,
      size: file.size,
      dateAdded: Date.now(),
      thumbnail
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(item);
      req.onsuccess = () => resolve(item);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllItems(): Promise<LibraryItem[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const items: LibraryItem[] = req.result || [];
        items.sort((a, b) => b.dateAdded - a.dateAdded);
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async deleteItem(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getStorageInfo(): Promise<{ usedBytes: number; quotaBytes: number; usedFormatted: string; quotaFormatted: string; percent: number }> {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        const usedBytes = estimate.usage || 0;
        const quotaBytes = estimate.quota || (50 * 1024 * 1024 * 1024);
        const percent = quotaBytes > 0 ? Math.round((usedBytes / quotaBytes) * 100) : 0;
        return {
          usedBytes,
          quotaBytes,
          usedFormatted: this.formatBytes(usedBytes),
          quotaFormatted: this.formatBytes(quotaBytes),
          percent
        };
      } catch {}
    }
    return {
      usedBytes: 0,
      quotaBytes: 50 * 1024 * 1024 * 1024,
      usedFormatted: '0 MB',
      quotaFormatted: '50 GB',
      percent: 0
    };
  }

  detectType(file: File): LibraryItemType {
    const name = file.name.toLowerCase();
    if (name.endsWith('.pdf') || name.endsWith('.pptx') || name.endsWith('.ppt') || file.type === 'application/pdf') {
      return 'presentation';
    }
    if (file.type.startsWith('video/') || name.endsWith('.mp4') || name.endsWith('.webm') || name.endsWith('.mkv') || name.endsWith('.mov')) {
      return 'video';
    }
    return 'image';
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  private async generateImageThumbnail(file: File): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const max = 180;
        const scale = Math.min(max / img.width, max / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve('');
      };
      img.src = url;
    });
  }
}

export const libraryStore = new LibraryStore();
