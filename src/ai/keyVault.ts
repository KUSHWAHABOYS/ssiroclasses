// MIC-AI: Multi-Provider Key Vault with AES-GCM 256-bit non-extractable CryptoKey in IndexedDB
const VAULT_DB = 'SmartStudioVaultDB';
const VAULT_STORE = 'crypto_keys';
const MULTI_VAULT_KEY = 'smart_studio_multi_vault';
const LEGACY_GEMINI_KEY = 'gemini_encrypted_vault';

export interface StoredEncryptedPayload {
  iv: number[];
  ciphertext: number[];
  last4: string;
}

type MultiVaultStore = Record<string, StoredEncryptedPayload>;

async function getVaultDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(VAULT_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(VAULT_STORE)) {
        db.createObjectStore(VAULT_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class KeyVault {
  private cachedKey: CryptoKey | null = null;
  private migrated = false;

  private async getOrCreateCryptoKey(): Promise<CryptoKey> {
    if (this.cachedKey) return this.cachedKey;

    const db = await getVaultDB();
    const existingKey = await new Promise<CryptoKey | null>((resolve) => {
      const tx = db.transaction(VAULT_STORE, 'readonly');
      const store = tx.objectStore(VAULT_STORE);
      const req = store.get('aes_master_key');
      req.onsuccess = () => resolve(req.result?.key || null);
      req.onerror = () => resolve(null);
    });

    if (existingKey) {
      this.cachedKey = existingKey;
      return existingKey;
    }

    // Generate AES-GCM 256-bit unextractable key
    const newKey = await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      false, // non-extractable per B10.2 / C4
      ['encrypt', 'decrypt']
    );

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(VAULT_STORE, 'readwrite');
      const store = tx.objectStore(VAULT_STORE);
      const req = store.put({ id: 'aes_master_key', key: newKey });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    this.cachedKey = newKey;
    return newKey;
  }

  // MIC-AI: Auto-migrate legacy Gemini key into multi-vault
  private checkMigration(): void {
    if (this.migrated) return;
    this.migrated = true;
    try {
      const legacyRaw = localStorage.getItem(LEGACY_GEMINI_KEY);
      if (legacyRaw) {
        const multiStore = this.getMultiStore();
        if (!multiStore['gemini']) {
          const payload: StoredEncryptedPayload = JSON.parse(legacyRaw);
          multiStore['gemini'] = payload;
          localStorage.setItem(MULTI_VAULT_KEY, JSON.stringify(multiStore));
        }
      }
    } catch (e) {
      console.warn('KeyVault migration notice:', e);
    }
  }

  private getMultiStore(): MultiVaultStore {
    try {
      const raw = localStorage.getItem(MULTI_VAULT_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private saveMultiStore(store: MultiVaultStore): void {
    localStorage.setItem(MULTI_VAULT_KEY, JSON.stringify(store));
  }

  /**
   * Stores an API key for any provider (AES-GCM encrypted)
   */
  async storeKey(providerId: string, rawKey: string): Promise<string> {
    this.checkMigration();
    const trimmed = rawKey.trim();
    if (!trimmed) throw new Error('API Key cannot be empty');

    const cryptoKey = await this.getOrCreateCryptoKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(trimmed);

    const ciphertextBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv
      },
      cryptoKey,
      encoded
    );

    const last4 = trimmed.slice(-4);
    const payload: StoredEncryptedPayload = {
      iv: Array.from(iv),
      ciphertext: Array.from(new Uint8Array(ciphertextBuffer)),
      last4
    };

    const store = this.getMultiStore();
    store[providerId] = payload;
    this.saveMultiStore(store);

    // Keep legacy key slot updated if gemini
    if (providerId === 'gemini') {
      localStorage.setItem(LEGACY_GEMINI_KEY, JSON.stringify(payload));
    }

    return `••••••••${last4}`;
  }

  /**
   * Decrypts in memory only for the request
   */
  async getKey(providerId: string = 'gemini'): Promise<string | null> {
    this.checkMigration();
    try {
      const store = this.getMultiStore();
      const payload = store[providerId];
      if (!payload) return null;

      const cryptoKey = await this.getOrCreateCryptoKey();
      const iv = new Uint8Array(payload.iv);
      const ciphertext = new Uint8Array(payload.ciphertext);

      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv
        },
        cryptoKey,
        ciphertext
      );

      return new TextDecoder().decode(decrypted);
    } catch (err) {
      console.error(`Failed to decrypt API key for provider ${providerId}:`, err);
      return null;
    }
  }

  getMaskedKey(providerId: string = 'gemini'): string | null {
    this.checkMigration();
    try {
      const store = this.getMultiStore();
      const payload = store[providerId];
      if (!payload) return null;
      return `••••••••${payload.last4 || '••••'}`;
    } catch {
      return null;
    }
  }

  hasKey(providerId: string = 'gemini'): boolean {
    this.checkMigration();
    const store = this.getMultiStore();
    return !!store[providerId];
  }

  hasAnyKey(): boolean {
    this.checkMigration();
    const store = this.getMultiStore();
    return Object.keys(store).length > 0;
  }

  getAllConfiguredProviders(): string[] {
    this.checkMigration();
    const store = this.getMultiStore();
    return Object.keys(store);
  }

  deleteKey(providerId: string = 'gemini'): void {
    this.checkMigration();
    const store = this.getMultiStore();
    delete store[providerId];
    this.saveMultiStore(store);

    if (providerId === 'gemini') {
      localStorage.removeItem(LEGACY_GEMINI_KEY);
    }
  }

  // AUDIT-FIX: BUG-009 - Delete all AI keys completely from device (SET-3, PRV-1)
  deleteAllKeys(): void {
    this.saveMultiStore({});
    localStorage.removeItem(LEGACY_GEMINI_KEY);
    localStorage.removeItem(MULTI_VAULT_KEY);
  }

  // --- Legacy Compatibility Methods ---
  async storeApiKey(rawKey: string): Promise<string> {
    return this.storeKey('gemini', rawKey);
  }

  async getApiKey(): Promise<string | null> {
    return this.getKey('gemini');
  }
}

export const keyVault = new KeyVault();
