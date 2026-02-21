import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { runSecurityScan } from '../src/commands/security.js';

const TEST_DIR = join(process.cwd(), '.test-security-project');

function setupProject(files: Record<string, string>) {
  mkdirSync(TEST_DIR, { recursive: true });
  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(TEST_DIR, path);
    mkdirSync(join(fullPath, '..'), { recursive: true });
    writeFileSync(fullPath, content);
  }
}

describe('security scanner', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('detects hardcoded API key', async () => {
    setupProject({
      'src/config.ts': 'const apiKey = "sk-1234567890abcdefghijklmnopqrstuvwxyz";\n',
    });
    const findings = await runSecurityScan(TEST_DIR);
    expect(findings.some(f => f.category === 'secrets')).toBe(true);
  });

  it('detects AWS access key', async () => {
    setupProject({
      'src/aws.ts': 'const key = "AKIAIOSFODNN7EXAMPLE";\n',
    });
    const findings = await runSecurityScan(TEST_DIR);
    expect(findings.some(f => f.message.includes('AWS'))).toBe(true);
  });

  it('detects private key', async () => {
    setupProject({
      'src/cert.ts': 'const key = "-----BEGIN RSA PRIVATE KEY-----";\n',
    });
    const findings = await runSecurityScan(TEST_DIR);
    expect(findings.some(f => f.message.includes('Private key'))).toBe(true);
  });

  it('skips placeholders', async () => {
    setupProject({
      'src/config.ts': 'const apiKey = "your_key_here";\n',
    });
    const findings = await runSecurityScan(TEST_DIR);
    expect(findings.filter(f => f.category === 'secrets')).toHaveLength(0);
  });

  it('detects env var not in .env.example', async () => {
    setupProject({
      '.env.example': 'API_KEY=your_value_here\n',
      'src/app.ts': 'const url = process.env.DATABASE_URL;\n',
    });
    const findings = await runSecurityScan(TEST_DIR);
    expect(findings.some(f => f.category === 'env-leak' && f.message.includes('DATABASE_URL'))).toBe(true);
  });

  it('passes when env vars are documented', async () => {
    setupProject({
      '.env.example': 'DATABASE_URL=your_value_here\n',
      'src/app.ts': 'const url = process.env.DATABASE_URL;\n',
    });
    const findings = await runSecurityScan(TEST_DIR);
    expect(findings.filter(f => f.category === 'env-leak')).toHaveLength(0);
  });

  it('detects eval usage', async () => {
    setupProject({
      'src/danger.ts': 'const result = eval(userInput);\n',
    });
    const findings = await runSecurityScan(TEST_DIR);
    expect(findings.some(f => f.category === 'unsafe-exec')).toBe(true);
  });

  it('clean project has no findings', async () => {
    setupProject({
      'src/app.ts': 'export function hello() { return "world"; }\n',
    });
    const findings = await runSecurityScan(TEST_DIR);
    expect(findings).toHaveLength(0);
  });
});
