const VAULT_DB = 'SmartStudioVaultDB';
const VAULT_STORE = 'crypto_keys';

interface StoredEncryptedPayload {
  iv: number[];
  ciphertext: number[];
  last4: string;
}

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
      false, // extractable: false per B10.2
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

  async storeApiKey(rawKey: string): Promise<string> {
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

    localStorage.setItem('gemini_encrypted_vault', JSON.stringify(payload));
    return `••••••••${last4}`;
  }

  async getApiKey(): Promise<string | null> {
    try {
      const raw = localStorage.getItem('gemini_encrypted_vault');
      if (!raw) return null;

      const payload: StoredEncryptedPayload = JSON.parse(raw);
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
      console.error('Failed to decrypt API key from vault:', err);
      return null;
    }
  }

  getMaskedKey(): string | null {
    try {
      const raw = localStorage.getItem('gemini_encrypted_vault');
      if (!raw) return null;
      const payload: StoredEncryptedPayload = JSON.parse(raw);
      return `••••••••${payload.last4 || '••••'}`;
    } catch {
      return null;
    }
  }

  hasKey(): boolean {
    return !!localStorage.getItem('gemini_encrypted_vault');
  }

  deleteKey(): void {
    localStorage.removeItem('gemini_encrypted_vault');
  }
}

export const keyVault = new KeyVault();
