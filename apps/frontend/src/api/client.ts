const API_BASE = '/api';

interface ApiConfig {
  apiKey: string;
}

let config: ApiConfig = {
  apiKey: localStorage.getItem('apiKey') || '',
};

export function setApiKey(key: string) {
  config.apiKey = key;
  localStorage.setItem('apiKey', key);
}

export function getApiKey(): string {
  return config.apiKey;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      'X-API-Key': config.apiKey,
      'Content-Type': options.body instanceof FormData
        ? (undefined as any)
        : 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),

  post: <T>(endpoint: string, data?: any) =>
    request<T>(endpoint, {
      method: 'POST',
      body: data instanceof FormData ? data : JSON.stringify(data),
    }),

  upload: <T>(endpoint: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<T>(endpoint, {
      method: 'POST',
      body: formData,
    });
  },
};
