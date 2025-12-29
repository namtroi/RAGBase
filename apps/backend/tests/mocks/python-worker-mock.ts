// Callback payload types (mirror CONTRACT.md)
interface Chunk {
  content: string;
  index: number;
  embedding: number[];
  metadata?: Record<string, unknown>;
}

interface ProcessingResult {
  markdown?: string; // Legacy support in mock if needed, or remove
  processedContent: string;
  chunks: Chunk[];
  pageCount: number;
  ocrApplied: boolean;
  processingTimeMs: number;
  metrics?: Record<string, unknown>;
}

interface ProcessingError {
  code: string;
  message: string;
}

interface CallbackPayload {
  documentId: string;
  success: boolean;
  result?: ProcessingResult;
  error?: ProcessingError;
}

/**
 * Create success callback payload
 */
export function successCallback(documentId: string, options?: Partial<ProcessingResult>): CallbackPayload {
  const content = options?.processedContent || options?.markdown || '# Test Document\n\nThis is test content extracted from PDF.';

  // Default simple chunking if not provided
  const chunks = options?.chunks || [{
    content: content,
    index: 0,
    embedding: Array(384).fill(0.1),
    metadata: {}
  }];

  return {
    documentId,
    success: true,
    result: {
      processedContent: content,
      // markdown: content, // Legacy
      chunks: chunks,
      pageCount: 1,
      ocrApplied: false,
      processingTimeMs: 150,
      ...options,
    },
  };
}

/**
 * Create failure callback payload
 */
export function failureCallback(
  documentId: string,
  code: string,
  message: string
): CallbackPayload {
  return {
    documentId,
    success: false,
    error: { code, message },
  };
}

/**
 * Common error callbacks
 */
export const ERRORS = {
  passwordProtected: (docId: string) =>
    failureCallback(docId, 'PASSWORD_PROTECTED', 'PDF is password protected'),
  corrupt: (docId: string) =>
    failureCallback(docId, 'CORRUPT_FILE', 'Unable to parse PDF structure'),
  timeout: (docId: string) =>
    failureCallback(docId, 'TIMEOUT', 'Processing exceeded time limit'),
  ocrFailed: (docId: string) =>
    failureCallback(docId, 'OCR_FAILED', 'OCR engine failed to extract text'),
};

/**
 * Simulate Python worker calling back to Node.js
 * Use this in integration tests to simulate worker completion
 */
export async function simulateWorkerCallback(
  baseUrl: string,
  payload: CallbackPayload
): Promise<Response> {
  return fetch(`${baseUrl}/internal/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
