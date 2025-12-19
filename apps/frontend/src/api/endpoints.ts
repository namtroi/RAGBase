import { api } from './client';

// Types
export interface Document {
  id: string;
  filename: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  format: string;
  lane: string;
  chunkCount?: number;
  failReason?: string;
  createdAt: string;
}

export interface QueryResult {
  content: string;
  score: number;
  documentId: string;
  metadata: {
    charStart: number;
    charEnd: number;
    page?: number;
    heading?: string;
  };
}

// Document endpoints
export const documentsApi = {
  list: (params?: { status?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const queryStr = query.toString();
    return api.get<{ documents: Document[]; total: number }>(
      `/documents${queryStr ? `?${queryStr}` : ''}`
    );
  },

  get: (id: string) => api.get<Document>(`/documents/${id}`),

  upload: (file: File) =>
    api.upload<{ id: string; filename: string; status: string; format: string; lane: string }>(
      '/documents',
      file
    ),
};

// Query endpoint
export const queryApi = {
  search: (query: string, topK = 5) =>
    api.post<{ results: QueryResult[] }>('/query', { query, topK }),
};
