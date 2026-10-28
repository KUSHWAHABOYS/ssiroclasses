import * as pdfjsLib from 'pdfjs-dist';
import { DeckInfo, DeckPage } from '../state/store';

// Configure local worker (bundled locally in public, zero CDN reliance)
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

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
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;

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
      img.onerror = reject;
      img.src = url;
    });
  }

  // AUDIT-FIX: BUG-001 - Removed createSampleDeck and sample slide assets per WEL-7
}

export const deckLoader = new DeckLoader();
