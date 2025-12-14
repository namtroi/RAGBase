import { describe, it, expect, beforeEach } from 'vitest';
import { QualityGateService, QualityResult } from '../../../src/services/quality-gate-service';

describe('QualityGateService', () => {
  let gate: QualityGateService;

  beforeEach(() => {
    gate = new QualityGateService({
      minTextLength: 50,
      maxNoiseRatio: 0.5,
      rejectNoiseRatio: 0.8,
    });
  });

  describe('validate()', () => {
    describe('text length validation', () => {
      it('should pass text meeting minimum length', () => {
        const text = 'A'.repeat(50);
        const result = gate.validate(text);

        expect(result.passed).toBe(true);
        expect(result.warnings).toHaveLength(0);
      });

      it('should reject text below minimum length', () => {
        const text = 'A'.repeat(49);
        const result = gate.validate(text);

        expect(result.passed).toBe(false);
        expect(result.reason).toBe('TEXT_TOO_SHORT');
      });

      it('should reject empty text', () => {
        const result = gate.validate('');

        expect(result.passed).toBe(false);
        expect(result.reason).toBe('TEXT_TOO_SHORT');
      });

      it('should count actual characters, not whitespace', () => {
        const text = '   A   '.repeat(10); // 70 chars but only ~10 actual
        const result = gate.validate(text);

        // Should fail because actual content < 50
        expect(result.passed).toBe(false);
      });
    });

    describe('noise ratio validation', () => {
      it('should pass low noise content', () => {
        const text = 'This is clean text with normal punctuation. It reads well.';
        const result = gate.validate(text);

        expect(result.passed).toBe(true);
        expect(result.noiseRatio).toBeLessThan(0.5);
      });

      it('should warn on moderate noise', () => {
        // ~55% special chars
        const text = 'Text!!@@##$$%%^^&&**(){}[]' + 'A'.repeat(50);
        const result = gate.validate(text);

        expect(result.passed).toBe(true);
        expect(result.warnings).toContain('HIGH_NOISE_RATIO');
      });

      it('should reject high noise content', () => {
        // >80% special chars
        const text = '!!@@##$$%%^^&&**(){}[]:::;;;|||\\\\///' + 'AB';
        const result = gate.validate(text);

        expect(result.passed).toBe(false);
        expect(result.reason).toBe('EXCESSIVE_NOISE');
      });

      it('should calculate noise ratio correctly', () => {
        // "Hello!" = 6 chars, 1 non-alphanumeric (!) = 1/6 = 0.167
        const text = 'Hello!';
        const result = gate.validate(text);

        expect(result.noiseRatio).toBeCloseTo(0.167, 1);
      });
    });

    describe('edge cases', () => {
      it('should handle unicode text', () => {
        const text = 'Xin chao! Duc Thanh van ban tieng Viet day du noi dung.';
        const result = gate.validate(text);

        expect(result.passed).toBe(true);
      });

      it('should handle markdown formatting', () => {
        const text = '# Header\n\n**Bold** and _italic_ with [links](url)';
        const result = gate.validate(text);

        // Markdown special chars shouldn't count as noise
        expect(result.passed).toBe(true);
      });

      it('should handle code blocks', () => {
        const code = '```js\nconst x = 1; // comment\nfunction test() {}\n```';
        const result = gate.validate(code);

        // Code blocks have legitimate special chars
        expect(result.passed).toBe(true);
      });
    });
  });

  describe('calculateNoiseRatio()', () => {
    it('should return 0 for pure alphanumeric', () => {
      const ratio = gate.calculateNoiseRatio('HelloWorld123');
      expect(ratio).toBe(0);
    });

    it('should return ratio of non-alphanumeric chars', () => {
      // "a!b@c" = 5 chars, 2 non-alphanum = 0.4
      const ratio = gate.calculateNoiseRatio('a!b@c');
      expect(ratio).toBe(0.4);
    });

    it('should handle empty string', () => {
      const ratio = gate.calculateNoiseRatio('');
      expect(ratio).toBe(0);
    });

    it('should ignore spaces in noise calculation', () => {
      // Spaces are not noise, only special chars
      const ratio = gate.calculateNoiseRatio('hello world');
      expect(ratio).toBeCloseTo(0.09, 1); // 1 space / 11 chars
    });
  });
});
