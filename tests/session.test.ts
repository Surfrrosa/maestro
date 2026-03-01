import { describe, it, expect } from 'vitest';
import { sessionCommand } from '../src/commands/session.js';

describe('session command', () => {
  it('sessionCommand is defined', () => {
    expect(sessionCommand).toBeDefined();
  });

  it('sessionCommand has the name session', () => {
    expect(sessionCommand.name()).toBe('session');
  });
});
