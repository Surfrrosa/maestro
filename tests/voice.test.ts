import { describe, it, expect } from 'vitest';
import { voiceCommand } from '../src/commands/voice.js';

describe('voice command', () => {
  it('voiceCommand is defined', () => {
    expect(voiceCommand).toBeDefined();
  });

  it('voiceCommand has the name voice', () => {
    expect(voiceCommand.name()).toBe('voice');
  });
});
