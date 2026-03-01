import { describe, it, expect } from 'vitest';
import { generateArchitecture } from '../src/templates/architecture.js';

describe('generateArchitecture', () => {
  it('generates architecture doc containing Architecture in the heading', () => {
    const result = generateArchitecture('test', 'A test');
    expect(result).toContain('Architecture');
  });

  it('includes the project description', () => {
    const result = generateArchitecture('test', 'A test');
    expect(result).toContain('A test');
  });
});
