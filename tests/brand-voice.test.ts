import { describe, it, expect } from 'vitest';
import { generateBrandVoice } from '../src/templates/brand-voice.js';

describe('generateBrandVoice', () => {
  it('generates brand voice content containing the audience', () => {
    const result = generateBrandVoice({
      audience: 'Devs',
      toneAdjectives: ['direct'],
      soundsLike: 'friend',
      doesNotSoundLike: 'corp',
      bannedPhrases: ['delve'],
      formattingRules: ['No emojis'],
      frameworks: '',
    });
    expect(result).toContain('Devs');
  });

  it('includes banned phrases in the output', () => {
    const result = generateBrandVoice({
      audience: 'Devs',
      toneAdjectives: ['direct'],
      soundsLike: 'friend',
      doesNotSoundLike: 'corp',
      bannedPhrases: ['delve'],
      formattingRules: ['No emojis'],
      frameworks: '',
    });
    expect(result).toContain('delve');
  });
});
