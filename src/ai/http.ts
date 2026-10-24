// MIC-AI: Universal HTTP Client with Native APK Support & CORS Detection
import { Capacitor, CapacitorHttp } from '@capacitor/core';

export type AIErrorCode =
  | 'invalid_key'
  | 'quota_exceeded'
  | 'model_not_found'
  | 'no_vision'
  | 'cors_blocked'
  | 'network_error'
  | 'other';

export class AIRequestError extends Error {
  code: AIErrorCode;
  status?: number;
  providerId?: string;
  details?: any; // ECON: structured error details (e.g. google.rpc.QuotaFailure)

  constructor(message: string, code: AIErrorCode, status?: number, providerId?: string, details?: any) {
    super(message);
    this.name = 'AIRequestError';
    this.code = code;
    this.status = status;
    this.providerId = providerId;
    this.details = details;
  }
}

export interface HttpRequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  data?: any;
  signal?: AbortSignal;
  expectedHost?: string;
  providerId?: string;
}

export interface HttpResponse<T = any> {
  status: number;
  ok: boolean;
  data: T;
  headers: Record<string, string>;
}

export class HttpClient {
  /**
   * Universal fetch: uses CapacitorHttp on native Android, standard fetch in browser
   */
  async request<T = any>(options: HttpRequestOptions): Promise<HttpResponse<T>> {
    const {
      url,
      method = 'GET',
      headers = {},
      data,
      signal,
      expectedHost,
      providerId = 'ai'
    } = options;

    // Security check: verify hostname against registered base URL to prevent key leakage
    if (expectedHost) {
      try {
        const parsedUrl = new URL(url);
        if (parsedUrl.hostname !== expectedHost && !parsedUrl.hostname.endsWith(`.${expectedHost}`)) {
          throw new AIRequestError(
            `सुरक्षा त्रुटि: अप्रत्याशित होस्ट पर कुंजी भेजने से रोका गया (${parsedUrl.hostname})`,
            'other',
            0,
            providerId
          );
        }
      } catch (e: any) {
        if (e instanceof AIRequestError) throw e;
        throw new AIRequestError(`अमान्य URL: ${url}`, 'other', 0, providerId);
      }
    }

    // Check if running inside native Android Capacitor container
    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      return this.requestNative<T>(url, method, headers, data, providerId);
    } else {
      return this.requestBrowser<T>(url, method, headers, data, signal, providerId);
    }
  }

  private async requestNative<T>(
    url: string,
    method: string,
    headers: Record<string, string>,
    data: any,
    providerId: string
  ): Promise<HttpResponse<T>> {
    try {
      const response = await CapacitorHttp.request({
        url,
        method,
        headers,
        data: typeof data === 'object' ? data : undefined
      });

      const ok = response.status >= 200 && response.status < 300;
      let responseData = response.data;
      if (typeof responseData === 'string') {
        try {
          responseData = JSON.parse(responseData);
        } catch {}
      }

      if (!ok) {
        this.handleHttpError(response.status, responseData, providerId);
      }

      return {
        status: response.status,
        ok,
        data: responseData,
        headers: response.headers || {}
      };
    } catch (err: any) {
      if (err instanceof AIRequestError) throw err;
      throw new AIRequestError(
        `नेटवर्क त्रुटि (Android Native): ${err.message || 'Connection failed'}`,
        'network_error',
        0,
        providerId
      );
    }
  }

  private async requestBrowser<T>(
    url: string,
    method: string,
    headers: Record<string, string>,
    data: any,
    signal?: AbortSignal,
    providerId?: string
  ): Promise<HttpResponse<T>> {
    try {
      const body = data ? (typeof data === 'string' ? data : JSON.stringify(data)) : undefined;

      const res = await fetch(url, {
        method,
        headers: {
          ...headers,
          ...(data && !headers['Content-Type'] ? { 'Content-Type': 'application/json' } : {})
        },
        body,
        signal
      });

      const ok = res.ok;
      let parsedData: any;
      const text = await res.text();
      try {
        parsedData = JSON.parse(text);
      } catch {
        parsedData = text;
      }

      if (!ok) {
        this.handleHttpError(res.status, parsedData, providerId || 'ai');
      }

      const resHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        resHeaders[k] = v;
      });

      return {
        status: res.status,
        ok,
        data: parsedData,
        headers: resHeaders
      };
    } catch (err: any) {
      if (err instanceof AIRequestError) throw err;

      // Detect Browser CORS block
      if (err.name === 'TypeError' && err.message.toLowerCase().includes('fetch')) {
        throw new AIRequestError(
          `इस प्रदाता को ब्राउज़र से सीधे कॉल नहीं किया जा सकता (CORS प्रतिबन्धित)। कृपया Android APK ऐप का उपयोग करें, या Gemini/OpenRouter चुनें जो ब्राउज़र कॉल की अनुमति देते हैं।\n(This provider cannot be called directly from a browser due to CORS. Use the Android app or choose Gemini/OpenRouter.)`,
          'cors_blocked',
          0,
          providerId
        );
      }

      if (err.name === 'AbortError') {
        throw new AIRequestError('अनुरोध रद्द कर दिया गया (Request aborted)', 'other', 0, providerId);
      }

      throw new AIRequestError(
        `नेटवर्क त्रुटि: ${err.message || 'Connection failed'}`,
        'network_error',
        0,
        providerId
      );
    }
  }

  private handleHttpError(status: number, data: any, providerId: string): void {
    const errorMsg =
      data?.error?.message ||
      data?.message ||
      data?.error ||
      JSON.stringify(data) ||
      `HTTP Error ${status}`;

    if (status === 401 || status === 403) {
      throw new AIRequestError(
        `अमान्य या अनधिकृत API कुंजी (${providerId}): ${errorMsg}`,
        'invalid_key',
        status,
        providerId,
        data
      );
    }

    if (status === 429) {
      throw new AIRequestError(
        `कोटा सीमा समाप्त या रेट लिमिट (${providerId}): ${errorMsg}`,
        'quota_exceeded',
        status,
        providerId,
        data
      );
    }

    if (status === 404) {
      throw new AIRequestError(
        `मॉडल या एंडपॉइंट नहीं मिला (${providerId}): ${errorMsg}`,
        'model_not_found',
        status,
        providerId,
        data
      );
    }

    throw new AIRequestError(
      `प्रदाता त्रुटि [${status}] (${providerId}): ${errorMsg}`,
      'other',
      status,
      providerId,
      data
    );
  }
}

export const httpClient = new HttpClient();
