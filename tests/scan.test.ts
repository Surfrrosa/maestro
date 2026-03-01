import { describe, it, expect } from 'vitest';
import { scanCommand } from '../src/commands/scan.js';

describe('scan command', () => {
  it('scanCommand is defined', () => {
    expect(scanCommand).toBeDefined();
  });

  it('scanCommand has the name scan', () => {
    expect(scanCommand.name()).toBe('scan');
  });
});
