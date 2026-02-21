import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const TEST_DIR = join(process.cwd(), '.test-audit-project');
const MAESTRO_BIN = join(process.cwd(), 'dist', 'bin', 'maestro.js');

function runAudit(cwd: string): string {
  try {
    return execSync(`node ${MAESTRO_BIN} audit`, { cwd, encoding: 'utf-8', timeout: 10000 });
  } catch (e: unknown) {
    const error = e as { stdout?: string; stderr?: string };
    return error.stdout || error.stderr || '';
  }
}

function setupProject(files: Record<string, string>) {
  mkdirSync(TEST_DIR, { recursive: true });
  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(TEST_DIR, path);
    mkdirSync(join(fullPath, '..'), { recursive: true });
    writeFileSync(fullPath, content);
  }
}

describe('audit command', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('scores an empty directory low', () => {
    setupProject({});
    const output = runAudit(TEST_DIR);
    expect(output).toContain('FAIL');
    expect(output).toContain('CLAUDE.md');
  });

  it('detects CLAUDE.md presence', () => {
    setupProject({
      'CLAUDE.md': '# Project\n## Session Protocol\n## Running\n## Key Files\n',
    });
    const output = runAudit(TEST_DIR);
    expect(output).toContain('PASS');
    expect(output).toContain('CLAUDE.md exists');
    expect(output).toContain('CLAUDE.md has required sections');
  });

  it('detects session logs', () => {
    setupProject({
      'CLAUDE.md': '# P\n## Session\n## Running\n## Key Files',
      'docs/sessions/README.md': '# Sessions\n| Date | Status | Summary |\n',
      'docs/sessions/2026-02-21_session.md': '# Session\n',
    });
    const output = runAudit(TEST_DIR);
    expect(output).toContain('PASS');
    expect(output).toContain('Session logs present');
    expect(output).toContain('Session index maintained');
  });

  it('detects unpinned npm dependencies', () => {
    setupProject({
      'package.json': JSON.stringify({
        dependencies: { chalk: '^5.3.0' },
      }),
    });
    const output = runAudit(TEST_DIR);
    expect(output).toContain('FAIL');
    expect(output).toContain('Dependency pinning');
    expect(output).toContain('chalk');
  });

  it('passes pinned npm dependencies', () => {
    setupProject({
      'package.json': JSON.stringify({
        dependencies: { chalk: '5.3.0' },
      }),
    });
    const output = runAudit(TEST_DIR);
    expect(output).toContain('PASS');
    expect(output).toContain('Dependency pinning');
  });

  it('detects unpinned python dependencies', () => {
    setupProject({
      'requirements.txt': 'flask>=2.0.0\nrequests\n',
    });
    const output = runAudit(TEST_DIR);
    expect(output).toContain('FAIL');
    expect(output).toContain('Dependency pinning');
  });

  it('detects missing .gitignore entries', () => {
    setupProject({
      'package.json': '{}',
      '.gitignore': '.env\n',
    });
    const output = runAudit(TEST_DIR);
    expect(output).toContain('FAIL');
    expect(output).toContain('node_modules');
  });

  it('scores a well-structured project high', () => {
    setupProject({
      'CLAUDE.md': '# P\n## Session Protocol\n## Running\n## Key Files',
      'README.md': '# Project\n',
      '.gitignore': 'node_modules\n.env\n.DS_Store\n',
      '.env.example': 'KEY=value\n',
      'package.json': JSON.stringify({ dependencies: { chalk: '5.3.0' } }),
      'docs/sessions/README.md': '# Sessions\n',
      'docs/sessions/2026-02-21_session.md': '# Session\n',
      'docs/ARCHITECTURE.md': '# Arch\n',
      'docs/SECURITY_CHECKLIST.md': '# Security\n',
      'tests/example.test.ts': 'test("works", () => {})\n',
    });
    const output = runAudit(TEST_DIR);
    expect(output).toContain('100/100');
  });

  it('offers --fix for fixable issues', () => {
    setupProject({
      'package.json': '{}',
    });
    const output = runAudit(TEST_DIR);
    expect(output).toContain('maestro audit --fix');
  });

  it('applies fixes with --fix flag', () => {
    setupProject({
      'package.json': '{}',
    });
    try {
      execSync(`node ${MAESTRO_BIN} audit --fix`, { cwd: TEST_DIR, encoding: 'utf-8', timeout: 10000 });
    } catch {
      // May exit non-zero
    }
    expect(existsSync(join(TEST_DIR, 'CLAUDE.md'))).toBe(true);
    expect(existsSync(join(TEST_DIR, 'docs', 'sessions', 'README.md'))).toBe(true);
  });
});
