import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { runReview } from '../src/commands/review.js';

const TEST_DIR = join(process.cwd(), '.test-review-project');

function setupGitProject(files: Record<string, string>, stagedFiles?: string[]) {
  mkdirSync(TEST_DIR, { recursive: true });

  // Init git repo
  execSync('git init', { cwd: TEST_DIR, stdio: 'ignore' });
  execSync('git config user.email "test@test.com"', { cwd: TEST_DIR, stdio: 'ignore' });
  execSync('git config user.name "Test"', { cwd: TEST_DIR, stdio: 'ignore' });

  // Create initial commit
  writeFileSync(join(TEST_DIR, '.gitkeep'), '');
  execSync('git add .gitkeep', { cwd: TEST_DIR, stdio: 'ignore' });
  execSync('git commit -m "init"', { cwd: TEST_DIR, stdio: 'ignore' });

  // Create files
  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(TEST_DIR, path);
    mkdirSync(join(fullPath, '..'), { recursive: true });
    writeFileSync(fullPath, content);
  }

  // Stage specified files or all
  if (stagedFiles) {
    for (const file of stagedFiles) {
      execSync(`git add "${file}"`, { cwd: TEST_DIR, stdio: 'ignore' });
    }
  } else {
    execSync('git add -A', { cwd: TEST_DIR, stdio: 'ignore' });
  }
}

describe('review command', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('returns empty for no staged files', () => {
    mkdirSync(TEST_DIR, { recursive: true });
    execSync('git init', { cwd: TEST_DIR, stdio: 'ignore' });
    execSync('git config user.email "test@test.com"', { cwd: TEST_DIR, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: TEST_DIR, stdio: 'ignore' });
    writeFileSync(join(TEST_DIR, '.gitkeep'), '');
    execSync('git add .gitkeep && git commit -m "init"', { cwd: TEST_DIR, stdio: 'ignore' });

    const findings = runReview(TEST_DIR);
    expect(findings).toHaveLength(0);
  });

  it('detects debug statements in staged changes', () => {
    setupGitProject({
      'src/app.ts': 'console.log("debug");\nexport const x = 1;\n',
    });

    const findings = runReview(TEST_DIR);
    const debugFinding = findings.find(f => f.check === 'Debug statements');
    expect(debugFinding?.status).toBe('warn');
  });

  it('detects TODO comments in staged changes', () => {
    setupGitProject({
      'src/app.ts': '// TODO: fix this later\nexport const x = 1;\n',
    });

    const findings = runReview(TEST_DIR);
    const todoFinding = findings.find(f => f.check === 'TODOs added');
    expect(todoFinding?.status).toBe('warn');
  });

  it('detects hardcoded secrets in staged files', () => {
    setupGitProject({
      'src/config.ts': 'const key = "sk-1234567890abcdefghijklmnopqrstuvwxyz";\n',
    });

    const findings = runReview(TEST_DIR);
    const secretFinding = findings.find(f => f.check === 'Hardcoded secrets');
    expect(secretFinding?.status).toBe('fail');
  });

  it('passes clean staged files', () => {
    setupGitProject({
      'src/app.ts': 'export function hello() { return "world"; }\n',
      'tests/app.test.ts': 'test("works", () => {});\n',
    });

    const findings = runReview(TEST_DIR);
    const allPass = findings.every(f => f.status === 'pass');
    expect(allPass).toBe(true);
  });

  it('warns on source files without test files', () => {
    setupGitProject({
      'src/app.ts': 'export function hello() { return "world"; }\n',
    });

    const findings = runReview(TEST_DIR);
    const testFinding = findings.find(f => f.check === 'Test coverage');
    expect(testFinding?.status).toBe('warn');
  });

  it('detects large files (>300 lines)', () => {
    const bigFile = Array(350).fill('export const x = 1;').join('\n');
    setupGitProject({
      'src/big.ts': bigFile,
    });

    const findings = runReview(TEST_DIR);
    const sizeFinding = findings.find(f => f.check === 'File size');
    expect(sizeFinding?.status).toBe('warn');
  });
});
