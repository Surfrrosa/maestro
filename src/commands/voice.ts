import { Command } from 'commander';
import { input, select, checkbox } from '@inquirer/prompts';
import chalk from 'chalk';
import { join } from 'node:path';
import { confirm } from '@inquirer/prompts';
import { writeFile, fileExists } from '../utils/fs.js';
import { generateBrandVoice } from '../templates/brand-voice.js';

export const voiceCommand = new Command('voice')
  .description('Generate a brand voice document interactively')
  .action(async () => {
    const cwd = process.cwd();
    const outPath = join(cwd, 'docs', 'BRAND_VOICE.md');

    console.log(chalk.bold('\n  maestro voice\n'));
    console.log(chalk.dim('  Build your brand voice document.\n'));

    if (fileExists(outPath)) {
      const overwrite = await confirm({ message: '  docs/BRAND_VOICE.md already exists. Overwrite?', default: false });
      if (!overwrite) {
        console.log(chalk.dim('\n  Aborted.\n'));
        return;
      }
    }

    const audienceChoice = await select({
      message: 'Who is your audience?',
      choices: [
        { value: 'Developers and technical builders', name: 'Developers' },
        { value: 'Enterprise decision-makers and buyers', name: 'Enterprise buyers' },
        { value: 'General public, accessible to all', name: 'General public' },
        { value: 'Educated readers who are skeptical but open', name: 'Educated skeptics' },
        { value: 'custom', name: 'Custom (describe your own)' },
      ],
    });

    const audience = audienceChoice === 'custom'
      ? await input({ message: 'Describe your audience:' })
      : audienceChoice;

    const toneInput = await input({
      message: 'Describe your tone in 3-5 adjectives (comma-separated):',
      default: 'direct, grounded, opinionated',
    });
    const toneAdjectives = toneInput.split(',').map(t => t.trim()).filter(Boolean);

    const soundsLike = await input({
      message: 'What does your brand sound like? (one sentence)',
      default: 'A sharp friend who tells you the truth without softening it.',
    });

    const doesNotSoundLike = await input({
      message: 'What does your brand NOT sound like?',
      default: 'A corporate blog post or an AI chatbot trying to be helpful.',
    });

    const defaultBans = [
      'delve', 'navigate', 'leverage', 'at the end of the day',
      'in today\'s world', 'it\'s worth noting', 'game-changer',
      'deep dive', 'unpack', 'circle back',
    ];

    const bannedInput = await input({
      message: `Phrases to ban (comma-separated, defaults: ${defaultBans.slice(0, 4).join(', ')}...):`,
      default: defaultBans.join(', '),
    });
    const bannedPhrases = bannedInput.split(',').map(p => p.trim()).filter(Boolean);

    const formattingRules = await checkbox({
      message: 'Formatting rules:',
      choices: [
        { value: 'No emojis in any content', checked: true },
        { value: 'No em dashes (use commas, periods, or colons instead)', checked: true },
        { value: 'Use contractions (don\'t, won\'t, it\'s)', checked: true },
        { value: 'No exclamation marks', checked: false },
        { value: 'Sentence case for headings (not Title Case)', checked: false },
        { value: 'Active voice only', checked: false },
      ],
    });

    const frameworks = await input({
      message: 'What intellectual frameworks inform your work? (optional, press Enter to skip):',
      default: '',
    });

    writeFile(outPath, generateBrandVoice({
      audience,
      toneAdjectives,
      soundsLike,
      doesNotSoundLike,
      bannedPhrases,
      formattingRules,
      frameworks,
    }));

    console.log(chalk.green(`\n  Created: docs/BRAND_VOICE.md`));
    console.log(chalk.dim('  Review and expand the context-specific guidance sections.\n'));
  });
