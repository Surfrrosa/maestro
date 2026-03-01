import { describe, it, expect } from 'vitest';
import { extractSection, parseSessionLogs } from '../src/utils/sessions.js';

describe('sessions utilities', () => {
  it('extractSection pulls items from a markdown section', () => {
    const content = '## Objectives\n- Task one\n- Task two\n\n## Next';
    const items = extractSection(content, 'Objectives');
    expect(items).toContain('Task one');
    expect(items).toContain('Task two');
    expect(items).toHaveLength(2);
  });

  it('extractSection returns empty array for missing section', () => {
    const content = '## Other\n- Something\n';
    const items = extractSection(content, 'Objectives');
    expect(items).toEqual([]);
  });

  it('parseSessionLogs returns empty array for nonexistent dir', () => {
    const logs = parseSessionLogs('/definitely/not/a/real/path');
    expect(logs).toEqual([]);
  });
});
