// ECON: Quota and Cooldown Manager for Multi-Provider AI and Economy Fallback
export interface CooldownEntry {
  provider: string;
  model: string;
  reason: 'minute' | 'day';
  until: number; // timestamp in ms
  retryDelaySeconds?: number;
  resetTimeFormatted?: string;
  message?: string;
}

export interface FriendlyErrorResult {
  friendlyHindi: string;
  friendlyEnglish: string;
  userMessage: string;
  technicalDetails: string;
  isQuota: boolean;
  isDaily: boolean;
  resetTimeFormatted?: string;
}

const STORAGE_KEY = 'ssiro_model_cooldown_v1';

export class QuotaManager {
  private cooldownMap: Map<string, CooldownEntry> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  private getKey(provider: string, model: string): string {
    const cleanModel = model.toLowerCase().replace(/^(models\/)/, '');
    return `${provider.toLowerCase()}::${cleanModel}`;
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed: Record<string, CooldownEntry> = JSON.parse(raw);
      const now = Date.now();
      for (const [k, v] of Object.entries(parsed)) {
        if (v && v.until > now) {
          this.cooldownMap.set(k, v);
        }
      }
    } catch (e) {
      console.warn('Failed to load model cooldowns from storage:', e);
    }
  }

  private saveToStorage(): void {
    try {
      const obj: Record<string, CooldownEntry> = {};
      const now = Date.now();
      for (const [k, v] of this.cooldownMap.entries()) {
        if (v.until > now) {
          obj[k] = v;
        }
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
      console.warn('Failed to save model cooldowns to storage:', e);
    }
  }

  /**
   * Checks whether a specific model for a provider is currently available (not in cooldown)
   */
  isModelAvailable(provider: string, model: string): boolean {
    const key = this.getKey(provider, model);
    const entry = this.cooldownMap.get(key);
    if (!entry) return true;

    if (Date.now() >= entry.until) {
      this.cooldownMap.delete(key);
      this.saveToStorage();
      return true;
    }
    return false;
  }

  /**
   * Returns current cooldown entry if active
   */
  getCooldown(provider: string, model: string): CooldownEntry | null {
    const key = this.getKey(provider, model);
    const entry = this.cooldownMap.get(key);
    if (!entry) return null;
    if (Date.now() >= entry.until) {
      this.cooldownMap.delete(key);
      this.saveToStorage();
      return null;
    }
    return entry;
  }

  /**
   * Parses structured error details from Google Gemini / other providers
   */
  parseError(error: any): {
    isQuota: boolean;
    isDaily: boolean;
    retryDelaySeconds?: number;
    resetTimeFormatted?: string;
    rawText: string;
    maskedDetails: string;
  } {
    const rawMsg = typeof error === 'string' ? error : error?.message || JSON.stringify(error) || '';
    const status = error?.status || 0;
    const lower = rawMsg.toLowerCase();

    // Check if error is quota / 429
    const isQuota =
      status === 429 ||
      lower.includes('quota') ||
      lower.includes('rate limit') ||
      lower.includes('resource_exhausted') ||
      lower.includes('free-tier limit') ||
      lower.includes('limit reached') ||
      error?.code === 'quota_exceeded';

    // Parse retry delay if present (e.g. "retryDelay": "60s" or "Retry-After" or in message)
    let retryDelaySeconds: number | undefined;
    const retryMatch = rawMsg.match(/retry(?:ing)? after (\d+)s/i) || rawMsg.match(/"retryDelay":\s*"(\d+)s"/i);
    if (retryMatch) {
      retryDelaySeconds = parseInt(retryMatch[1], 10);
    }

    // Determine if daily quota vs per-minute rate limit
    // Google Gemini specifies per-day quotas (e.g. "free tier limit reached", "daily quota", "GenerateContentRequestsPerDay")
    // or standard flash with limit 20 requests per day
    const isDaily =
      lower.includes('perday') ||
      lower.includes('per-day') ||
      lower.includes('daily') ||
      lower.includes('free-tier limit') ||
      lower.includes('free tier limit') ||
      (isQuota && !retryDelaySeconds && (lower.includes('day') || lower.includes('exhausted')));

    // Compute formatted next reset time (if daily, midnight PST or 24h; if delay, now + delay)
    let resetTimeFormatted = '';
    const now = new Date();
    if (retryDelaySeconds && retryDelaySeconds > 0) {
      const resetDate = new Date(now.getTime() + retryDelaySeconds * 1000);
      resetTimeFormatted = resetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (isDaily) {
      // Google API quotas typically reset at midnight Pacific Time (PST/PDT)
      const target = new Date();
      target.setHours(24, 0, 0, 0); // next midnight local fallback
      resetTimeFormatted = target.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Mask sensitive keys from diagnostic details
    const maskedDetails = rawMsg
      .replace(/AIza[0-9A-Za-z-_]{8,}/g, 'AIza***[MASKED]')
      .replace(/sk-[0-9A-Za-z-_]{8,}/g, 'sk-***[MASKED]')
      .replace(/([?&]key=)(?!AIza)[^&\s"'>]+/gi, '$1[MASKED]');

    return {
      isQuota,
      isDaily,
      retryDelaySeconds,
      resetTimeFormatted,
      rawText: rawMsg,
      maskedDetails
    };
  }

  /**
   * Records a quota error for a model and updates cooldown map
   */
  recordQuotaError(provider: string, model: string, error: any): CooldownEntry {
    const parsed = this.parseError(error);
    const key = this.getKey(provider, model);

    let until: number;
    let reason: 'minute' | 'day';

    if (parsed.isDaily) {
      reason = 'day';
      // Lock out for 12 hours or until next midnight (at least 6 hours)
      until = Date.now() + 12 * 60 * 60 * 1000;
    } else {
      reason = 'minute';
      const delay = (parsed.retryDelaySeconds || 60) * 1000;
      until = Date.now() + Math.max(30000, delay);
    }

    const entry: CooldownEntry = {
      provider,
      model,
      reason,
      until,
      retryDelaySeconds: parsed.retryDelaySeconds,
      resetTimeFormatted: parsed.resetTimeFormatted,
      message: parsed.maskedDetails
    };

    this.cooldownMap.set(key, entry);
    this.saveToStorage();
    return entry;
  }

  /**
   * Formats friendly Hindi/English cards with collapsible technical details per Part C4
   */
  formatFriendlyError(err: any, currentModel?: string, nextModel?: string): FriendlyErrorResult {
    const parsed = this.parseError(err);
    const raw = typeof err === 'string' ? err : err?.message || '';
    const lower = raw.toLowerCase();

    // 1. Quota errors (Part C4)
    if (parsed.isQuota) {
      if (parsed.isDaily) {
        const nextHint = nextModel ? ` दूसरे मॉडल (${nextModel}) पर जा रहा हूँ…` : '';
        const resetStr = parsed.resetTimeFormatted ? ` (अगला रीसेट: ${parsed.resetTimeFormatted})` : '';
        const msg = `आज की फ़्री सीमा इस मॉडल (${currentModel || 'Gemini'}) की ख़त्म।${nextHint}${resetStr}`;
        return {
          friendlyHindi: msg,
          friendlyEnglish: `Daily free quota reached for this model.${nextModel ? ` Switching to ${nextModel}...` : ''}`,
          userMessage: msg,
          technicalDetails: parsed.maskedDetails,
          isQuota: true,
          isDaily: true,
          resetTimeFormatted: parsed.resetTimeFormatted
        };
      } else {
        const msg = 'थोड़ी देर रुकें… (रेट लिमिट सीमा)। कुछ क्षणों में पुनः प्रयास होगा।';
        return {
          friendlyHindi: msg,
          friendlyEnglish: 'Rate limit reached. Pausing briefly before retry...',
          userMessage: msg,
          technicalDetails: parsed.maskedDetails,
          isQuota: true,
          isDaily: false
        };
      }
    }

    // 2. Invalid Key
    if (err?.code === 'invalid_key' || lower.includes('invalid_key') || lower.includes('unauthorized') || lower.includes('401') || lower.includes('403')) {
      const msg = 'API Key अमान्य या अनधिकृत है। कृपया सेटिंग्स → AI में अपनी सही कुंजी दर्ज करें।';
      return {
        friendlyHindi: msg,
        friendlyEnglish: 'API key is invalid or unauthorized. Please verify your key in Settings → AI.',
        userMessage: msg,
        technicalDetails: parsed.maskedDetails,
        isQuota: false,
        isDaily: false
      };
    }

    // 3. Network / Offline
    if (err?.code === 'network_error' || lower.includes('network') || lower.includes('offline') || lower.includes('failed to fetch')) {
      const msg = 'इंटरनेट कनेक्शन उपलब्ध नहीं है या नेटवर्क त्रुटि हुई।';
      return {
        friendlyHindi: msg,
        friendlyEnglish: 'Network connection failed. Please check your internet connection.',
        userMessage: msg,
        technicalDetails: parsed.maskedDetails,
        isQuota: false,
        isDaily: false
      };
    }

    // 4. CORS blocked
    if (err?.code === 'cors_blocked' || lower.includes('cors')) {
      const msg = 'इस प्रदाता को ब्राउज़र से सीधे कॉल नहीं किया जा सकता (CORS)। Android ऐप का उपयोग करें या Gemini चुनें।';
      return {
        friendlyHindi: msg,
        friendlyEnglish: 'This provider cannot be called directly from browser due to CORS. Use Android APK or Gemini.',
        userMessage: msg,
        technicalDetails: parsed.maskedDetails,
        isQuota: false,
        isDaily: false
      };
    }

    // 5. Model Not Found / Unavailable
    if (err?.code === 'model_not_found' || lower.includes('not found') || lower.includes('404')) {
      const msg = `मॉडल ${currentModel || ''} वर्तमान में उपलब्ध नहीं है।`;
      return {
        friendlyHindi: msg,
        friendlyEnglish: `The requested model is currently unavailable or deprecated.`,
        userMessage: msg,
        technicalDetails: parsed.maskedDetails,
        isQuota: false,
        isDaily: false
      };
    }

    // 6. Generic / Content Filtered
    if (lower.includes('safety') || lower.includes('blocked') || lower.includes('filter')) {
      const msg = 'सामग्री सुरक्षा नीति के तहत AI प्रतिक्रिया रोकी गई।';
      return {
        friendlyHindi: msg,
        friendlyEnglish: 'Content was blocked by safety filters.',
        userMessage: msg,
        technicalDetails: parsed.maskedDetails,
        isQuota: false,
        isDaily: false
      };
    }

    const defaultMsg = 'AI सहायक से संपर्क करने में त्रुटि हुई।';
    return {
      friendlyHindi: defaultMsg,
      friendlyEnglish: 'An error occurred while contacting the AI assistant.',
      userMessage: defaultMsg,
      technicalDetails: parsed.maskedDetails,
      isQuota: false,
      isDaily: false
    };
  }

  /**
   * Clears cooldown entries (e.g. for testing or key update)
   */
  clearCooldown(provider?: string, model?: string): void {
    if (provider && model) {
      this.cooldownMap.delete(this.getKey(provider, model));
    } else {
      this.cooldownMap.clear();
    }
    this.saveToStorage();
  }

  // ECON: Helper for tests and resets
  clearAllCooldowns(): void {
    this.clearCooldown();
  }

  // ECON: Record failure helper
  recordFailure(provider: string, model: string, status: number, message: string): CooldownEntry {
    return this.recordQuotaError(provider, model, { status, message });
  }

  // ECON: Get cooldown entry with friendly fields
  getCooldownEntry(provider: string, model: string): (CooldownEntry & { isPerDay: boolean; availableAt: number }) | null {
    const entry = this.getCooldown(provider, model);
    if (!entry) return null;
    return {
      ...entry,
      isPerDay: entry.reason === 'day',
      availableAt: entry.until
    };
  }
}

export const quotaManager = new QuotaManager();

