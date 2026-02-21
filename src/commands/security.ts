import { Command } from 'commander';
import chalk from 'chalk';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { glob } from 'glob';
import { fileExists, readFile } from '../utils/fs.js';
import { header, info, PASS, FAIL, WARN, divider } from '../utils/format.js';

export interface SecurityFinding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  message: string;
  file?: string;
  line?: number;
  suggestion: string;
}

const SECRET_PATTERNS: Array<{ regex: RegExp; name: string }> = [
  { regex: /(?:api[_-]?key|apikey|secret[_-]?key|access[_-]?token|auth[_-]?token)\s*[:=]\s*['"][a-zA-Z0-9]{16,}/i, name: 'Generic API key' },
  { regex: /sk-[a-zA-Z0-9]{20,}/, name: 'OpenAI key' },
  { regex: /sk-ant-[a-zA-Z0-9\-_]{20,}/, name: 'Anthropic key' },
  { regex: /ghp_[a-zA-Z0-9]{36}/, name: 'GitHub PAT' },
  { regex: /(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}/, name: 'AWS access key' },
  { regex: /xoxb-[0-9]{10,}-[a-zA-Z0-9]+/, name: 'Slack bot token' },
  { regex: /xoxp-[0-9]{10,}-[a-zA-Z0-9]+/, name: 'Slack user token' },
  { regex: /SG\.[a-zA-Z0-9_\-]{22}\.[a-zA-Z0-9_\-]{43}/, name: 'SendGrid key' },
  { regex: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/, name: 'Private key' },
  { regex: /(?:mongodb|postgres|mysql):\/\/[^:\s]+:[^@\s]+@/, name: 'Database URL with password' },
  { regex: /bearer\s+[a-zA-Z0-9_\-.]{20,}/i, name: 'Bearer token' },
  { regex: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}/i, name: 'Hardcoded password' },
  { regex: /stripe[_-]?(?:secret|live)[_-]?key\s*[:=]\s*['"][a-zA-Z0-9]/i, name: 'Stripe key' },
  { regex: /twilio[_-]?(?:auth|account)[_-]?(?:token|sid)\s*[:=]\s*['"][a-zA-Z0-9]/i, name: 'Twilio credential' },
];

async function scanSecrets(cwd: string): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];
  const files = await glob('**/*.{ts,js,tsx,jsx,py,json,yml,yaml,toml,cfg,ini,env}', {
    cwd,
    ignore: ['node_modules/**', 'dist/**', '.git/**', '__pycache__/**', '*.lock', 'package-lock.json', '.env.example'],
    maxDepth: 6,
  });

  for (const file of files.slice(0, 200)) {
    try {
      const content = readFileSync(join(cwd, file), 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const pattern of SECRET_PATTERNS) {
          if (pattern.regex.test(line)) {
            // Skip .env files (they're expected to have secrets)
            if (file === '.env') continue;
            // Skip if it looks like an example/placeholder
            if (/your[_-]?(?:key|token|secret|value)|changeme|placeholder|xxx+|TODO/i.test(line)) continue;

            findings.push({
              severity: 'critical',
              category: 'secrets',
              message: `${pattern.name} found`,
              file,
              line: i + 1,
              suggestion: `Move to .env file and add ${file} pattern to .gitignore if needed.`,
            });
            break; // One finding per line
          }
        }
      }
    } catch {
      // Skip unreadable files
    }
  }
  return findings;
}

async function scanEnvLeaks(cwd: string): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];
  const examplePath = join(cwd, '.env.example');
  if (!fileExists(examplePath)) return findings;

  const exampleKeys = new Set(
    readFile(examplePath).split('\n')
      .filter(l => l.includes('=') && !l.startsWith('#'))
      .map(l => l.split('=')[0].trim())
  );

  const envRefPatterns = [
    /process\.env\.([A-Z_][A-Z0-9_]*)/g,
    /os\.environ(?:\.get)?\s*\[\s*['"]([A-Z_][A-Z0-9_]*)['"]\s*\]/g,
    /os\.getenv\s*\(\s*['"]([A-Z_][A-Z0-9_]*)['"]/g,
  ];

  const files = await glob('**/*.{ts,js,tsx,jsx,py}', {
    cwd,
    ignore: ['node_modules/**', 'dist/**', '.git/**', '__pycache__/**'],
    maxDepth: 6,
  });

  const seen = new Set<string>();
  for (const file of files) {
    try {
      const content = readFileSync(join(cwd, file), 'utf-8');
      for (const pattern of envRefPatterns) {
        let match;
        pattern.lastIndex = 0;
        while ((match = pattern.exec(content)) !== null) {
          const envKey = match[1];
          if (!exampleKeys.has(envKey) && !seen.has(envKey)) {
            // Skip common Node built-in env vars
            if (['NODE_ENV', 'PATH', 'HOME', 'USER', 'PWD', 'SHELL', 'LANG', 'TERM', 'CI'].includes(envKey)) continue;
            seen.add(envKey);
            findings.push({
              severity: 'medium',
              category: 'env-leak',
              message: `${envKey} referenced in code but not in .env.example`,
              file,
              line: content.substring(0, match.index).split('\n').length,
              suggestion: `Add ${envKey}=your_value_here to .env.example`,
            });
          }
        }
      }
    } catch {
      // Skip
    }
  }
  return findings;
}

async function scanUnsafeExec(cwd: string): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];
  const unsafePatterns: Array<{ regex: RegExp; name: string; ext: string[] }> = [
    { regex: /\beval\s*\(/, name: 'eval() usage', ext: ['ts', 'js', 'tsx', 'jsx'] },
    { regex: /new\s+Function\s*\(/, name: 'new Function() usage', ext: ['ts', 'js', 'tsx', 'jsx'] },
    { regex: /execSync\s*\(\s*`/, name: 'execSync with template literal', ext: ['ts', 'js'] },
    { regex: /exec\s*\(\s*`/, name: 'exec with template literal', ext: ['ts', 'js'] },
    { regex: /subprocess\.(?:call|run|Popen)\s*\([^)]*shell\s*=\s*True/s, name: 'subprocess with shell=True', ext: ['py'] },
    { regex: /\bexec\s*\(\s*f['"]/, name: 'exec() with f-string', ext: ['py'] },
    { regex: /\bexec\s*\(\s*['"].*\.format/, name: 'exec() with .format()', ext: ['py'] },
  ];

  const files = await glob('**/*.{ts,js,tsx,jsx,py}', {
    cwd,
    ignore: ['node_modules/**', 'dist/**', '.git/**', '__pycache__/**', '**/*.test.*', '**/*.spec.*', '**/security.ts'],
    maxDepth: 6,
  });

  for (const file of files) {
    const ext = file.split('.').pop() || '';
    try {
      const content = readFileSync(join(cwd, file), 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        for (const pattern of unsafePatterns) {
          if (pattern.ext.includes(ext) && pattern.regex.test(lines[i])) {
            findings.push({
              severity: 'high',
              category: 'unsafe-exec',
              message: pattern.name,
              file,
              line: i + 1,
              suggestion: 'Avoid dynamic code execution. Use parameterized queries or safe alternatives.',
            });
          }
        }
      }
    } catch {
      // Skip
    }
  }
  return findings;
}

async function scanDockerExposure(cwd: string): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];
  const dockerfiles = await glob('**/Dockerfile*', {
    cwd,
    ignore: ['node_modules/**', '.git/**'],
    maxDepth: 3,
  });

  for (const file of dockerfiles) {
    try {
      const content = readFileSync(join(cwd, file), 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Running as root
        if (/^USER\s+root/i.test(line)) {
          findings.push({
            severity: 'high',
            category: 'docker',
            message: 'Container running as root user',
            file,
            line: i + 1,
            suggestion: 'Create a non-root user with USER directive.',
          });
        }

        // Exposed sensitive ports
        const exposeMatch = line.match(/^EXPOSE\s+(\d+)/i);
        if (exposeMatch) {
          const port = parseInt(exposeMatch[1]);
          if ([22, 3306, 5432, 6379, 27017].includes(port)) {
            findings.push({
              severity: 'medium',
              category: 'docker',
              message: `Sensitive port ${port} exposed in Dockerfile`,
              file,
              line: i + 1,
              suggestion: 'Ensure this port is not publicly accessible. Use internal Docker networking.',
            });
          }
        }

        // Using latest tag
        if (/^FROM\s+\S+:latest/i.test(line)) {
          findings.push({
            severity: 'low',
            category: 'docker',
            message: 'Using :latest tag in FROM directive',
            file,
            line: i + 1,
            suggestion: 'Pin to a specific version for reproducible builds.',
          });
        }
      }
    } catch {
      // Skip
    }
  }
  return findings;
}

export async function runSecurityScan(cwd: string): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];
  findings.push(
    ...await scanSecrets(cwd),
    ...await scanEnvLeaks(cwd),
    ...await scanUnsafeExec(cwd),
    ...await scanDockerExposure(cwd),
  );
  return findings;
}

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export const securityCommand = new Command('security')
  .description('Active security scan: find secrets, unsafe patterns, and missing protections')
  .option('--json', 'Output findings as JSON')
  .option('--severity <level>', 'Minimum severity to show: critical, high, medium, low', 'low')
  .action(async (options: { json?: boolean; severity?: string }) => {
    const cwd = process.cwd();
    console.log(header('maestro security'));
    console.log(info('Scanning for security issues...\n'));

    const findings = await runSecurityScan(cwd);

    // Filter by severity
    const minSeverity = SEVERITY_ORDER[options.severity || 'low'] ?? 3;
    const filtered = findings.filter(f => SEVERITY_ORDER[f.severity] <= minSeverity);

    if (options.json) {
      console.log(JSON.stringify(filtered, null, 2));
      return;
    }

    if (filtered.length === 0) {
      console.log(`  ${PASS}  No security issues found.\n`);
      return;
    }

    // Group by severity
    const grouped: Record<string, SecurityFinding[]> = {};
    for (const f of filtered) {
      if (!grouped[f.severity]) grouped[f.severity] = [];
      grouped[f.severity].push(f);
    }

    for (const severity of ['critical', 'high', 'medium', 'low']) {
      const items = grouped[severity];
      if (!items || items.length === 0) continue;

      const sevColor = severity === 'critical' ? chalk.red.bold
        : severity === 'high' ? chalk.red
        : severity === 'medium' ? chalk.yellow
        : chalk.dim;

      console.log(`  ${sevColor(severity.toUpperCase())} (${items.length})\n`);
      for (const f of items) {
        const location = f.file ? (f.line ? `${f.file}:${f.line}` : f.file) : '';
        console.log(`  ${FAIL}  ${f.message}`);
        if (location) console.log(`     ${chalk.dim(location)}`);
        console.log(`     ${chalk.dim(f.suggestion)}`);
        console.log('');
      }
    }

    console.log(divider());
    const critical = (grouped['critical'] || []).length;
    const high = (grouped['high'] || []).length;
    if (critical > 0 || high > 0) {
      console.log(chalk.red.bold(`\n  ${critical + high} critical/high severity issue(s) require immediate attention.\n`));
    } else {
      console.log(chalk.yellow(`\n  ${filtered.length} finding(s). Review and address as appropriate.\n`));
    }
  });
