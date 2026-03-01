import { describe, it, expect } from 'vitest';
import { generateEnvExample } from '../src/templates/env-example.js';

describe('generateEnvExample', () => {
  it('generates env example content containing ENVIRONMENT', () => {
    const result = generateEnvExample({
      aiProvider: 'none',
      database: 'none',
      deployTarget: 'local',
    });
    expect(result).toContain('ENVIRONMENT');
  });

  it('includes AI provider vars when specified', () => {
    const result = generateEnvExample({
      aiProvider: 'anthropic',
      database: 'none',
      deployTarget: 'local',
    });
    expect(result).toContain('ANTHROPIC_API_KEY');
  });
});
