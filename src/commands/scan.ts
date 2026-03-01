import { Command } from 'commander';
import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { join, basename } from 'node:path';
import { fileExists, readFile, writeFile, ensureDir, today, detectStack } from '../utils/fs.js';
import { generateSessionLog } from '../templates/session-log.js';
import { generateSessionIndex } from '../templates/session-index.js';
import { generateSecurityChecklist } from '../templates/security.js';
import {
  type ScannedProject,
  inferProjectType,
  extractDescription,
  extractRunCommands,
  scanKeyFiles,
  detectAiProvider,
  detectDatabase,
  detectDeployTarget,
  detectDependencies,
} from './scan-detectors.js';

function generateAiSection(scan: ScannedProject): string {
  if (scan.aiProvider === 'none') return '';
  const label = scan.aiProvider === 'both'
    ? 'Anthropic and OpenAI'
    : scan.aiProvider === 'anthropic' ? 'Anthropic (Claude)' : 'OpenAI';
  return `\n## AI Provider\n\nUsing ${label}. API keys in .env.\n`;
}

function generateDbSection(scan: ScannedProject): string {
  if (scan.database === 'none') return '';
  return `\n## Database\n\nUsing ${scan.database}. Connection config in .env.\n`;
}

function generateDeploySection(scan: ScannedProject): string {
  if (scan.deployTarget === 'local') return '';
  return `\n## Deployment\n\nDeploys to ${scan.deployTarget}.\n`;
}

function generateSecuritySection(scan: ScannedProject): string {
  const isWebProject = scan.projectType.includes('api') || scan.projectType.includes('frontend');
  if (!isWebProject) return '';
  return `\n## Security\n\n### Content Security Policy\nUpdate CSP headers when adding new external services:\n\n| Service | Domains needed |\n|---------|---------------|\n| (add as needed) | |\n\n### Checklist\n- [ ] Review docs/SECURITY_CHECKLIST.md\n- [ ] No secrets in client-side code\n- [ ] Input sanitization on all user inputs\n`;
}

function generateKeyFilesTable(scan: ScannedProject): string {
  return scan.keyFiles.map(f => `| ${f.file} | ${f.purpose} |`).join('\n');
}

function generateRunSection(scan: ScannedProject): string {
  if (scan.runCommands.length > 0) {
    return scan.runCommands.map(c => `\`\`\`bash\n${c}\n\`\`\``).join('\n\n');
  }
  return '```bash\n# (add your run commands here)\n```';
}

export function generateScannedClaudeMd(scan: ScannedProject): string {
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
${generateKeyFilesTable(scan)}

## Running

${generateRunSection(scan)}

## Domain Rules

<!-- Add project-specific rules here. These are non-negotiable constraints. Examples: -->
<!-- - NEVER guess data. Always verify computationally. -->
<!-- - All API responses must include error codes. -->
<!-- - CSS must use the design system variables in docs/DESIGN_SYSTEM.md. -->
<!-- - This module should never import from that module. -->
${generateAiSection(scan)}${generateDbSection(scan)}${generateDeploySection(scan)}
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
${generateSecuritySection(scan)}`;
}

function buildScan(cwd: string, projectName: string): ScannedProject {
  const stack = detectStack(cwd);
  return {
    name: projectName,
    description: extractDescription(cwd),
    projectType: inferProjectType(cwd),
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
}

function printScanSummary(scan: ScannedProject, lbl: (t: string) => string): void {
  console.log(`  ${lbl('Stack:')} ${scan.stack} (${scan.projectType})`);
  console.log(`  ${lbl('Key files:')} ${scan.keyFiles.length} detected`);
  console.log(`  ${lbl('Run commands:')} ${scan.runCommands.length} found`);
  console.log(`  ${lbl('AI provider:')} ${scan.aiProvider}`);
  console.log(`  ${lbl('Database:')} ${scan.database}`);
  console.log(`  ${lbl('Deploy target:')} ${scan.deployTarget}`);
  console.log(`  ${lbl('Dependencies:')} ${scan.dependencies.length}`);
  console.log('');
}

async function writeClaudeMd(cwd: string, scan: ScannedProject, symbols: { plus: string }): Promise<void> {
  if (fileExists(join(cwd, 'CLAUDE.md'))) {
    const overwrite = await confirm({ message: '  CLAUDE.md already exists. Overwrite?', default: false });
    if (!overwrite) {
      console.log(chalk.dim('  Skipping CLAUDE.md.\n'));
      return;
    }
  }
  writeFile(join(cwd, 'CLAUDE.md'), generateScannedClaudeMd(scan));
  console.log(`  ${symbols.plus} CLAUDE.md (populated from codebase scan)`);
}

function writeSessionDocs(cwd: string, projectName: string, symbols: { plus: string }): void {
  if (fileExists(join(cwd, 'docs', 'sessions'))) {
    console.log(chalk.dim('  docs/sessions/ already exists, skipping.'));
    return;
  }
  const date = today();
  ensureDir(join(cwd, 'docs', 'sessions'));
  writeFile(join(cwd, 'docs', 'sessions', 'README.md'), generateSessionIndex(projectName));
  writeFile(join(cwd, 'docs', 'sessions', `${date}_session.md`), generateSessionLog(date));
  console.log(`  ${symbols.plus} docs/sessions/README.md`);
  console.log(`  ${symbols.plus} docs/sessions/${date}_session.md`);
}

function writeSecurityChecklist(cwd: string, scan: ScannedProject, symbols: { plus: string }): void {
  const paths = [
    join(cwd, 'docs', 'SECURITY_CHECKLIST.md'),
    join(cwd, 'docs', 'SECURITY.md'),
    join(cwd, 'SECURITY.md'),
  ];
  if (paths.some(p => fileExists(p))) return;
  ensureDir(join(cwd, 'docs'));
  writeFile(join(cwd, 'docs', 'SECURITY_CHECKLIST.md'), generateSecurityChecklist(scan.projectType));
  console.log(`  ${symbols.plus} docs/SECURITY_CHECKLIST.md`);
}

function writeEnvExample(cwd: string, symbols: { plus: string }): void {
  if (!fileExists(join(cwd, '.env')) || fileExists(join(cwd, '.env.example'))) return;
  const envContent = readFile(join(cwd, '.env'));
  const sanitized = envContent
    .split('\n')
    .map(line => {
      if (line.startsWith('#') || !line.includes('=')) return line;
      const eqIndex = line.indexOf('=');
      return `${line.substring(0, eqIndex)}=your_value_here`;
    })
    .join('\n');
  writeFile(join(cwd, '.env.example'), sanitized);
  console.log(`  ${symbols.plus} .env.example (generated from .env, values redacted)`);
}

export const scanCommand = new Command('scan')
  .description('Scan an existing project and generate populated CLAUDE.md and docs')
  .action(async () => {
    const cwd = process.cwd();
    const projectName = basename(cwd);

    const { commandHeader, info: fmtInfo, SYM: symbols, successBanner: sb, hint: fmtHint, palette: pal } = await import('../utils/format.js');
    console.log(commandHeader('scan'));
    console.log(fmtInfo(`Scanning ${projectName}...\n`));

    const scan = buildScan(cwd, projectName);
    printScanSummary(scan, (t: string) => chalk.hex(pal.INFO_C)(t));

    await writeClaudeMd(cwd, scan, symbols);
    writeSessionDocs(cwd, projectName, symbols);
    writeSecurityChecklist(cwd, scan, symbols);
    writeEnvExample(cwd, symbols);

    console.log(sb('Scan complete.'));
    console.log(fmtHint('maestro report'));
  });
