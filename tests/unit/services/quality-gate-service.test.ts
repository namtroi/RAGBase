import { describe, it, expect, beforeEach } from 'vitest';
import { QualityGateService, QualityResult } from '@/services/quality-gate-service';

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
        const text = 'This is clean text with normal punctuation and enough content to meet the minimum length requirement.';
        const result = gate.validate(text);

        expect(result.passed).toBe(true);
        expect(result.noiseRatio).toBeLessThan(0.5);
      });

      it('should warn on moderate noise', () => {
        // Create text with >50% but <80% special chars to trigger warning
        const specialChars = '!!@@##$$%%^^&&**(){}[]::;;||\\\\//'; // 32 special chars
        const normalText = 'A'.repeat(30); // 30 normal chars
        const text = specialChars + normalText; // 32/62 = 51.6% noise
        const result = gate.validate(text);

        expect(result.passed).toBe(true);
        expect(result.warnings).toContain('HIGH_NOISE_RATIO');
        expect(result.noiseRatio).toBeGreaterThan(0.5);
        expect(result.noiseRatio).toBeLessThan(0.8);
      });

      it('should reject high noise content', () => {
        // Create text with >80% special chars: 50 special chars + 10 normal = 50/60 = 83.3% noise
        const specialChars = '!!@@##$$%%^^&&**(){}[]:::;;;|||\\\\///!!@@##$$%%^^&&**';
        const normalText = 'ABCDEFGHIJ';
        const text = specialChars + normalText;
        const result = gate.validate(text);

        expect(result.passed).toBe(false);
        expect(result.reason).toBe('EXCESSIVE_NOISE');
      });

      it('should calculate noise ratio correctly', () => {
        // Text with known noise ratio: 5 special chars (! . , . !) in 100 total chars = 5%
        const text = 'Hello! This is a test sentence with some punctuation, but mostly normal text to meet minimum length.';
        const result = gate.validate(text);

        expect(result.passed).toBe(true);
        expect(result.noiseRatio).toBeGreaterThan(0);
        expect(result.noiseRatio).toBeLessThan(0.1); // Low noise
      });
    });

    describe('edge cases', () => {
      it('should handle unicode text', () => {
        const text = 'Xin chao! Duc Thanh van ban tieng Viet day du noi dung va them noi dung de dat yeu cau toi thieu.';
        const result = gate.validate(text);

        expect(result.passed).toBe(true);
      });

      it('should handle markdown formatting', () => {
        const text = '# Header\n\n**Bold** and _italic_ with [links](url) and more content to meet minimum length requirement';
        const result = gate.validate(text);

        // Markdown has special chars but should still pass if under threshold
        expect(result.passed).toBe(true);
        // It will have some noise from markdown syntax
        expect(result.noiseRatio).toBeGreaterThan(0);
        expect(result.noiseRatio).toBeLessThan(0.8); // Under reject threshold
      });

      it('should handle code blocks', () => {
        const code = '```js\nconst x = 1; // comment\nfunction test() {}\nconsole.log("hello world");\n```\nMore descriptive text here';
        const result = gate.validate(code);

        // Code blocks have legitimate special chars
        expect(result.passed).toBe(true);
        expect(result.noiseRatio).toBeGreaterThan(0);
        expect(result.noiseRatio).toBeLessThan(0.8); // Under reject threshold
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
      expect(ratio).toBe(0); // Spaces are allowed chars, not noise
    });
  });
});
