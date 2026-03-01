import { describe, it, expect } from 'vitest';
import { generateGitignore } from '../src/templates/gitignore.js';

describe('generateGitignore', () => {
  it('includes node_modules for api-node projects', () => {
    const result = generateGitignore('api-node');
    expect(result).toContain('node_modules');
  });

  it('includes python ignores for api-python projects', () => {
    const result = generateGitignore('api-python');
    expect(result).toContain('__pycache__');
  });
});
