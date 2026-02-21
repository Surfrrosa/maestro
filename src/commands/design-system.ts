import { Command } from 'commander';
import { input, select, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { join } from 'node:path';
import { writeFile, fileExists } from '../utils/fs.js';
import { generateDesignSystem } from '../templates/design-system.js';

export const designSystemCommand = new Command('design-system')
  .description('Generate a design system document interactively')
  .action(async () => {
    const cwd = process.cwd();
    const outPath = join(cwd, 'docs', 'DESIGN_SYSTEM.md');

    console.log(chalk.bold('\n  maestro design-system\n'));
    console.log(chalk.dim('  Build your design system document.\n'));

    if (fileExists(outPath)) {
      const overwrite = await confirm({ message: '  docs/DESIGN_SYSTEM.md already exists. Overwrite?', default: false });
      if (!overwrite) {
        console.log(chalk.dim('\n  Aborted.\n'));
        return;
      }
    }

    const brandName = await input({
      message: 'Brand / project name:',
      default: process.cwd().split('/').pop() || 'Project',
    });

    const colorMode = await select({
      message: 'Color mode:',
      choices: [
        { value: 'dark', name: 'Dark mode' },
        { value: 'light', name: 'Light mode' },
        { value: 'both', name: 'Both' },
      ],
    });

    const colors: Array<{ name: string; hex: string; usage: string }> = [];

    // Background
    const bgColor = await input({
      message: 'Primary background color (hex):',
      default: colorMode === 'dark' ? '#1A1A1A' : '#FFFFFF',
    });
    colors.push({ name: 'Background', hex: bgColor, usage: 'Page and card backgrounds' });

    // Accent
    const accentColor = await input({
      message: 'Primary accent color (hex):',
      default: '#4A0E0E',
    });
    colors.push({ name: 'Accent', hex: accentColor, usage: 'Buttons, links, key interactive elements' });

    // Text
    const textColor = await input({
      message: 'Text color (hex):',
      default: colorMode === 'dark' ? '#E8E4DF' : '#1A1A1A',
    });
    colors.push({ name: 'Text', hex: textColor, usage: 'Body text, headings' });

    // Optional additional colors
    const addMore = await confirm({ message: 'Add more colors?', default: true });
    if (addMore) {
      const moreCount = await select({
        message: 'How many additional colors?',
        choices: [
          { value: 1, name: '1' },
          { value: 2, name: '2' },
          { value: 3, name: '3' },
        ],
      });

      for (let i = 0; i < moreCount; i++) {
        const name = await input({ message: `Color ${i + 1} name:` });
        const hex = await input({ message: `Color ${i + 1} hex:` });
        const usage = await input({ message: `Color ${i + 1} usage:` });
        colors.push({ name, hex, usage });
      }
    }

    // Typography
    const displayFont = await select({
      message: 'Display / heading font:',
      choices: [
        { value: 'Bodoni Moda', name: 'Bodoni Moda (elegant, editorial)' },
        { value: 'Playfair Display', name: 'Playfair Display (classic serif)' },
        { value: 'Space Grotesk', name: 'Space Grotesk (modern geometric)' },
        { value: 'Inter', name: 'Inter (clean sans-serif)' },
        { value: 'Archivo Black', name: 'Archivo Black (bold, brutalist)' },
        { value: 'custom', name: 'Custom (type your own)' },
      ],
    });
    const finalDisplayFont = displayFont === 'custom'
      ? await input({ message: 'Display font name:' })
      : displayFont;

    const bodyFont = await select({
      message: 'Body text font:',
      choices: [
        { value: 'Cormorant Garamond', name: 'Cormorant Garamond (literary serif)' },
        { value: 'Source Serif Pro', name: 'Source Serif Pro (readable serif)' },
        { value: 'IBM Plex Sans', name: 'IBM Plex Sans (technical sans)' },
        { value: 'Space Grotesk', name: 'Space Grotesk (geometric sans)' },
        { value: 'Inter', name: 'Inter (clean, universal)' },
        { value: 'custom', name: 'Custom (type your own)' },
      ],
    });
    const finalBodyFont = bodyFont === 'custom'
      ? await input({ message: 'Body font name:' })
      : bodyFont;

    // Principles
    const principlesInput = await input({
      message: 'Design principles (comma-separated, 3-5 short phrases):',
      default: 'Restraint Is Power, Mobile-First, Consistency Over Flair',
    });
    const principles = principlesInput.split(',').map(p => p.trim()).filter(Boolean);

    writeFile(outPath, generateDesignSystem({
      brandName,
      colorMode,
      colors,
      displayFont: finalDisplayFont,
      bodyFont: finalBodyFont,
      principles,
    }));

    console.log(chalk.green(`\n  Created: docs/DESIGN_SYSTEM.md`));
    console.log(chalk.dim('  Review and expand the component patterns and principles.\n'));
  });
