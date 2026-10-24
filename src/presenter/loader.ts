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

  // Generates a rich, high-resolution sample deck for "Decoding Indology" channel
  createSampleDeck(): DeckInfo {
    const sampleSlides = [
      {
        title: 'Decoding Indology: प्राचीन भारतीय खगोलशास्त्र',
        subtitle: 'Ancient Indian Astronomy & Surya Siddhanta',
        points: [
          '• पृथ्वी का परिधि मापन: आर्यभट्ट (499 CE) ने 39,968 किमी मापा (आधुनिक मान 40,075 किमी)',
          '• पृथ्वी का अपनी धुरी पर घूर्णन: "चला पृथ्वी स्थिरा भाति"',
          '• ग्रहण का वैज्ञानिक कारण: राहु-केतु नहीं, अपितु पृथ्वी और चंद्रमा की छाया',
          '• त्रिकोणमिति में ज्या (Sine) और कोज्या (Cosine) की भारतीय उत्पत्ति'
        ],
        bg: '#0f172a',
        accent: '#f59e0b'
      },
      {
        title: 'सिंधु-सरस्वती सभ्यता की नगर योजना',
        subtitle: 'Urban Engineering of Harappa & Mohenjo-Daro',
        points: [
          '• ग्रिड प्रणाली पर आधारित सड़कें जो समकोण पर काटती थीं',
          '• विश्व की प्रथम विकसित भूमिगत जल निकासी प्रणाली (Underground Sewage)',
          '• मानक पक्की ईंटें: 1 : 2 : 4 का सार्वभौमिक अनुपात',
          '• विशाल स्नानागार (Great Bath) में बिटुमेन (Tar) का वाटरप्रूफ लेप'
        ],
        bg: '#18181b',
        accent: '#38bdf8'
      },
      {
        title: 'प्राचीन भारतीय धातु विज्ञान (Metallurgy)',
        subtitle: 'Rustless Wonders & Wootz Steel',
        points: [
          '• दिल्ली का लौह स्तंभ (Iron Pillar): 1600 वर्षों से जंग-मुक्त',
          '• वूट्ज़ स्टील (Wootz Steel): दमिश्क की प्रसिद्ध तलवारों का मूल स्रोत',
          '• जस्ता (Zinc) का आसवन (Distillation): राजस्थान के जावर में 12वीं शताब्दी से पूर्व',
          '• पंचधातु व अष्टधातु की उत्कृष्ट मूर्तियां (चोल कांस्य - नटराज)'
        ],
        bg: '#1c1917',
        accent: '#10b981'
      },
      {
        title: 'भारतीय गणितीय परंपरा: शून्य से अनंत तक',
        subtitle: 'From Shunya to Infinitesimal Calculus',
        points: [
          '• ब्रह्मगुप्त (628 CE): शून्य के साथ गणितीय संक्रियाओं के नियम',
          '• पिंगल का छंदशास्त्र (300 BCE): मेरु प्रस्तार (Pascal\'s Triangle) व द्विआधारी अंक (Binary)',
          '• माधव और केरल गणित संप्रदाय (14वीं शताब्दी): कैलकुलस की अनंत श्रेणियां (Infinite Series)',
          '• पाई (π) का 11 दशमलव स्थानों तक शुद्ध मान'
        ],
        bg: '#1e1b4b',
        accent: '#ec4899'
      }
    ];

    const pages: DeckPage[] = sampleSlides.map((slide, idx) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d')!;

      // Background gradient
      const grad = ctx.createLinearGradient(0, 0, 1920, 1080);
      grad.addColorStop(0, slide.bg);
      grad.addColorStop(1, '#000000');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1920, 1080);

      // Subtle decorative pattern grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      for (let x = 0; x < 1920; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 1080);
        ctx.stroke();
      }
      for (let y = 0; y < 1080; y += 80) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(1920, y);
        ctx.stroke();
      }

      // Channel Brand Watermark
      ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
      ctx.font = '700 24px Inter, sans-serif';
      ctx.fillText('DECODING INDOLOGY • 4K SMART STUDIO', 100, 110);

      // Slide Title
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 52px "Noto Sans Devanagari", Inter, sans-serif';
      ctx.fillText(slide.title, 100, 200);

      // Slide Subtitle
      ctx.fillStyle = slide.accent;
      ctx.font = '600 28px Inter, sans-serif';
      ctx.fillText(slide.subtitle, 100, 260);

      // Accent divider line
      ctx.fillStyle = slide.accent;
      ctx.fillRect(100, 290, 240, 4);

      // Points
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '500 32px "Noto Sans Devanagari", Inter, sans-serif';
      let yOffset = 390;
      for (const pt of slide.points) {
        ctx.fillText(pt, 120, yOffset);
        yOffset += 90;
      }

      // Footer
      ctx.fillStyle = '#64748b';
      ctx.font = '400 20px Inter, sans-serif';
      ctx.fillText(`Slide ${idx + 1} of ${sampleSlides.length} • Decoding Indology YouTube Channel`, 100, 1000);

      return {
        pageNumber: idx + 1,
        width: 1920,
        height: 1080,
        title: slide.title,
        sourceType: 'canvas',
        renderData: canvas
      };
    });

    return {
      id: 'sample-decoding-indology',
      name: 'Decoding Indology — Master Class (4K Sample Deck)',
      totalPages: pages.length,
      pages
    };
  }
}

export const deckLoader = new DeckLoader();
