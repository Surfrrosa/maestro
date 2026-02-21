import { Command } from 'commander';
import chalk from 'chalk';
import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { glob } from 'glob';
import { fileExists, readFile, detectStack } from '../utils/fs.js';
import { header, info, PASS, FAIL, WARN, divider } from '../utils/format.js';

export interface DepFinding {
  category: 'unused' | 'phantom' | 'license';
  name: string;
  detail: string;
  severity: 'high' | 'medium' | 'low';
}

const NODE_BUILTINS = new Set([
  'assert', 'buffer', 'child_process', 'cluster', 'console', 'constants',
  'crypto', 'dgram', 'dns', 'domain', 'events', 'fs', 'http', 'http2',
  'https', 'module', 'net', 'os', 'path', 'perf_hooks', 'process',
  'punycode', 'querystring', 'readline', 'repl', 'stream', 'string_decoder',
  'sys', 'timers', 'tls', 'tty', 'url', 'util', 'v8', 'vm', 'worker_threads',
  'zlib', 'node:assert', 'node:buffer', 'node:child_process', 'node:cluster',
  'node:crypto', 'node:dgram', 'node:dns', 'node:events', 'node:fs',
  'node:http', 'node:http2', 'node:https', 'node:module', 'node:net',
  'node:os', 'node:path', 'node:perf_hooks', 'node:process', 'node:querystring',
  'node:readline', 'node:repl', 'node:stream', 'node:string_decoder',
  'node:timers', 'node:tls', 'node:tty', 'node:url', 'node:util', 'node:v8',
  'node:vm', 'node:worker_threads', 'node:zlib', 'node:test',
]);

// Common Python import-to-package mismatches
const PYTHON_IMPORT_MAP: Record<string, string> = {
  cv2: 'opencv-python',
  PIL: 'pillow',
  sklearn: 'scikit-learn',
  yaml: 'pyyaml',
  bs4: 'beautifulsoup4',
  gi: 'pygobject',
  attr: 'attrs',
  dateutil: 'python-dateutil',
  dotenv: 'python-dotenv',
  jose: 'python-jose',
};

const PYTHON_STDLIB = new Set([
  'os', 'sys', 'io', 're', 'json', 'math', 'time', 'datetime', 'collections',
  'itertools', 'functools', 'operator', 'string', 'textwrap', 'struct',
  'codecs', 'unicodedata', 'difflib', 'typing', 'copy', 'pprint',
  'enum', 'numbers', 'decimal', 'fractions', 'random', 'statistics',
  'pathlib', 'glob', 'shutil', 'tempfile', 'csv', 'configparser',
  'argparse', 'logging', 'warnings', 'abc', 'contextlib', 'dataclasses',
  'hashlib', 'hmac', 'secrets', 'urllib', 'http', 'email', 'html',
  'xml', 'sqlite3', 'subprocess', 'multiprocessing', 'threading',
  'concurrent', 'asyncio', 'socket', 'ssl', 'select', 'signal',
  'unittest', 'doctest', 'inspect', 'dis', 'traceback', 'pickle',
  'shelve', 'marshal', 'dbm', 'platform', 'sysconfig', 'builtins',
  'importlib', 'pkgutil', 'types', 'weakref', 'gc', 'site',
]);

function extractPackageName(importPath: string): string | null {
  // Strip node: prefix
  if (importPath.startsWith('node:')) return null;
  // Skip relative imports
  if (importPath.startsWith('.') || importPath.startsWith('/')) return null;
  // Scoped packages: @scope/pkg/sub -> @scope/pkg
  if (importPath.startsWith('@')) {
    const parts = importPath.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
  }
  // Regular packages: pkg/sub -> pkg
  return importPath.split('/')[0];
}

async function scanNodeImports(cwd: string): Promise<Set<string>> {
  const imported = new Set<string>();
  const patterns = [
    /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  const files = await glob('**/*.{ts,js,tsx,jsx}', {
    cwd,
    ignore: ['node_modules/**', 'dist/**', '.git/**', '**/*.d.ts'],
    maxDepth: 8,
  });

  for (const file of files) {
    try {
      const content = readFileSync(join(cwd, file), 'utf-8');
      for (const pattern of patterns) {
        let match;
        pattern.lastIndex = 0;
        while ((match = pattern.exec(content)) !== null) {
          const pkg = extractPackageName(match[1]);
          if (pkg && !NODE_BUILTINS.has(match[1]) && !NODE_BUILTINS.has(pkg)) {
            imported.add(pkg);
          }
        }
      }
    } catch {
      // Skip
    }
  }
  return imported;
}

async function scanPythonImports(cwd: string): Promise<Set<string>> {
  const imported = new Set<string>();
  const patterns = [
    /^import\s+(\w+)/gm,
    /^from\s+(\w+)/gm,
  ];

  const files = await glob('**/*.py', {
    cwd,
    ignore: ['__pycache__/**', '.git/**', 'venv/**', '.venv/**', 'env/**'],
    maxDepth: 8,
  });

  for (const file of files) {
    try {
      const content = readFileSync(join(cwd, file), 'utf-8');
      for (const pattern of patterns) {
        let match;
        pattern.lastIndex = 0;
        while ((match = pattern.exec(content)) !== null) {
          const mod = match[1];
          if (!PYTHON_STDLIB.has(mod)) {
            // Map to package name if there's a known mismatch
            const pkgName = PYTHON_IMPORT_MAP[mod] || mod;
            imported.add(pkgName);
          }
        }
      }
    } catch {
      // Skip
    }
  }
  return imported;
}

function getDeclaredDeps(cwd: string, stack: string): Map<string, string> {
  const deps = new Map<string, string>();

  if (stack === 'node') {
    const pkgPath = join(cwd, 'package.json');
    if (fileExists(pkgPath)) {
      try {
        const pkg = JSON.parse(readFile(pkgPath));
        for (const [name, version] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies } || {})) {
          deps.set(name, version as string);
        }
      } catch {
        // Skip
      }
    }
  } else if (stack === 'python') {
    const reqPath = join(cwd, 'requirements.txt');
    if (fileExists(reqPath)) {
      const lines = readFile(reqPath).split('\n').filter(l => l.trim() && !l.startsWith('#'));
      for (const line of lines) {
        const name = line.split(/[>=<!\[]/)[0].trim().toLowerCase();
        if (name) deps.set(name, line);
      }
    }
  }

  return deps;
}

const GPL_FAMILY = ['GPL', 'LGPL', 'AGPL', 'GPL-2.0', 'GPL-3.0', 'LGPL-2.0', 'LGPL-2.1', 'LGPL-3.0', 'AGPL-3.0'];
const PERMISSIVE = ['MIT', 'ISC', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD', 'Unlicense'];

function checkLicenses(cwd: string, declaredDeps: Map<string, string>): DepFinding[] {
  const findings: DepFinding[] = [];
  const pkgPath = join(cwd, 'package.json');
  if (!fileExists(pkgPath)) return findings;

  try {
    const pkg = JSON.parse(readFile(pkgPath));
    const hostLicense = pkg.license || 'unknown';
    if (!PERMISSIVE.includes(hostLicense)) return findings;

    for (const dep of declaredDeps.keys()) {
      const depPkgPath = join(cwd, 'node_modules', dep, 'package.json');
      if (!existsSync(depPkgPath)) continue;
      try {
        const depPkg = JSON.parse(readFileSync(depPkgPath, 'utf-8'));
        const depLicense = (depPkg.license || 'unknown').toString();
        if (GPL_FAMILY.some(g => depLicense.toUpperCase().includes(g.toUpperCase()))) {
          findings.push({
            category: 'license',
            name: dep,
            detail: `${dep} uses ${depLicense}. Your project is ${hostLicense}. GPL may require your project to adopt a compatible license.`,
            severity: 'high',
          });
        }
      } catch {
        // Skip
      }
    }
  } catch {
    // Skip
  }
  return findings;
}

export async function runDepsAnalysis(cwd: string): Promise<DepFinding[]> {
  const findings: DepFinding[] = [];
  const stack = detectStack(cwd);

  const declared = getDeclaredDeps(cwd, stack);
  if (declared.size === 0) return findings;

  const imported = stack === 'node'
    ? await scanNodeImports(cwd)
    : stack === 'python'
    ? await scanPythonImports(cwd)
    : new Set<string>();

  // Find unused deps (declared but never imported)
  for (const dep of declared.keys()) {
    const depLower = dep.toLowerCase();
    // Check if any import matches this dep
    const isUsed = [...imported].some(imp => imp.toLowerCase() === depLower);
    // Skip type packages for TS (@types/*)
    if (dep.startsWith('@types/')) continue;
    // Skip CLI tools that might not be imported (tsup, vitest, eslint, etc.)
    const cliTools = ['tsup', 'vitest', 'jest', 'mocha', 'eslint', 'prettier', 'typescript', 'tsc', 'nodemon', 'ts-node', 'tsx'];
    if (cliTools.includes(dep)) continue;

    if (!isUsed) {
      findings.push({
        category: 'unused',
        name: dep,
        detail: `${dep} is declared in ${stack === 'node' ? 'package.json' : 'requirements.txt'} but never imported in source code.`,
        severity: 'low',
      });
    }
  }

  // Find phantom deps (imported but not declared)
  for (const imp of imported) {
    const impLower = imp.toLowerCase();
    const isDeclared = [...declared.keys()].some(dep => dep.toLowerCase() === impLower);
    if (!isDeclared) {
      findings.push({
        category: 'phantom',
        name: imp,
        detail: `${imp} is imported in source code but not declared as a dependency.`,
        severity: 'medium',
      });
    }
  }

  // License checking (Node only)
  if (stack === 'node') {
    findings.push(...checkLicenses(cwd, declared));
  }

  return findings;
}

export const depsCommand = new Command('deps')
  .description('Dependency analysis: find unused, phantom, and problematic dependencies')
  .option('--json', 'Output as JSON')
  .action(async (options: { json?: boolean }) => {
    const cwd = process.cwd();
    console.log(header('maestro deps'));
    console.log(info('Analyzing dependencies...\n'));

    const findings = await runDepsAnalysis(cwd);

    if (options.json) {
      console.log(JSON.stringify(findings, null, 2));
      return;
    }

    if (findings.length === 0) {
      console.log(`  ${PASS}  All dependencies look clean.\n`);
      return;
    }

    const grouped: Record<string, DepFinding[]> = {};
    for (const f of findings) {
      if (!grouped[f.category]) grouped[f.category] = [];
      grouped[f.category].push(f);
    }

    const categoryLabels: Record<string, string> = {
      unused: 'Unused Dependencies',
      phantom: 'Phantom Dependencies (imported but not declared)',
      license: 'License Concerns',
    };

    for (const [category, items] of Object.entries(grouped)) {
      const icon = category === 'license' ? FAIL : category === 'phantom' ? WARN : WARN;
      console.log(`  ${chalk.bold(categoryLabels[category] || category)}\n`);
      for (const item of items) {
        console.log(`  ${icon}  ${chalk.white(item.name)}`);
        console.log(`     ${chalk.dim(item.detail)}`);
        console.log('');
      }
    }

    console.log(divider());
    console.log(info(`${findings.length} finding(s) total.\n`));
  });
