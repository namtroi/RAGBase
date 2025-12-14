export interface QualityConfig {
  minTextLength: number;
  maxNoiseRatio: number;    // Warn threshold
  rejectNoiseRatio: number; // Reject threshold
}

export interface QualityResult {
  passed: boolean;
  reason?: 'TEXT_TOO_SHORT' | 'EXCESSIVE_NOISE';
  warnings: string[];
  noiseRatio: number;
  textLength: number;
}

const DEFAULT_CONFIG: QualityConfig = {
  minTextLength: 50,
  maxNoiseRatio: 0.5,
  rejectNoiseRatio: 0.8,
};

export class QualityGateService {
  private config: QualityConfig;

  constructor(config: Partial<QualityConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  validate(text: string): QualityResult {
    const warnings: string[] = [];

    // Calculate actual content length (non-whitespace)
    const contentLength = text.replace(/\s/g, '').length;

    // Check minimum length
    if (contentLength < this.config.minTextLength) {
      return {
        passed: false,
        reason: 'TEXT_TOO_SHORT',
        warnings: [],
        noiseRatio: 0,
        textLength: contentLength,
      };
    }

    // Calculate noise ratio
    const noiseRatio = this.calculateNoiseRatio(text);

    // Reject if too noisy
    if (noiseRatio > this.config.rejectNoiseRatio) {
      return {
        passed: false,
        reason: 'EXCESSIVE_NOISE',
        warnings: [],
        noiseRatio,
        textLength: contentLength,
      };
    }

    // Warn if moderately noisy
    if (noiseRatio > this.config.maxNoiseRatio) {
      warnings.push('HIGH_NOISE_RATIO');
    }

    return {
      passed: true,
      warnings,
      noiseRatio,
      textLength: contentLength,
    };
  }

  calculateNoiseRatio(text: string): number {
    if (text.length === 0) return 0;

    // Count non-alphanumeric, non-whitespace characters
    // But allow common markdown/code chars
    const allowedChars = /[a-zA-Z0-9\s]/;

    let noiseCount = 0;
    for (const char of text) {
      if (!allowedChars.test(char)) {
        noiseCount++;
      }
    }

    return noiseCount / text.length;
  }
}
