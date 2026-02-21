import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const TEST_DIR = join(process.cwd(), '.test-audit-project');
const MAESTRO_BIN = join(process.cwd(), 'dist', 'bin', 'maestro.js');

function runAudit(cwd: string, flags: string = ''): string {
  try {
    return execSync(`node ${MAESTRO_BIN} audit ${flags}`, { cwd, encoding: 'utf-8', timeout: 10000 });
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
      'CLAUDE.md': '# Project\n\nSome real content here.\n\n## Session Protocol\n\nRead the latest session log.\n\n## Running\n\nnpm run dev\n\n## Key Files\n\n| File | Purpose |\n|------|---------|',
    });
    const output = runAudit(TEST_DIR);
    expect(output).toContain('PASS');
    expect(output).toContain('CLAUDE.md exists');
  });

  it('checks CLAUDE.md content depth', () => {
    setupProject({
      'CLAUDE.md': '# Project\n## Session\n## Running\n## Key Files\n',
    });
    const output = runAudit(TEST_DIR);
    expect(output).toContain('FAIL');
    expect(output).toContain('minimal content');
  });

  it('detects session logs', () => {
    setupProject({
      'CLAUDE.md': '# P\n\nDescription text.\n\n## Session Protocol\n\nRead latest.\n\n## Running\n\nnpm dev\n\n## Key Files\n\n| File | Purpose |\n|------|---------|',
      'docs/sessions/README.md': '# Sessions\n| Date | Status | Summary |\n',
      'docs/sessions/2026-02-21_session.md': '# Session\n',
    });
    const output = runAudit(TEST_DIR);
    expect(output).toContain('PASS');
    expect(output).toContain('Session logs present');
    expect(output).toContain('Session index maintained');
  });

  it('shows weighted point values', () => {
    setupProject({});
    const output = runAudit(TEST_DIR);
    expect(output).toContain('[15pts]');
    expect(output).toContain('[10pts]');
    expect(output).toContain('[5pts]');
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

  it('scores a well-structured project at 100', () => {
    setupProject({
      'CLAUDE.md': '# Project\n\nA well-documented project with real content that spans multiple lines.\nThis project handles user authentication and data processing.\n\n## Session Protocol\n\nAlways read the latest session log in docs/sessions/ before starting work.\nWrite a session log before ending every session.\n\n## Running\n\n```bash\nnpm run dev\nnpm test\n```\n\n## Key Files\n\n| File | Purpose |\n|------|---------||\n| src/index.ts | Entry point |\n| src/auth.ts | Authentication |\n\n## Domain Rules\n\nNever hardcode API keys.\nAlways validate user input.\n',
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

  it('generates badge with --badge flag', () => {
    setupProject({
      'README.md': '# Test\n',
    });
    const output = runAudit(TEST_DIR, '--badge');
    expect(output).toContain('img.shields.io');
    expect(output).toContain('maestro');
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

  it('suggests maestro scan in output', () => {
    setupProject({
      'package.json': '{}',
    });
    const output = runAudit(TEST_DIR);
    expect(output).toContain('maestro scan');
  });
});
