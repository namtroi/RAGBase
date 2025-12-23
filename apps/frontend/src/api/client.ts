const API_BASE = '/api';

interface ApiConfig {
  apiKey: string;
}

const config: ApiConfig = {
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
  const isFormData = options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...options.headers as Record<string, string>,
    'X-API-Key': config.apiKey,
  };

  // Only set Content-Type for non-FormData requests
  // FormData needs browser to auto-set with boundary
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}


export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),

  post: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, {
      method: 'POST',
      body: data instanceof FormData ? data : JSON.stringify(data),
    }),

  patch: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: <T>(endpoint: string) =>
    request<T>(endpoint, {
      method: 'DELETE',
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
