import { FIXTURES, readFixtureText } from '@tests/helpers/fixtures.js';
import { describe, expect, it } from 'vitest';

describe('Fixture Helpers', () => {
  it('should read JSON fixture', async () => {
    const content = await readFixtureText(FIXTURES.json.valid);
    const data = JSON.parse(content);
    
    expect(data.title).toBe('Test Document');
    expect(data.content).toContain('valid JSON content');
  });

  it('should read text fixture', async () => {
    const content = await readFixtureText(FIXTURES.text.normal);
    
    expect(content).toContain('normal text file');
    expect(content.length).toBeGreaterThan(50);
  });

  it('should read markdown fixture', async () => {
    const content = await readFixtureText(FIXTURES.markdown.withHeaders);
    
    expect(content).toContain('# Main Title');
    expect(content).toContain('## Section One');
  });

  it('should read unicode fixture', async () => {
    const content = await readFixtureText(FIXTURES.text.unicode);
    
    expect(content).toContain('🚀');
    expect(content).toContain('café');
    expect(content).toContain('你好世界');
  });

  it('should read empty fixture', async () => {
    const content = await readFixtureText(FIXTURES.text.empty);
    
    expect(content).toBe('');
  });
});
