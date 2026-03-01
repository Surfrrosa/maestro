import { describe, it, expect } from 'vitest';
import { DEFAULT_MAX_FILE_LINES, getStagedFiles, runReview } from '../src/commands/review-checks.js';

describe('review-checks', () => {
  it('DEFAULT_MAX_FILE_LINES is 300', () => {
    expect(DEFAULT_MAX_FILE_LINES).toBe(300);
  });

  it('getStagedFiles is a function', () => {
    expect(typeof getStagedFiles).toBe('function');
  });

  it('runReview is a function', () => {
    expect(typeof runReview).toBe('function');
  });
});
