import { describe, it, expect } from 'vitest';
import { initCommand } from '../src/commands/init.js';

describe('init command', () => {
  it('initCommand is defined', () => {
    expect(initCommand).toBeDefined();
  });

  it('initCommand has the name init', () => {
    expect(initCommand.name()).toBe('init');
  });
});
