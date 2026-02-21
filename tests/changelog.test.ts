import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { generateChangelog } from '../src/commands/changelog.js';

const TEST_DIR = join(process.cwd(), '.test-changelog-project');

function setupProject(files: Record<string, string>) {
  mkdirSync(TEST_DIR, { recursive: true });
  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(TEST_DIR, path);
    mkdirSync(join(fullPath, '..'), { recursive: true });
    writeFileSync(fullPath, content);
  }
}

describe('changelog generator', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('extracts features from session logs', () => {
    setupProject({
      'docs/sessions/2026-02-15_session.md': `# Session: 2026-02-15\n\n## Status: Complete\n\n## Objectives\n-\n\n## Accomplished\n- Added user authentication\n- Implemented file upload\n\n## Key Decisions\n-\n\n## Files Modified\n-\n\n## Known Issues Discovered\n-\n\n## Next Session\n-\n`,
    });

    const { entries } = generateChangelog(TEST_DIR);
    const features = entries.filter(e => e.category === 'features');
    expect(features.length).toBeGreaterThanOrEqual(2);
  });

  it('categorizes fixes correctly', () => {
    setupProject({
      'docs/sessions/2026-02-15_session.md': `# Session: 2026-02-15\n\n## Status: Complete\n\n## Objectives\n-\n\n## Accomplished\n- Fixed login redirect loop\n- Resolved CSS alignment issue\n\n## Key Decisions\n-\n\n## Files Modified\n-\n\n## Known Issues Discovered\n-\n\n## Next Session\n-\n`,
    });

    const { entries } = generateChangelog(TEST_DIR);
    const fixes = entries.filter(e => e.category === 'fixes');
    expect(fixes.length).toBeGreaterThanOrEqual(2);
  });

  it('categorizes internal changes', () => {
    setupProject({
      'docs/sessions/2026-02-15_session.md': `# Session: 2026-02-15\n\n## Status: Complete\n\n## Objectives\n-\n\n## Accomplished\n- Refactored database queries\n- Updated test suite\n\n## Key Decisions\n-\n\n## Files Modified\n-\n\n## Known Issues Discovered\n-\n\n## Next Session\n-\n`,
    });

    const { entries } = generateChangelog(TEST_DIR);
    const internal = entries.filter(e => e.category === 'internal');
    expect(internal.length).toBeGreaterThanOrEqual(2);
  });

  it('filters by since date', () => {
    setupProject({
      'docs/sessions/2026-02-10_session.md': `# Session: 2026-02-10\n\n## Status: Complete\n\n## Objectives\n-\n\n## Accomplished\n- Added old feature\n\n## Key Decisions\n-\n\n## Files Modified\n-\n\n## Known Issues Discovered\n-\n\n## Next Session\n-\n`,
      'docs/sessions/2026-02-20_session.md': `# Session: 2026-02-20\n\n## Status: Complete\n\n## Objectives\n-\n\n## Accomplished\n- Added new feature\n\n## Key Decisions\n-\n\n## Files Modified\n-\n\n## Known Issues Discovered\n-\n\n## Next Session\n-\n`,
    });

    const { entries, sessionCount } = generateChangelog(TEST_DIR, '2026-02-15');
    expect(sessionCount).toBe(1);
    expect(entries.some(e => e.text.includes('new feature'))).toBe(true);
    expect(entries.some(e => e.text === 'Added old feature')).toBe(false);
  });

  it('returns empty for no session logs', () => {
    setupProject({ 'README.md': '# Test' });
    const { entries, sessionCount } = generateChangelog(TEST_DIR);
    expect(sessionCount).toBe(0);
    // May still have git log entries
    expect(Array.isArray(entries)).toBe(true);
  });

  it('deduplicates similar entries', () => {
    setupProject({
      'docs/sessions/2026-02-15_session.md': `# Session: 2026-02-15\n\n## Status: Complete\n\n## Objectives\n-\n\n## Accomplished\n- Added user authentication system\n\n## Key Decisions\n-\n\n## Files Modified\n-\n\n## Known Issues Discovered\n-\n\n## Next Session\n-\n`,
      'docs/sessions/2026-02-16_session.md': `# Session: 2026-02-16\n\n## Status: Complete\n\n## Objectives\n-\n\n## Accomplished\n- Added user authentication system\n\n## Key Decisions\n-\n\n## Files Modified\n-\n\n## Known Issues Discovered\n-\n\n## Next Session\n-\n`,
    });

    const { entries } = generateChangelog(TEST_DIR);
    const authEntries = entries.filter(e => e.text.includes('authentication'));
    expect(authEntries).toHaveLength(1);
  });
});
