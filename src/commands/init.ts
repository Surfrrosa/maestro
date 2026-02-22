import { Command } from 'commander';
import { select, input, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { join } from 'node:path';
import { writeFile, ensureDir, today, fileExists } from '../utils/fs.js';
import { generateClaudeMd, type ProjectType } from '../templates/claude-md.js';
import { generateSessionLog } from '../templates/session-log.js';
import { generateSessionIndex } from '../templates/session-index.js';
import { generateEnvExample } from '../templates/env-example.js';
import { generateGitignore } from '../templates/gitignore.js';
import { generateReadme } from '../templates/readme.js';
import { generateArchitecture } from '../templates/architecture.js';
import { generateSecurityChecklist } from '../templates/security.js';

export const initCommand = new Command('init')
  .description('Scaffold a new AI-native project with instruction files, session logs, and checklists')
  .argument('[directory]', 'Target directory (defaults to current directory)')
  .action(async (directory?: string) => {
    const cwd = directory ? join(process.cwd(), directory) : process.cwd();

    const { commandHeader, SYM: sym, successBanner: sb, hint: fmtHint } = await import('../utils/format.js');
    console.log(commandHeader('init'));
    console.log(chalk.dim('  Setting up an AI-native project.\n'));

    if (fileExists(join(cwd, 'CLAUDE.md'))) {
      console.log(chalk.yellow('  CLAUDE.md already exists in this directory.'));
      const overwrite = await confirm({ message: '  Overwrite existing files?', default: false });
      if (!overwrite) {
        console.log(chalk.dim('\n  Aborted.\n'));
        return;
      }
    }

    const projectName = await input({
      message: 'Project name:',
      default: cwd.split('/').pop() || 'my-project',
    });

    const projectType = await select<ProjectType>({
      message: 'Project type:',
      choices: [
        { value: 'api-python', name: 'API - Python (FastAPI)' },
        { value: 'api-node', name: 'API - Node.js (Express)' },
        { value: 'frontend-next', name: 'Frontend - Next.js' },
        { value: 'frontend-static', name: 'Frontend - Static HTML/CSS/JS' },
        { value: 'mobile-react-native', name: 'Mobile - React Native (Expo)' },
        { value: 'data-pipeline', name: 'Data Pipeline - Python' },
        { value: 'cli-tool', name: 'CLI Tool - Node.js' },
      ],
    });

    const description = await input({
      message: 'One-line description:',
    });

    const deployTarget = await select({
      message: 'Deployment target:',
      choices: [
        { value: 'vercel', name: 'Vercel' },
        { value: 'railway', name: 'Railway' },
        { value: 'fly', name: 'Fly.io' },
        { value: 'docker', name: 'Docker' },
        { value: 'local', name: 'Local only' },
      ],
    });

    const aiProvider = await select({
      message: 'AI provider:',
      choices: [
        { value: 'anthropic', name: 'Anthropic (Claude)' },
        { value: 'openai', name: 'OpenAI' },
        { value: 'both', name: 'Both' },
        { value: 'none', name: 'None' },
      ],
    });

    const database = await select({
      message: 'Database:',
      choices: [
        { value: 'none', name: 'None' },
        { value: 'supabase', name: 'Supabase' },
        { value: 'postgres', name: 'PostgreSQL' },
        { value: 'firebase', name: 'Firebase' },
      ],
    });

    const includeBrandVoice = await confirm({
      message: 'Include brand voice template?',
      default: false,
    });

    const includeDesignSystem = await confirm({
      message: 'Include design system template?',
      default: false,
    });

    // Generate files
    console.log(chalk.dim('\n  Generating files...\n'));

    const date = today();
    const files: Array<{ path: string; content: string }> = [
      {
        path: join(cwd, 'CLAUDE.md'),
        content: generateClaudeMd({ projectName, projectType, description, deployTarget, aiProvider, database }),
      },
      {
        path: join(cwd, '.env.example'),
        content: generateEnvExample({ aiProvider, database, deployTarget }),
      },
      {
        path: join(cwd, '.gitignore'),
        content: generateGitignore(projectType),
      },
      {
        path: join(cwd, 'README.md'),
        content: generateReadme({ projectName, projectType, description, deployTarget }),
      },
      {
        path: join(cwd, 'docs', 'ARCHITECTURE.md'),
        content: generateArchitecture(projectName, description),
      },
      {
        path: join(cwd, 'docs', 'SECURITY_CHECKLIST.md'),
        content: generateSecurityChecklist(projectType),
      },
      {
        path: join(cwd, 'docs', 'sessions', 'README.md'),
        content: generateSessionIndex(projectName),
      },
      {
        path: join(cwd, 'docs', 'sessions', `${date}_session.md`),
        content: generateSessionLog(date),
      },
    ];

    if (includeBrandVoice) {
      files.push({
        path: join(cwd, 'docs', 'BRAND_VOICE.md'),
        content: `# Brand Voice\n\nRun \`maestro voice\` to generate this file interactively.\n`,
      });
    }

    if (includeDesignSystem) {
      files.push({
        path: join(cwd, 'docs', 'DESIGN_SYSTEM.md'),
        content: `# Design System\n\nRun \`maestro design-system\` to generate this file interactively.\n`,
      });
    }

    ensureDir(cwd);

    for (const file of files) {
      writeFile(file.path, file.content);
      const relative = file.path.replace(cwd, '').replace(/^\//, '');
      console.log(`  ${sym.plus} ${relative}`);
    }

    console.log(sb('Project scaffolded.'));
    console.log(fmtHint('maestro audit'));
  });
