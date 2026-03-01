import { describe, it, expect } from 'vitest';
import { hooksCommand } from '../src/commands/hooks.js';

describe('hooks command', () => {
  it('hooksCommand is defined', () => {
    expect(hooksCommand).toBeDefined();
  });

  it('hooksCommand has the name hooks', () => {
    expect(hooksCommand.name()).toBe('hooks');
  });
});
