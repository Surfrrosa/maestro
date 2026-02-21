import { Command } from 'commander';
import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { join, relative, basename } from 'node:path';
import { readdirSync, statSync } from 'node:fs';
import { fileExists, readFile, writeFile, ensureDir, today, detectStack } from '../utils/fs.js';
import { generateSessionLog } from '../templates/session-log.js';
import { generateSessionIndex } from '../templates/session-index.js';
import { generateSecurityChecklist } from '../templates/security.js';
import type { ProjectType } from '../templates/claude-md.js';

interface ScannedProject {
  name: string;
  description: string;
  projectType: ProjectType;
  stack: 'node' | 'python' | 'unknown';
  runCommands: string[];
  keyFiles: Array<{ file: string; purpose: string }>;
  aiProvider: string;
  database: string;
  deployTarget: string;
  hasTests: boolean;
  hasCi: boolean;
  dependencies: string[];
}

function inferProjectType(cwd: string): ProjectType {
  const stack = detectStack(cwd);
  const pkg = readPkg(cwd);

  if (stack === 'python') {
    if (fileExists(join(cwd, 'Dockerfile')) || pkg !== null) {
      // Check for FastAPI, Flask, Django
      const reqs = fileExists(join(cwd, 'requirements.txt')) ? readFile(join(cwd, 'requirements.txt')) : '';
      if (reqs.includes('fastapi') || reqs.includes('flask') || reqs.includes('django')) return 'api-python';
      if (reqs.includes('pandas') || reqs.includes('numpy') || reqs.includes('scrapy')) return 'data-pipeline';
    }
    return 'api-python';
  }

  if (stack === 'node' && pkg) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps['next']) return 'frontend-next';
    if (deps['react-native'] || deps['expo']) return 'mobile-react-native';
    if (deps['express'] || deps['fastify'] || deps['hono']) return 'api-node';
    if (pkg.bin) return 'cli-tool';
    return 'frontend-next'; // default for node
  }

  if (fileExists(join(cwd, 'index.html'))) return 'frontend-static';

  return 'cli-tool';
}

function readPkg(cwd: string): Record<string, unknown> | null {
  const pkgPath = join(cwd, 'package.json');
  if (!fileExists(pkgPath)) return null;
  try {
    return JSON.parse(readFile(pkgPath));
  } catch {
    return null;
  }
}

function extractDescription(cwd: string): string {
  // Try README first
  const readmePath = join(cwd, 'README.md');
  if (fileExists(readmePath)) {
    const readme = readFile(readmePath);
    const lines = readme.split('\n').filter(l => l.trim());
    // Skip the title line, grab the first paragraph
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line && !line.startsWith('#') && !line.startsWith('!') && !line.startsWith('```') && !line.startsWith('|') && !line.startsWith('-')) {
        return line;
      }
    }
  }

  // Try package.json
  const pkg = readPkg(cwd);
  if (pkg?.description && typeof pkg.description === 'string') {
    return pkg.description;
  }

  return '(no description found -- add one here)';
}

function extractRunCommands(cwd: string, stack: 'node' | 'python' | 'unknown'): string[] {
  const commands: string[] = [];

  if (stack === 'node') {
    const pkg = readPkg(cwd);
    if (pkg?.scripts && typeof pkg.scripts === 'object') {
      const scripts = pkg.scripts as Record<string, string>;
      if (scripts.dev) commands.push(`npm run dev -- ${scripts.dev}`);
      else if (scripts.start) commands.push(`npm start -- ${scripts.start}`);
      if (scripts.build) commands.push(`npm run build`);
      if (scripts.test) commands.push(`npm test`);
      if (scripts.lint) commands.push(`npm run lint`);
    }
  }

  if (stack === 'python') {
    const reqs = fileExists(join(cwd, 'requirements.txt')) ? readFile(join(cwd, 'requirements.txt')) : '';
    if (reqs.includes('fastapi') || reqs.includes('uvicorn')) {
      commands.push('uvicorn src.api.main:app --reload');
    }
    if (reqs.includes('flask')) {
      commands.push('flask run');
    }
    if (reqs.includes('pytest')) {
      commands.push('python -m pytest tests/ -x');
    }
    if (commands.length === 0) {
      commands.push('python -m src.main');
    }
  }

  return commands;
}

function scanKeyFiles(cwd: string, maxDepth: number = 3): Array<{ file: string; purpose: string }> {
  const keyFiles: Array<{ file: string; purpose: string }> = [];

  const purposeMap: Record<string, string> = {
    'package.json': 'Dependencies and scripts',
    'requirements.txt': 'Python dependencies',
    'pyproject.toml': 'Python project config',
    'Dockerfile': 'Container configuration',
    'docker-compose.yml': 'Multi-container setup',
    'docker-compose.yaml': 'Multi-container setup',
    '.env.example': 'Environment variable template',
    'Procfile': 'Process declaration (Heroku/Railway)',
    'vercel.json': 'Vercel deployment config',
    'fly.toml': 'Fly.io deployment config',
    'railway.json': 'Railway deployment config',
    'tsconfig.json': 'TypeScript configuration',
    'tailwind.config.js': 'Tailwind CSS configuration',
    'tailwind.config.ts': 'Tailwind CSS configuration',
    'next.config.js': 'Next.js configuration',
    'next.config.ts': 'Next.js configuration',
    'next.config.mjs': 'Next.js configuration',
    'vite.config.ts': 'Vite configuration',
    'app.json': 'Expo app configuration',
    'babel.config.js': 'Babel configuration',
    'vitest.config.ts': 'Test configuration',
    'jest.config.js': 'Test configuration',
    'jest.config.ts': 'Test configuration',
    '.github/workflows/ci.yml': 'CI pipeline',
    '.github/workflows/ci.yaml': 'CI pipeline',
  };

  // Check root-level known files
  for (const [file, purpose] of Object.entries(purposeMap)) {
    if (fileExists(join(cwd, file))) {
      keyFiles.push({ file, purpose });
    }
  }

  // Scan for source entry points and key directories
  const scanDir = (dir: string, depth: number) => {
    if (depth > maxDepth) return;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '__pycache__' || entry.name === 'dist' || entry.name === 'build' || entry.name === '.next') continue;

        const fullPath = join(dir, entry.name);
        const relativePath = relative(cwd, fullPath);

        if (entry.isDirectory()) {
          // Key directories
          const dirPurposes: Record<string, string> = {
            'src/api': 'API routes and handlers',
            'src/commands': 'CLI commands',
            'src/components': 'React components',
            'src/lib': 'Shared utilities',
            'src/utils': 'Utility functions',
            'src/hooks': 'React hooks',
            'src/styles': 'Stylesheets',
            'src/types': 'TypeScript type definitions',
            'src/calculations': 'Domain logic / calculations',
            'src/synthesis': 'AI synthesis logic',
            'src/observatory': 'Data verification tools',
            'src/output': 'Output generation',
            'migrations': 'Database migrations',
            'scripts': 'Utility scripts',
            'tests': 'Test suite',
            '__tests__': 'Test suite',
            'docs': 'Documentation',
            'public': 'Static assets',
          };
          if (dirPurposes[relativePath]) {
            keyFiles.push({ file: `${relativePath}/`, purpose: dirPurposes[relativePath] });
          }
          scanDir(fullPath, depth + 1);
          continue;
        }

        // Key source files
        const filePurposes: Record<string, string> = {
          'main.py': 'Application entry point',
          'main.ts': 'Application entry point',
          'index.ts': 'Module entry point',
          'index.tsx': 'Application entry point',
          'app.py': 'Application entry point',
          'app.ts': 'Application entry point',
          'config.py': 'Configuration and environment variables',
          'config.ts': 'Configuration and environment variables',
          'models.py': 'Data models / schemas',
          'models.ts': 'Data models / schemas',
          'database.py': 'Database client / connection',
          'database.ts': 'Database client / connection',
          'db.ts': 'Database client / connection',
          'middleware.ts': 'Express/API middleware',
          'auth.ts': 'Authentication logic',
          'auth.py': 'Authentication logic',
          'layout.tsx': 'Root layout component',
          'page.tsx': 'Page component',
          'schema.prisma': 'Prisma database schema',
        };

        if (filePurposes[entry.name] && depth <= 2) {
          keyFiles.push({ file: relativePath, purpose: filePurposes[entry.name] });
        }
      }
    } catch {
      // Skip unreadable directories
    }
  };

  scanDir(cwd, 0);

  // Deduplicate and sort
  const seen = new Set<string>();
  return keyFiles.filter(f => {
    if (seen.has(f.file)) return false;
    seen.add(f.file);
    return true;
  }).sort((a, b) => a.file.localeCompare(b.file));
}

function detectAiProvider(cwd: string): string {
  const pkg = readPkg(cwd);
  const deps = pkg ? { ...(pkg.dependencies as Record<string, string> || {}), ...(pkg.devDependencies as Record<string, string> || {}) } : {};
  const reqs = fileExists(join(cwd, 'requirements.txt')) ? readFile(join(cwd, 'requirements.txt')) : '';

  const hasAnthropic = deps['@anthropic-ai/sdk'] || deps['anthropic'] || reqs.includes('anthropic');
  const hasOpenai = deps['openai'] || reqs.includes('openai');

  if (hasAnthropic && hasOpenai) return 'both';
  if (hasAnthropic) return 'anthropic';
  if (hasOpenai) return 'openai';
  return 'none';
}

function detectDatabase(cwd: string): string {
  const pkg = readPkg(cwd);
  const deps = pkg ? { ...(pkg.dependencies as Record<string, string> || {}), ...(pkg.devDependencies as Record<string, string> || {}) } : {};
  const reqs = fileExists(join(cwd, 'requirements.txt')) ? readFile(join(cwd, 'requirements.txt')) : '';

  if (deps['@supabase/supabase-js'] || reqs.includes('supabase')) return 'supabase';
  if (deps['@prisma/client'] || deps['pg'] || deps['postgres'] || reqs.includes('psycopg2') || reqs.includes('asyncpg')) return 'postgres';
  if (deps['firebase'] || deps['firebase-admin'] || reqs.includes('firebase')) return 'firebase';
  return 'none';
}

function detectDeployTarget(cwd: string): string {
  if (fileExists(join(cwd, 'vercel.json')) || fileExists(join(cwd, '.vercel'))) return 'vercel';
  if (fileExists(join(cwd, 'fly.toml'))) return 'fly';
  if (fileExists(join(cwd, 'railway.json')) || fileExists(join(cwd, 'railway.toml'))) return 'railway';
  if (fileExists(join(cwd, 'Dockerfile'))) return 'docker';
  if (fileExists(join(cwd, 'Procfile'))) return 'railway';
  return 'local';
}

function detectDependencies(cwd: string): string[] {
  const deps: string[] = [];
  const pkg = readPkg(cwd);
  if (pkg?.dependencies) {
    deps.push(...Object.keys(pkg.dependencies as Record<string, string>));
  }
  if (fileExists(join(cwd, 'requirements.txt'))) {
    const reqs = readFile(join(cwd, 'requirements.txt'));
    const pkgs = reqs.split('\n')
      .filter(l => l.trim() && !l.startsWith('#'))
      .map(l => l.split(/[>=<!\[]/)[0].trim())
      .filter(Boolean);
    deps.push(...pkgs);
  }
  return deps;
}

function generateScannedClaudeMd(scan: ScannedProject): string {
  const keyFilesTable = scan.keyFiles.map(f =>
    `| ${f.file} | ${f.purpose} |`
  ).join('\n');

  const runSection = scan.runCommands.length > 0
    ? scan.runCommands.map(c => `\`\`\`bash\n${c}\n\`\`\``).join('\n\n')
    : '```bash\n# (add your run commands here)\n```';

  const aiSection = scan.aiProvider !== 'none'
    ? `\n## AI Provider\n\nUsing ${scan.aiProvider === 'both' ? 'Anthropic and OpenAI' : scan.aiProvider === 'anthropic' ? 'Anthropic (Claude)' : 'OpenAI'}. API keys in .env.\n`
    : '';

  const dbSection = scan.database !== 'none'
    ? `\n## Database\n\nUsing ${scan.database}. Connection config in .env.\n`
    : '';

  const deploySection = scan.deployTarget !== 'local'
    ? `\n## Deployment\n\nDeploys to ${scan.deployTarget}.\n`
    : '';

  const securityType = scan.projectType.includes('api') || scan.projectType.includes('frontend')
    ? `\n## Security\n\n### Content Security Policy\nUpdate CSP headers when adding new external services:\n\n| Service | Domains needed |\n|---------|---------------|\n| (add as needed) | |\n\n### Checklist\n- [ ] Review docs/SECURITY_CHECKLIST.md\n- [ ] No secrets in client-side code\n- [ ] Input sanitization on all user inputs\n`
    : '';

  return `# ${scan.name}

${scan.description}

## Session Protocol

**Before starting any work, read the latest session log in \`docs/sessions/\`.**

Write a session log before ending every session. Format: \`docs/sessions/YYYY-MM-DD_session.md\`

## Key Files

| File | Purpose |
|------|---------|
| CLAUDE.md | This file. Project instructions for AI sessions. |
| docs/sessions/ | Session logs for continuity between sessions |
${keyFilesTable}

## Running

${runSection}

## Domain Rules

<!-- Add project-specific rules here. These are non-negotiable constraints. Examples: -->
<!-- - NEVER guess data. Always verify computationally. -->
<!-- - All API responses must include error codes. -->
<!-- - CSS must use the design system variables in docs/DESIGN_SYSTEM.md. -->
<!-- - This module should never import from that module. -->
${aiSection}${dbSection}${deploySection}
## Known Technical Debt

<!-- Track technical debt explicitly. Keep this current. Example: -->
<!-- ### Duplicated template code (Medium) -->
<!-- Pages share boilerplate that should be extracted. -->
<!-- Files affected: src/pages/*.html -->
<!-- Estimated effort: 4-6 hours -->

## Dependencies

All dependencies must be pinned to exact versions. No \`^\` or \`~\` prefixes.

When adding a dependency:
1. Verify it's necessary (don't add libraries for one-time operations)
2. Pin the exact version
3. Document why it was added if non-obvious
${securityType}`;
}

export const scanCommand = new Command('scan')
  .description('Scan an existing project and generate populated CLAUDE.md and docs')
  .action(async () => {
    const cwd = process.cwd();
    const projectName = basename(cwd);

    console.log(chalk.bold('\n  maestro scan\n'));
    console.log(chalk.dim(`  Scanning ${projectName}...\n`));

    const stack = detectStack(cwd);
    const projectType = inferProjectType(cwd);

    const scan: ScannedProject = {
      name: projectName,
      description: extractDescription(cwd),
      projectType,
      stack,
      runCommands: extractRunCommands(cwd, stack),
      keyFiles: scanKeyFiles(cwd),
      aiProvider: detectAiProvider(cwd),
      database: detectDatabase(cwd),
      deployTarget: detectDeployTarget(cwd),
      hasTests: ['tests', '__tests__', 'test', 'spec'].some(d => fileExists(join(cwd, d))),
      hasCi: fileExists(join(cwd, '.github', 'workflows')),
      dependencies: detectDependencies(cwd),
    };

    // Report what was found
    console.log(`  ${chalk.green('Stack:')} ${stack} (${projectType})`);
    console.log(`  ${chalk.green('Key files:')} ${scan.keyFiles.length} detected`);
    console.log(`  ${chalk.green('Run commands:')} ${scan.runCommands.length} found`);
    console.log(`  ${chalk.green('AI provider:')} ${scan.aiProvider}`);
    console.log(`  ${chalk.green('Database:')} ${scan.database}`);
    console.log(`  ${chalk.green('Deploy target:')} ${scan.deployTarget}`);
    console.log(`  ${chalk.green('Dependencies:')} ${scan.dependencies.length}`);
    console.log('');

    // Check what already exists
    const claudeMdExists = fileExists(join(cwd, 'CLAUDE.md'));
    const sessionsExist = fileExists(join(cwd, 'docs', 'sessions'));

    if (claudeMdExists) {
      const overwrite = await confirm({ message: '  CLAUDE.md already exists. Overwrite?', default: false });
      if (!overwrite) {
        console.log(chalk.dim('  Skipping CLAUDE.md.\n'));
      } else {
        writeFile(join(cwd, 'CLAUDE.md'), generateScannedClaudeMd(scan));
        console.log(`  ${chalk.green('+')} CLAUDE.md (populated from codebase scan)`);
      }
    } else {
      writeFile(join(cwd, 'CLAUDE.md'), generateScannedClaudeMd(scan));
      console.log(`  ${chalk.green('+')} CLAUDE.md (populated from codebase scan)`);
    }

    // Generate session log structure
    if (!sessionsExist) {
      const date = today();
      ensureDir(join(cwd, 'docs', 'sessions'));
      writeFile(join(cwd, 'docs', 'sessions', 'README.md'), generateSessionIndex(projectName));
      writeFile(join(cwd, 'docs', 'sessions', `${date}_session.md`), generateSessionLog(date));
      console.log(`  ${chalk.green('+')} docs/sessions/README.md`);
      console.log(`  ${chalk.green('+')} docs/sessions/${date}_session.md`);
    } else {
      console.log(chalk.dim('  docs/sessions/ already exists, skipping.'));
    }

    // Generate security checklist if missing
    const securityPaths = [
      join(cwd, 'docs', 'SECURITY_CHECKLIST.md'),
      join(cwd, 'docs', 'SECURITY.md'),
      join(cwd, 'SECURITY.md'),
    ];
    if (!securityPaths.some(p => fileExists(p))) {
      ensureDir(join(cwd, 'docs'));
      writeFile(join(cwd, 'docs', 'SECURITY_CHECKLIST.md'), generateSecurityChecklist(projectType));
      console.log(`  ${chalk.green('+')} docs/SECURITY_CHECKLIST.md`);
    }

    // Generate .env.example if .env exists but no example
    if (fileExists(join(cwd, '.env')) && !fileExists(join(cwd, '.env.example'))) {
      const envContent = readFile(join(cwd, '.env'));
      const sanitized = envContent
        .split('\n')
        .map(line => {
          if (line.startsWith('#') || !line.includes('=')) return line;
          const eqIndex = line.indexOf('=');
          const key = line.substring(0, eqIndex);
          return `${key}=your_value_here`;
        })
        .join('\n');
      writeFile(join(cwd, '.env.example'), sanitized);
      console.log(`  ${chalk.green('+')} .env.example (generated from .env, values redacted)`);
    }

    console.log(chalk.bold.green(`\n  Scan complete.\n`));
    console.log(chalk.dim('  Next steps:'));
    console.log(chalk.dim('  1. Review CLAUDE.md and add your domain-specific rules'));
    console.log(chalk.dim('  2. Run maestro audit to check overall project health'));
    console.log(chalk.dim('  3. Run maestro session start to begin tracking sessions'));
    console.log('');
  });
