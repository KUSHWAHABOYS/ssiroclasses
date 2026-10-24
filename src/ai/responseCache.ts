// ECON: 24h IndexedDB Cache for AI Responses per Part C2
export interface CachedResponse {
  key: string;
  text: string;
  provider: string;
  model: string;
  timestamp: number;
  isCached?: boolean;
}

const DB_NAME = 'ssiro_ai_cache_v1';
const STORE_NAME = 'responses';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class ResponseCache {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private memoryFallback: Map<string, CachedResponse> = new Map();

  constructor() {
    this.initDb();
  }

  private initDb(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise;

    if (typeof indexedDB === 'undefined') {
      this.dbPromise = Promise.resolve(null);
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          console.warn('IndexedDB open error in ResponseCache, using memory fallback');
          resolve(null);
        };
      } catch {
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  /**
   * Generates a deterministic hash key from prompt attributes
   */
  async computeKey(
    modelClass: string,
    slideText: string,
    question: string,
    language = 'hi',
    answerLength = 'normal'
  ): Promise<string> {
    const raw = `${modelClass}::${slideText.trim().slice(0, 1500)}::${question.trim()}::${language}::${answerLength}`;

    if (typeof crypto !== 'undefined' && crypto.subtle) {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(raw);
        const hashBuf = await crypto.subtle.digest('SHA-256', data);
        const hashArr = Array.from(new Uint8Array(hashBuf));
        return hashArr.map((b) => b.toString(16).padStart(2, '0')).join('');
      } catch {}
    }

    // Fallback simple string hash
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    return `hash_${Math.abs(hash)}`;
  }

  /**
   * Synchronous hash key generator for prompt attributes
   */
  makeKey(
    modelClass: string,
    slideText: string,
    question: string,
    language = 'hi',
    answerLength = 'normal'
  ): string {
    const raw = `${modelClass}::${slideText.trim().slice(0, 1500)}::${question.trim()}::${language}::${answerLength}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    return `hash_${Math.abs(hash)}`;
  }

  /**
   * ECON: Estimates token count based on ~3.5 chars per token (Part C2.6)
   */
  estimateTokens(text: string): number {
    return Math.ceil((text || '').length / 3.5);
  }

  async get(key: string): Promise<(CachedResponse & { isCached?: boolean }) | null> {
    const now = Date.now();

    // Try IndexedDB
    try {
      const db = await this.initDb();
      if (db) {
        return new Promise<CachedResponse | null>((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(key);
          req.onsuccess = () => {
            const item: CachedResponse | undefined = req.result;
            if (item && now - item.timestamp < TTL_MS) {
              resolve({ ...item, isCached: true });
            } else {
              resolve(null);
            }
          };
          req.onerror = () => resolve(null);
        });
      }
    } catch {}

    // Try memory fallback
    const mem = this.memoryFallback.get(key);
    if (mem && now - mem.timestamp < TTL_MS) {
      return { ...mem, isCached: true };
    }
    return null;
  }

  async set(key: string, data: { text: string; provider?: string; model?: string } | string, maybeModel?: string): Promise<void> {
    const text = typeof data === 'string' ? data : data.text;
    const provider = typeof data === 'string' ? 'gemini' : (data.provider || 'gemini');
    const model = typeof data === 'string' ? (maybeModel || 'gemini') : (data.model || maybeModel || 'gemini');

    const entry: CachedResponse = {
      key,
      text,
      provider,
      model,
      timestamp: Date.now()
    };

    this.memoryFallback.set(key, entry);

    try {
      const db = await this.initDb();
      if (db) {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(entry);
      }
    } catch (e) {
      console.warn('Failed to put entry into ResponseCache:', e);
    }
  }

  async clear(): Promise<void> {
    this.memoryFallback.clear();
    try {
      const db = await this.initDb();
      if (db) {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
      }
    } catch {}
  }
}

export const responseCache = new ResponseCache();
export const aiResponseCache = responseCache;

