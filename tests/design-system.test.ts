import { describe, it, expect } from 'vitest';
import { generateDesignSystem } from '../src/templates/design-system.js';

describe('generateDesignSystem', () => {
  it('returns a string', () => {
    const result = generateDesignSystem({
      brandName: 'Test',
      colorMode: 'light',
      colors: [{ name: 'Bg', hex: '#FFF', usage: 'bg' }],
      displayFont: 'Inter',
      bodyFont: 'Inter',
      principles: [],
    });
    expect(typeof result).toBe('string');
  });

  it('includes the brand name in the output', () => {
    const result = generateDesignSystem({
      brandName: 'Test',
      colorMode: 'light',
      colors: [{ name: 'Bg', hex: '#FFF', usage: 'bg' }],
      displayFont: 'Inter',
      bodyFont: 'Inter',
      principles: [],
    });
    expect(result).toContain('Test');
  });
});
