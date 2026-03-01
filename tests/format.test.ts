import { describe, it, expect } from 'vitest';
import { palette, SYM, PASS, FAIL, WARN, banner, header, info, divider } from '../src/utils/format.js';

describe('format utilities', () => {
  it('palette has expected color keys', () => {
    expect(palette.ACCENT).toBeDefined();
    expect(palette.PASS_C).toBeDefined();
    expect(palette.FAIL_C).toBeDefined();
    expect(palette.WARN_C).toBeDefined();
    expect(palette.INFO_C).toBeDefined();
    expect(palette.DIM_C).toBeDefined();
  });

  it('SYM has expected symbol keys', () => {
    expect(SYM.pass).toBeDefined();
    expect(SYM.fail).toBeDefined();
    expect(SYM.warn).toBeDefined();
    expect(SYM.info).toBeDefined();
    expect(SYM.arrow).toBeDefined();
  });

  it('PASS, FAIL, WARN are strings', () => {
    expect(typeof PASS).toBe('string');
    expect(typeof FAIL).toBe('string');
    expect(typeof WARN).toBe('string');
  });

  it('banner returns a string', () => {
    expect(typeof banner()).toBe('string');
    expect(typeof banner('1.0.0')).toBe('string');
  });

  it('header returns a string', () => {
    expect(typeof header('test')).toBe('string');
  });

  it('info returns a string', () => {
    expect(typeof info('some info')).toBe('string');
  });

  it('divider returns a string', () => {
    expect(typeof divider()).toBe('string');
  });
});
