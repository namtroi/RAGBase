import { api } from './client';

// Types
export interface Document {
  id: string;
  filename: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  format: string;
  chunkCount?: number;
  failReason?: string;
  createdAt: string;
  sourceType?: 'MANUAL' | 'DRIVE';
  driveConfigId?: string;
  hasProcessedContent?: boolean;
  // Phase 3 additions
  fileSize?: number;
  isActive?: boolean;
  connectionState?: 'STANDALONE' | 'LINKED';
  // Phase 4 additions
  driveWebViewLink?: string;
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
  // Hybrid search: score breakdown (only present in hybrid mode)
  vectorScore?: number;
  keywordScore?: number;
  metadata: {
    page?: number;
    heading?: string;
    qualityScore?: number;
    chunkType?: string;
    breadcrumbs?: string[];
  };
}

export interface SearchParams {
  query: string;
  topK?: number;
  mode?: 'semantic' | 'hybrid';
  alpha?: number; // 0.0-1.0, weight for vector vs keyword
}

export interface SearchResponse {
  mode: 'semantic' | 'hybrid';
  alpha?: number; // Only present in hybrid mode
  results: QueryResult[];
}

export interface ListParams {
  status?: string;
  limit?: number;
  offset?: number;
  driveConfigId?: string;
  // Phase 3 additions
  isActive?: boolean;
  connectionState?: 'STANDALONE' | 'LINKED';
  sourceType?: 'MANUAL' | 'DRIVE';
  search?: string;
  sortBy?: 'createdAt' | 'filename' | 'fileSize';
  sortOrder?: 'asc' | 'desc';
}

export interface ListResponse {
  documents: Document[];
  total: number;
  counts?: {
    active: number;
    inactive: number;
    failed: number;
    pending: number;
    processing: number;
    completed: number;
  };
}

// Document endpoints
export const documentsApi = {
  list: (params?: ListParams) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    if (params?.driveConfigId) query.set('driveConfigId', params.driveConfigId);
    if (params?.isActive !== undefined) query.set('isActive', String(params.isActive));
    if (params?.connectionState) query.set('connectionState', params.connectionState);
    if (params?.sourceType) query.set('sourceType', params.sourceType);
    if (params?.search) query.set('search', params.search);
    if (params?.sortBy) query.set('sortBy', params.sortBy);
    if (params?.sortOrder) query.set('sortOrder', params.sortOrder);
    const queryStr = query.toString();
    return api.get<ListResponse>(
      `/documents${queryStr ? `?${queryStr}` : ''}`
    );
  },

  get: (id: string) => api.get<Document>(`/documents/${id}`),

  getContent: (id: string, format: 'markdown' | 'json' = 'markdown') =>
    api.get<{ content: string | unknown }>(`/documents/${id}/content?format=${format}`),

  downloadContent: (id: string, format: 'markdown' | 'json') =>
    api.download(`/documents/${id}/content?format=${format}`),

  upload: (file: File) =>
    api.upload<{ id: string; filename: string; status: string; format: string }>(
      '/documents',
      file
    ),

  toggleAvailability: (id: string, isActive: boolean) =>
    api.patch<Document>(`/documents/${id}/availability`, { isActive }),

  delete: (id: string) => api.delete<{ success: boolean }>(`/documents/${id}`),

  retry: (id: string) => api.post<Document>(`/documents/${id}/retry`, {}),

  // Bulk operations
  bulkToggleAvailability: (ids: string[], isActive: boolean) =>
    api.patch<{ updated: number; failed: string[] }>('/documents/bulk/availability', { documentIds: ids, isActive }),

  bulkDelete: (ids: string[]) =>
    api.post<{ deleted: number; failed: string[] }>('/documents/bulk/delete', { documentIds: ids }),

  bulkRetry: (ids: string[]) =>
    api.post<{ queued: number; failed: string[] }>('/documents/bulk/retry', { documentIds: ids }),
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
  search: (params: SearchParams) =>
    api.post<SearchResponse>('/query', {
      query: params.query,
      topK: params.topK ?? 5,
      mode: params.mode ?? 'semantic',
      alpha: params.alpha ?? 0.7,
    }),
};

// Analytics types
export interface AnalyticsOverview {
  totalDocuments: number;
  avgProcessingTimeMs: number;
  avgQualityScore: number;
  totalChunks: number;
  period: string;
  periodStart: string;
  periodEnd: string;
  // New metrics
  successRate: number;
  formatDistribution: Record<string, number>;
  avgUserWaitTimeMs: number;
}

export interface AnalyticsProcessing {
  period: string;
  format: string;
  periodStart: string;
  periodEnd: string;
  documentsProcessed: number;
  // New metrics
  ocrUsagePercent: number;
  avgConversionTimePerPage: number;
  breakdown: {
    avgConversionTimeMs: number;
    avgChunkingTimeMs: number;
    avgEmbeddingTimeMs: number;
    avgTotalTimeMs: number;
    avgQueueTimeMs: number;
    avgUserWaitTimeMs: number;
  };
  trends: Array<{
    date: string;
    count: number;
    avgTotalTimeMs: number;
    avgQueueTimeMs: number;
  }>;
}

export interface AnalyticsQuality {
  period: string;
  avgQualityScore: number;
  distribution: {
    excellent: number;
    good: number;
    low: number;
  };
  flags: Record<string, number>;
  totalChunks: number;
  // New rate metrics
  fragmentRate: number;
  noContextRate: number;
  tooShortRate: number;
  contextInjectionRate: number;
  avgTokensPerChunk: number;
}

export interface DocumentMetrics {
  id: string;
  filename: string;
  status: string;
  createdAt: string;
  metrics: {
    totalTimeMs: number;
    avgQualityScore: number;
    totalChunks: number;
    qualityFlags: Record<string, number>;
  } | null;
}

export interface ChunkListItem {
  id: string;
  documentId: string;
  filename: string;
  format: string;
  formatCategory: string | null;
  index: number;
  content: string;
  qualityScore: number | null;
  chunkType: string | null;
  completeness: string | null;
  hasTitle: boolean | null;
  qualityFlags: string[];
  tokenCount: number | null;
  breadcrumbs: string | null;
}

export interface ChunkDetail {
  id: string;
  documentId: string;
  document: { id: string; filename: string; format: string; formatCategory: string | null };
  index: number;
  content: string;
  qualityScore: number | null;
  qualityFlags: string[];
  chunkType: string | null;
  completeness: string | null;
  hasTitle: boolean | null;
  breadcrumbs: string | null;
  tokenCount: number | null;
  location: unknown | null;
  createdAt: string;
}

export interface ChunksListParams {
  page?: number;
  limit?: number;
  documentId?: string;
  quality?: 'excellent' | 'good' | 'low';
  type?: 'document' | 'presentation' | 'tabular';
  flags?: string;
  search?: string;
  sortBy?: 'index' | 'tokenCount' | 'qualityScore';
  sortOrder?: 'asc' | 'desc';
}

// Analytics endpoints
export const analyticsApi = {
  getOverview: () =>
    api.get<AnalyticsOverview>(`/analytics/overview?period=all`),

  getProcessing: (format?: string) => {
    const params = new URLSearchParams({ period: 'all' });
    if (format) params.set('format', format);
    return api.get<AnalyticsProcessing>(`/analytics/processing?${params.toString()}`);
  },

  getQuality: () =>
    api.get<AnalyticsQuality>(`/analytics/quality?period=all`),

  getDocuments: (params?: { page?: number; limit?: number; period?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.period) query.set('period', params.period);
    const queryStr = query.toString();
    return api.get<{ documents: DocumentMetrics[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>(
      `/analytics/documents${queryStr ? `?${queryStr}` : ''}`
    );
  },

  getDocumentChunks: (documentId: string) =>
    api.get<{ documentId: string; chunks: Array<{ id: string; index: number; content: string; qualityScore: number | null; qualityFlags: string[] }> }>(
      `/analytics/documents/${documentId}/chunks`
    ),
};

// Chunks Explorer endpoints
export const chunksApi = {
  list: (params?: ChunksListParams) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.documentId) query.set('documentId', params.documentId);
    if (params?.quality) query.set('quality', params.quality);
    if (params?.type) query.set('type', params.type);
    if (params?.flags) query.set('flags', params.flags);
    if (params?.search) query.set('search', params.search);
    if (params?.sortBy) query.set('sortBy', params.sortBy);
    if (params?.sortOrder) query.set('sortOrder', params.sortOrder);
    const queryStr = query.toString();
    return api.get<{ chunks: ChunkListItem[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>(
      `/chunks${queryStr ? `?${queryStr}` : ''}`
    );
  },

  get: (id: string) => api.get<ChunkDetail>(`/chunks/${id}`),
};

// Processing Profile types
export interface ProcessingProfile {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  isDefault: boolean;
  isArchived: boolean;
  createdAt: string;
  // Conversion settings
  pdfConverter: string; // "pymupdf" | "docling"
  pdfOcrMode: string;
  pdfOcrLanguages: string;
  conversionTableRows: number; // For XLSX/CSV
  conversionTableCols: number; // For XLSX/CSV
  maxFileSizeMb: number;
  // Chunking settings
  documentChunkSize: number;
  documentChunkOverlap: number;
  documentHeaderLevels: number;
  presentationMinChunk: number;
  tabularRowsPerChunk: number;
  // Quality settings
  qualityMinChars: number;
  qualityMaxChars: number;
  qualityPenaltyPerFlag: number;
  autoFixEnabled: boolean;
  autoFixMaxPasses: number;
  // Embedding settings (display only)
  embeddingModel: string;
  embeddingDimension: number;
  embeddingMaxTokens: number;
  // Counts
  documentCount?: number;
}

export interface ProfileCreateData {
  name: string;
  description?: string;
  pdfConverter?: string;
  pdfOcrMode?: string;
  pdfOcrLanguages?: string;
  conversionTableRows?: number;
  conversionTableCols?: number;
  documentChunkSize?: number;
  documentChunkOverlap?: number;
  documentHeaderLevels?: number;
  presentationMinChunk?: number;
  tabularRowsPerChunk?: number;
  qualityMinChars?: number;
  qualityMaxChars?: number;
  qualityPenaltyPerFlag?: number;
  autoFixEnabled?: boolean;
  autoFixMaxPasses?: number;
}

export interface ProfileDeleteConfirmation {
  requireConfirmation: boolean;
  message: string;
  documentCount: number;
  chunkCount: number;
}

// Processing Profile endpoints
export const profilesApi = {
  list: async (includeArchived = false) => {
    const response = await api.get<{ profiles: ProcessingProfile[] }>(
      `/profiles${includeArchived ? '?includeArchived=true' : ''}`
    );
    return response.profiles;
  },

  getActive: async () => {
    const response = await api.get<{ profile: ProcessingProfile }>('/profiles/active');
    return response.profile;
  },

  create: async (data: ProfileCreateData) => {
    const response = await api.post<{ profile: ProcessingProfile }>('/profiles', data);
    return response.profile;
  },

  duplicate: async (id: string, newName?: string) => {
    const response = await api.post<{ profile: ProcessingProfile }>(
      `/profiles/${id}/duplicate`,
      newName ? { newName } : {}
    );
    return response.profile;
  },

  activate: async (id: string) => {
    const response = await api.put<{ profile: ProcessingProfile }>(
      `/profiles/${id}/activate`,
      {}
    );
    return response.profile;
  },

  archive: async (id: string) => {
    const response = await api.put<{ profile: ProcessingProfile }>(
      `/profiles/${id}/archive`,
      {}
    );
    return response.profile;
  },

  unarchive: async (id: string) => {
    const response = await api.put<{ profile: ProcessingProfile }>(
      `/profiles/${id}/unarchive`,
      {}
    );
    return response.profile;
  },

  delete: (id: string, confirmed = false) =>
    api.delete<{ success: boolean } | ProfileDeleteConfirmation>(
      `/profiles/${id}${confirmed ? '?confirmed=true' : ''}`
    ),
};
