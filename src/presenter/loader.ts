import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { DeckInfo, DeckPage } from '../state/store';

const CDN_WORKER_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';

// Configure robust CDN worker URL
try {
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = CDN_WORKER_URL;
} catch (_) {}

const DB_NAME = 'SmartStudioDecksDB';
const STORE_NAME = 'decks';

async function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDeckToIndexedDB(deck: DeckInfo, blob?: Blob): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const item = {
      id: deck.id,
      name: deck.name,
      totalPages: deck.totalPages,
      savedAt: Date.now(),
      blob: blob || null
    };
    store.put(item);
  } catch (err) {
    console.warn('Failed to cache deck to IndexedDB:', err);
  }
}

export class DeckLoader {
  async loadPDF(file: File | Blob, name: string): Promise<DeckInfo> {
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    try {
      (pdfjsLib as any).GlobalWorkerOptions.workerSrc = CDN_WORKER_URL;
    } catch (_) {}

    let pdfDoc: any;
    try {
      const loadingTask = (pdfjsLib as any).getDocument({
        data: uint8,
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
        cMapPacked: true,
      });
      pdfDoc = await loadingTask.promise;
    } catch (workerErr: any) {
      console.warn('Primary parse failed, retrying simple fallback...', workerErr);
      try {
        const fallbackTask = (pdfjsLib as any).getDocument({
          data: uint8,
        });
        pdfDoc = await fallbackTask.promise;
      } catch (finalErr: any) {
        throw new Error(finalErr?.message || workerErr?.message || 'PDF पार्स नहीं हो सका');
      }
    }

    const pages: DeckPage[] = [];
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const pageProxy = await pdfDoc.getPage(i);
      const viewport = pageProxy.getViewport({ scale: 1.0 });
      pages.push({
        pageNumber: i,
        width: viewport.width,
        height: viewport.height,
        sourceType: 'pdf',
        renderData: pageProxy
      });
    }

    const deck: DeckInfo = {
      id: `deck-${Date.now()}`,
      name,
      totalPages: pages.length,
      pages
    };

    saveDeckToIndexedDB(deck, file);
    return deck;
  }

  async loadImages(files: File[]): Promise<DeckInfo> {
    const pages: DeckPage[] = [];
    const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    for (let i = 0; i < sorted.length; i++) {
      const file = sorted[i];
      const url = URL.createObjectURL(file);
      const img = await this.loadImageElement(url);
      pages.push({
        pageNumber: i + 1,
        width: img.naturalWidth || 1920,
        height: img.naturalHeight || 1080,
        sourceType: 'image',
        renderData: img
      });
    }

    return {
      id: `images-${Date.now()}`,
      name: `Image Deck (${files.length} slides)`,
      totalPages: pages.length,
      pages
    };
  }

  private loadImageElement(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image slide'));
      img.src = url;
    });
  }
}

export const deckLoader = new DeckLoader();
