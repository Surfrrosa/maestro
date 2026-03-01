import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/utils/config.js';

describe('config utilities', () => {
  it('returns default config for nonexistent path', () => {
    const config = loadConfig('/nonexistent/path');
    expect(config.quality).toBeDefined();
    expect(config.quality.ignore).toEqual([]);
  });
});
