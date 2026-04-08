import chalk from 'chalk';
import { join } from 'node:path';
import { glob } from 'glob';
import { fileExists, readFile } from '../utils/fs.js';
import { isTestFile } from '../analyzers/patterns.js';

export interface SecurityFinding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  message: string;
  file?: string;
  line?: number;
  suggestion: string;
}

export const SECRET_PATTERNS: Array<{ regex: RegExp; name: string }> = [
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

const SCAN_FILE_LIMIT = 500;

function scanFileLines(
  files: string[],
  cwd: string,
  check: (line: string, file: string, lineNum: number) => SecurityFinding | null,
): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  for (const file of files) {
    try {
      const lines = readFile(join(cwd, file)).split('\n');
      for (let i = 0; i < lines.length; i++) {
        const finding = check(lines[i], file, i + 1);
        if (finding) findings.push(finding);
      }
    } catch { /* Skip unreadable files */ }
  }
  return findings;
}

export function scanLineForSecret(line: string, file: string, lineNum: number): SecurityFinding | null {
  if (file === '.env') return null;
  if (isTestFile(file)) return null;
  if (/your[_-]?(?:key|token|secret|value)|changeme|placeholder|xxx+|TODO|mock[_-]|test[_-]|fake[_-]|dummy[_-]|sample[_-]|example[_-]/i.test(line)) return null;

  for (const pattern of SECRET_PATTERNS) {
    if (pattern.regex.test(line)) {
      return {
        severity: 'critical',
        category: 'secrets',
        message: `${pattern.name} found`,
        file,
        line: lineNum,
        suggestion: `Move to .env file and add ${file} pattern to .gitignore if needed.`,
      };
    }
  }
  return null;
}

async function scanSecrets(cwd: string): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];
  const allFiles = await glob('**/*.{ts,js,tsx,jsx,py,json,yml,yaml,toml,cfg,ini,env}', {
    cwd,
    ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/__pycache__/**', '*.lock', 'package-lock.json', '.env.example', '**/*.test.*', '**/*.spec.*', '**/__tests__/**', '**/tests/**', '**/__mocks__/**', '**/__fixtures__/**'],
    maxDepth: 6,
  });

  const files = allFiles.slice(0, SCAN_FILE_LIMIT);
  if (allFiles.length > SCAN_FILE_LIMIT) {
    console.warn(`  ${chalk.yellow('!')}  Scanned ${SCAN_FILE_LIMIT} of ${allFiles.length} files. Large project -- results may be incomplete.`);
  }

  findings.push(...scanFileLines(files, cwd, scanLineForSecret));
  return findings;
}

const BUILTIN_ENV_VARS = ['NODE_ENV', 'PATH', 'HOME', 'USER', 'PWD', 'SHELL', 'LANG', 'TERM', 'CI'];

const ENV_REF_PATTERNS = [
  /process\.env\.([A-Z_][A-Z0-9_]*)/g,
  /os\.environ(?:\.get)?\s*\[\s*['"]([A-Z_][A-Z0-9_]*)['"]\s*\]/g,
  /os\.getenv\s*\(\s*['"]([A-Z_][A-Z0-9_]*)['"]/g,
];

interface EnvReference { key: string; line: number; }

function findEnvReferences(content: string, exampleKeys: Set<string>): EnvReference[] {
  const refs: EnvReference[] = [];
  const seen = new Set<string>();

  for (const pattern of ENV_REF_PATTERNS) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(content)) !== null) {
      const envKey = match[1];
      if (exampleKeys.has(envKey) || seen.has(envKey) || BUILTIN_ENV_VARS.includes(envKey)) continue;
      seen.add(envKey);
      refs.push({ key: envKey, line: content.substring(0, match.index).split('\n').length });
    }
  }
  return refs;
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

  const files = await glob('**/*.{ts,js,tsx,jsx,py}', {
    cwd, ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/__pycache__/**'], maxDepth: 6,
  });

  const seen = new Set<string>();
  for (const file of files) {
    try {
      const refs = findEnvReferences(readFile(join(cwd, file)), exampleKeys);
      for (const ref of refs) {
        if (seen.has(ref.key)) continue;
        seen.add(ref.key);
        findings.push({
          severity: 'medium', category: 'env-leak',
          message: `${ref.key} referenced in code but not in .env.example`,
          file, line: ref.line,
          suggestion: `Add ${ref.key}=your_value_here to .env.example`,
        });
      }
    } catch { /* Skip */ }
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
    ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/__pycache__/**', '**/*.test.*', '**/*.spec.*', '**/security.ts', '**/security-scanner.ts', '**/review.ts', '**/review-checks.ts', '**/changelog.ts'],
    maxDepth: 6,
  });

  findings.push(...scanFileLines(files, cwd, (line, file, lineNum) => {
    const ext = file.split('.').pop() || '';
    for (const pattern of unsafePatterns) {
      if (pattern.ext.includes(ext) && pattern.regex.test(line)) {
        return {
          severity: 'high', category: 'unsafe-exec', message: pattern.name,
          file, line: lineNum,
          suggestion: 'Avoid dynamic code execution. Use parameterized queries or safe alternatives.',
        };
      }
    }
    return null;
  }));
  return findings;
}

const SENSITIVE_PORTS = [22, 3306, 5432, 6379, 27017];

function checkDockerLine(line: string, file: string, lineNum: number): SecurityFinding | null {
  if (/^USER\s+root/i.test(line)) {
    return { severity: 'high', category: 'docker', message: 'Container running as root user', file, line: lineNum, suggestion: 'Create a non-root user with USER directive.' };
  }
  const exposeMatch = line.match(/^EXPOSE\s+(\d+)/i);
  if (exposeMatch && SENSITIVE_PORTS.includes(parseInt(exposeMatch[1]))) {
    return { severity: 'medium', category: 'docker', message: `Sensitive port ${exposeMatch[1]} exposed in Dockerfile`, file, line: lineNum, suggestion: 'Ensure this port is not publicly accessible. Use internal Docker networking.' };
  }
  if (/^FROM\s+\S+:latest/i.test(line)) {
    return { severity: 'low', category: 'docker', message: 'Using :latest tag in FROM directive', file, line: lineNum, suggestion: 'Pin to a specific version for reproducible builds.' };
  }
  return null;
}

async function scanDockerExposure(cwd: string): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];
  const dockerfiles = await glob('**/Dockerfile*', { cwd, ignore: ['**/node_modules/**', '**/.git/**'], maxDepth: 3 });

  findings.push(...scanFileLines(dockerfiles, cwd, (line, file, lineNum) => checkDockerLine(line.trim(), file, lineNum)));
  return findings;
}

export async function runSecurityScan(cwd: string): Promise<SecurityFinding[]> {
  return [
    ...await scanSecrets(cwd),
    ...await scanEnvLeaks(cwd),
    ...await scanUnsafeExec(cwd),
    ...await scanDockerExposure(cwd),
  ];
}
