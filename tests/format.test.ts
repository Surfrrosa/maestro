import { describe, it, expect } from 'vitest';
import { palette, SYM, PASS, FAIL, WARN, banner, header, info, divider, scoreColor, formatLocation } from '../src/utils/format.js';

describe('format utilities', () => {
  it('palette has hex color values', () => {
    expect(palette.ACCENT).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(palette.PASS_C).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(palette.FAIL_C).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('PASS/FAIL/WARN symbols contain expected characters', () => {
    expect(PASS).toContain('\u2713');
    expect(FAIL).toContain('\u2717');
    expect(WARN).toContain('\u25B3');
  });

  it('banner includes version when provided', () => {
    expect(banner('1.0.0')).toContain('1.0.0');
  });

  it('header wraps maestro commands with commandHeader format', () => {
    const h = header('maestro audit');
    expect(h).toContain('maestro');
    expect(h).toContain('audit');
  });

  it('info returns dimmed text', () => {
    expect(info('hello')).toContain('hello');
  });

  it('divider returns a horizontal line', () => {
    expect(divider()).toContain('\u2500');
  });

  it('formatLocation includes line number when provided', () => {
    expect(formatLocation('src/app.ts', 42)).toBe('src/app.ts:42');
    expect(formatLocation('src/app.ts')).toBe('src/app.ts');
  });
});
