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
  sourceType?: 'MANUAL' | 'DRIVE';
  driveConfigId?: string;
  hasProcessedContent?: boolean;
}

export interface DriveConfig {
  id: string;
  folderId: string;
  folderName: string;
  syncCron: string;
  recursive: boolean;
  enabled: boolean;
  syncStatus: 'IDLE' | 'SYNCING' | 'ERROR';
  syncError?: string;
  lastSyncedAt?: string;
  documentCount?: number;
  createdAt: string;
  updatedAt: string;
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
  list: (params?: { status?: string; limit?: number; offset?: number; driveConfigId?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    if (params?.driveConfigId) query.set('driveConfigId', params.driveConfigId);
    const queryStr = query.toString();
    return api.get<{ documents: Document[]; total: number }>(
      `/documents${queryStr ? `?${queryStr}` : ''}`
    );
  },

  get: (id: string) => api.get<Document>(`/documents/${id}`),

  getContent: (id: string, format: 'markdown' | 'json' = 'markdown') =>
    api.get<{ content: string | unknown }>(`/documents/${id}/content?format=${format}`),

  downloadContent: (id: string, format: 'markdown' | 'json') =>
    api.download(`/documents/${id}/content?format=${format}`),

  upload: (file: File) =>
    api.upload<{ id: string; filename: string; status: string; format: string; lane: string }>(
      '/documents',
      file
    ),
};

// Drive endpoints
export const driveApi = {
  listConfigs: () => api.get<{ configs: DriveConfig[] }>('/drive/configs'),

  createConfig: (data: { folderId: string; syncCron?: string; recursive?: boolean; enabled?: boolean }) =>
    api.post<DriveConfig>('/drive/configs', data),

  updateConfig: (id: string, data: Partial<Omit<DriveConfig, 'id' | 'folderId' | 'folderName' | 'createdAt' | 'updatedAt'>>) =>
    api.patch<DriveConfig>(`/drive/configs/${id}`, data),

  deleteConfig: (id: string) => api.delete<{ success: boolean }>(`/drive/configs/${id}`),

  triggerSync: (configId: string) =>
    api.post<{ message: string; status: string }>(`/drive/sync/${configId}/trigger`, {}),

  getSyncStatus: (configId: string) =>
    api.get<{ status: string; error?: string; lastSyncedAt?: string }>(`/drive/sync/${configId}/status`),
};

// Query endpoint
export const queryApi = {
  search: (query: string, topK = 5) =>
    api.post<{ results: QueryResult[] }>('/query', { query, topK }),
};
