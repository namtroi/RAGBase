import { readFile } from 'fs/promises';
import path from 'path';

const FIXTURES_DIR = path.join(__dirname, '..');

export async function readFixture(relativePath: string): Promise<Buffer> {
  const fullPath = path.join(FIXTURES_DIR, relativePath);
  return readFile(fullPath);
}

export async function readFixtureText(relativePath: string): Promise<string> {
  const buffer = await readFixture(relativePath);
  return buffer.toString('utf-8');
}

export async function getExpected(name: string): Promise<string> {
  return readFixtureText(`expected/${name}`);
}

// File info for upload tests
export function getFixturePath(relativePath: string): string {
  return path.join(FIXTURES_DIR, relativePath);
}

export const FIXTURES = {
  pdf: {
    digital: 'fixtures/pdfs/simple-digital.pdf',
    multiPage: 'fixtures/pdfs/multi-page.pdf',
    passwordProtected: 'fixtures/pdfs/password-protected.pdf',
    scanned: 'fixtures/pdfs/scanned-image.pdf',
    corrupt: 'fixtures/pdfs/corrupt.pdf',
  },
  json: {
    valid: 'fixtures/json/valid.json',
    malformed: 'fixtures/json/malformed.json',
  },
  text: {
    normal: 'fixtures/text/normal.txt',
    unicode: 'fixtures/text/unicode.txt',
    empty: 'fixtures/text/empty.txt',
  },
  markdown: {
    withHeaders: 'fixtures/markdown/with-headers.md',
    codeBlocks: 'fixtures/markdown/code-blocks.md',
  },
} as const;
