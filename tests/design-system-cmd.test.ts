import { describe, it, expect } from 'vitest';
import { designSystemCommand } from '../src/commands/design-system.js';

describe('design-system command', () => {
  it('designSystemCommand is defined', () => {
    expect(designSystemCommand).toBeDefined();
  });

  it('designSystemCommand has the name design-system', () => {
    expect(designSystemCommand.name()).toBe('design-system');
  });
});
