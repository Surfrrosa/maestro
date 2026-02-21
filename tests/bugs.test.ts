import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseSessionLogs } from '../src/utils/sessions.js';
import { trackBugs } from '../src/commands/bugs.js';

const TEST_DIR = join(process.cwd(), '.test-bugs-project');

function setupProject(files: Record<string, string>) {
  mkdirSync(TEST_DIR, { recursive: true });
  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(TEST_DIR, path);
    mkdirSync(join(fullPath, '..'), { recursive: true });
    writeFileSync(fullPath, content);
  }
}

describe('session log parser', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('parses session logs from directory', () => {
    setupProject({
      'docs/sessions/2026-02-15_session.md': `# Session: 2026-02-15

## Status: Complete

## Objectives
- Build auth system

## Accomplished
- Implemented JWT auth

## Key Decisions
-

## Files Modified
- src/auth.ts

## Known Issues Discovered
- Token expires too fast

## Next Session
- Fix token expiry
`,
    });

    const sessions = parseSessionLogs(TEST_DIR);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].date).toBe('2026-02-15');
    expect(sessions[0].status).toBe('Complete');
    expect(sessions[0].accomplished).toContain('Implemented JWT auth');
    expect(sessions[0].knownIssues).toContain('Token expires too fast');
  });

  it('returns empty for missing sessions dir', () => {
    setupProject({ 'README.md': '# Test' });
    const sessions = parseSessionLogs(TEST_DIR);
    expect(sessions).toHaveLength(0);
  });

  it('sorts sessions by date', () => {
    setupProject({
      'docs/sessions/2026-02-20_session.md': `# Session: 2026-02-20\n\n## Status: Complete\n\n## Objectives\n-\n\n## Accomplished\n-\n\n## Key Decisions\n-\n\n## Files Modified\n-\n\n## Known Issues Discovered\n-\n\n## Next Session\n-\n`,
      'docs/sessions/2026-02-15_session.md': `# Session: 2026-02-15\n\n## Status: Complete\n\n## Objectives\n-\n\n## Accomplished\n-\n\n## Key Decisions\n-\n\n## Files Modified\n-\n\n## Known Issues Discovered\n-\n\n## Next Session\n-\n`,
    });

    const sessions = parseSessionLogs(TEST_DIR);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].date).toBe('2026-02-15');
    expect(sessions[1].date).toBe('2026-02-20');
  });
});

describe('bug tracker', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('tracks open bugs from session logs', () => {
    setupProject({
      'docs/sessions/2026-02-15_session.md': `# Session: 2026-02-15\n\n## Status: Complete\n\n## Objectives\n-\n\n## Accomplished\n- Built login page\n\n## Key Decisions\n-\n\n## Files Modified\n-\n\n## Known Issues Discovered\n- Login fails on Safari\n\n## Next Session\n-\n`,
    });

    const sessions = parseSessionLogs(TEST_DIR);
    const bugs = trackBugs(sessions);
    expect(bugs).toHaveLength(1);
    expect(bugs[0].description).toBe('Login fails on Safari');
    expect(bugs[0].resolved).toBe(false);
  });

  it('marks bugs as resolved when accomplished', () => {
    setupProject({
      'docs/sessions/2026-02-15_session.md': `# Session: 2026-02-15\n\n## Status: Complete\n\n## Objectives\n-\n\n## Accomplished\n- Built login page\n\n## Key Decisions\n-\n\n## Files Modified\n-\n\n## Known Issues Discovered\n- Login fails on Safari\n\n## Next Session\n-\n`,
      'docs/sessions/2026-02-17_session.md': `# Session: 2026-02-17\n\n## Status: Complete\n\n## Objectives\n-\n\n## Accomplished\n- Fixed login fails on Safari\n\n## Key Decisions\n-\n\n## Files Modified\n-\n\n## Known Issues Discovered\n-\n\n## Next Session\n-\n`,
    });

    const sessions = parseSessionLogs(TEST_DIR);
    const bugs = trackBugs(sessions);
    expect(bugs).toHaveLength(1);
    expect(bugs[0].resolved).toBe(true);
    expect(bugs[0].resolvedDate).toBe('2026-02-17');
  });

  it('detects stale bugs (3+ sessions)', () => {
    setupProject({
      'docs/sessions/2026-02-10_session.md': `# Session: 2026-02-10\n\n## Status: Complete\n\n## Objectives\n-\n\n## Accomplished\n-\n\n## Key Decisions\n-\n\n## Files Modified\n-\n\n## Known Issues Discovered\n- Memory leak in dashboard\n\n## Next Session\n-\n`,
      'docs/sessions/2026-02-12_session.md': `# Session: 2026-02-12\n\n## Status: Complete\n\n## Objectives\n-\n\n## Accomplished\n-\n\n## Key Decisions\n-\n\n## Files Modified\n-\n\n## Known Issues Discovered\n- Memory leak in dashboard\n\n## Next Session\n-\n`,
      'docs/sessions/2026-02-14_session.md': `# Session: 2026-02-14\n\n## Status: Complete\n\n## Objectives\n-\n\n## Accomplished\n-\n\n## Key Decisions\n-\n\n## Files Modified\n-\n\n## Known Issues Discovered\n- Memory leak in dashboard\n\n## Next Session\n-\n`,
    });

    const sessions = parseSessionLogs(TEST_DIR);
    const bugs = trackBugs(sessions);
    const staleBugs = bugs.filter(b => !b.resolved && b.sessionCount >= 3);
    expect(staleBugs).toHaveLength(1);
    expect(staleBugs[0].sessionCount).toBe(3);
  });

  it('handles no issues gracefully', () => {
    setupProject({
      'docs/sessions/2026-02-15_session.md': `# Session: 2026-02-15\n\n## Status: Complete\n\n## Objectives\n-\n\n## Accomplished\n- Built feature\n\n## Key Decisions\n-\n\n## Files Modified\n-\n\n## Known Issues Discovered\n-\n\n## Next Session\n-\n`,
    });

    const sessions = parseSessionLogs(TEST_DIR);
    const bugs = trackBugs(sessions);
    expect(bugs).toHaveLength(0);
  });

  it('tracks multiple bugs independently', () => {
    setupProject({
      'docs/sessions/2026-02-15_session.md': `# Session: 2026-02-15\n\n## Status: Complete\n\n## Objectives\n-\n\n## Accomplished\n-\n\n## Key Decisions\n-\n\n## Files Modified\n-\n\n## Known Issues Discovered\n- Auth broken on mobile\n- CSS grid gap Firefox bug\n\n## Next Session\n-\n`,
      'docs/sessions/2026-02-17_session.md': `# Session: 2026-02-17\n\n## Status: Complete\n\n## Objectives\n-\n\n## Accomplished\n- Fixed CSS grid gap Firefox bug\n\n## Key Decisions\n-\n\n## Files Modified\n-\n\n## Known Issues Discovered\n-\n\n## Next Session\n-\n`,
    });

    const sessions = parseSessionLogs(TEST_DIR);
    const bugs = trackBugs(sessions);
    expect(bugs).toHaveLength(2);

    const authBug = bugs.find(b => b.description.includes('Auth'));
    const cssBug = bugs.find(b => b.description.includes('CSS'));
    expect(authBug?.resolved).toBe(false);
    expect(cssBug?.resolved).toBe(true);
  });
});
