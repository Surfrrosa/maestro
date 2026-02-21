import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const TEST_DIR = join(process.cwd(), '.test-check-project');
const MAESTRO_BIN = join(process.cwd(), 'dist', 'bin', 'maestro.js');

function runCheck(cwd: string, flags: string = ''): { stdout: string; exitCode: number } {
  try {
    const stdout = execSync(`node ${MAESTRO_BIN} check ${flags}`, { cwd, encoding: 'utf-8', timeout: 10000 });
    return { stdout, exitCode: 0 };
  } catch (e: unknown) {
    const error = e as { stdout?: string; stderr?: string; status?: number };
    return { stdout: error.stdout || error.stderr || '', exitCode: error.status || 1 };
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

describe('check command', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('fails on empty directory', () => {
    setupProject({});
    const { stdout } = runCheck(TEST_DIR);
    expect(stdout).toContain('FAIL');
    expect(stdout).toContain('CLAUDE.md');
    expect(stdout).toContain('Session blocked');
  });

  it('passes with CLAUDE.md and session logs', () => {
    setupProject({
      'CLAUDE.md': '# Project\n',
      'docs/sessions/2026-02-21_session.md': '# Session\n',
      '.gitignore': 'node_modules\n',
      'README.md': '# Test\n',
    });
    const { stdout } = runCheck(TEST_DIR);
    expect(stdout).toContain('PASS');
    expect(stdout).toContain('Ready to work');
  });

  it('warns on blocked session status', () => {
    setupProject({
      'CLAUDE.md': '# Project\n',
      'docs/sessions/2026-02-21_session.md': '# Session\n\n## Status: Blocked\n',
    });
    const { stdout } = runCheck(TEST_DIR);
    expect(stdout).toContain('WARN');
    expect(stdout).toContain('Blocked');
  });

  it('warns on known issues', () => {
    setupProject({
      'CLAUDE.md': '# Project\n',
      'docs/sessions/2026-02-21_session.md': '# Session\n\n## Status: In Progress\n\n## Known Issues Discovered\n- Auth token expiring too fast\n',
    });
    const { stdout } = runCheck(TEST_DIR);
    expect(stdout).toContain('WARN');
    expect(stdout).toContain('issue(s)');
  });

  it('hook mode exits 1 on blocking failure', () => {
    setupProject({});
    const { stdout, exitCode } = runCheck(TEST_DIR, '--hook');
    expect(exitCode).not.toBe(0);
    expect(stdout).toContain('FAIL');
  });

  it('hook mode exits 0 when passing', () => {
    setupProject({
      'CLAUDE.md': '# Project\n',
      'docs/sessions/2026-02-21_session.md': '# Session\n',
      '.gitignore': 'node_modules\n',
      'README.md': '# Test\n',
    });
    const { stdout, exitCode } = runCheck(TEST_DIR, '--hook');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('OK');
  });
});
