import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { glob, globSync } from 'glob';
import { fileExists, readFile, detectStack } from '../utils/fs.js';

export interface DepFinding {
  category: 'unused' | 'phantom' | 'license';
  name: string;
  detail: string;
  severity: 'high' | 'medium' | 'low';
}

const NODE_BARE = [
  'assert', 'buffer', 'child_process', 'cluster', 'console', 'constants', 'crypto', 'dgram', 'dns',
  'domain', 'events', 'fs', 'http', 'http2', 'https', 'module', 'net', 'os', 'path', 'perf_hooks',
  'process', 'punycode', 'querystring', 'readline', 'repl', 'stream', 'string_decoder', 'sys',
  'timers', 'tls', 'tty', 'url', 'util', 'v8', 'vm', 'worker_threads', 'zlib', 'test',
];
export const NODE_BUILTINS = new Set([...NODE_BARE, ...NODE_BARE.map(m => `node:${m}`)]);

export const PYTHON_IMPORT_MAP: Record<string, string> = {
  cv2: 'opencv-python', PIL: 'pillow', sklearn: 'scikit-learn', yaml: 'pyyaml',
  bs4: 'beautifulsoup4', gi: 'pygobject', attr: 'attrs', dateutil: 'python-dateutil',
  dotenv: 'python-dotenv', jose: 'python-jose',
};

export const PYTHON_STDLIB = new Set([
  'os', 'sys', 'io', 're', 'json', 'math', 'time', 'datetime', 'collections', 'itertools',
  'functools', 'operator', 'string', 'textwrap', 'struct', 'codecs', 'unicodedata', 'difflib',
  'typing', 'copy', 'pprint', 'enum', 'numbers', 'decimal', 'fractions', 'random', 'statistics',
  'pathlib', 'glob', 'shutil', 'tempfile', 'csv', 'configparser', 'argparse', 'logging',
  'warnings', 'abc', 'contextlib', 'dataclasses', 'hashlib', 'hmac', 'secrets', 'urllib', 'http',
  'email', 'html', 'xml', 'sqlite3', 'subprocess', 'multiprocessing', 'threading', 'concurrent',
  'asyncio', 'socket', 'ssl', 'select', 'signal', 'unittest', 'doctest', 'inspect', 'dis',
  'traceback', 'pickle', 'shelve', 'marshal', 'dbm', 'platform', 'sysconfig', 'builtins',
  'importlib', 'pkgutil', 'types', 'weakref', 'gc', 'site',
]);

export const PERMISSIVE = ['MIT', 'ISC', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD', 'Unlicense'];
export const GPL_FAMILY = ['GPL', 'LGPL', 'AGPL', 'GPL-2.0', 'GPL-3.0', 'LGPL-2.0', 'LGPL-2.1', 'LGPL-3.0', 'AGPL-3.0'];

function extractPackageName(importPath: string): string | null {
  if (importPath.startsWith('node:')) return null;
  if (importPath.startsWith('.') || importPath.startsWith('/')) return null;
  if (importPath.startsWith('@')) {
    const parts = importPath.split('/');
    if (parts[0] === '@' || !parts[0].match(/^@[a-z0-9][\w.-]*$/i)) return null;
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
  }
  return importPath.split('/')[0];
}

function extractPackagesFromContent(
  content: string,
  patterns: RegExp[],
  imported: Set<string>,
): void {
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
}

export async function scanNodeImports(cwd: string): Promise<Set<string>> {
  const imported = new Set<string>();
  const patterns = [
    /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  const files = await glob('**/*.{ts,js,tsx,jsx}', {
    cwd,
    ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/*.d.ts', '**/*.test.*', '**/*.spec.*', 'tests/**'],
    maxDepth: 8,
  });

  for (const file of files) {
    try {
      const content = readFileSync(join(cwd, file), 'utf-8');
      extractPackagesFromContent(content, patterns, imported);
    } catch {
      // Skip
    }
  }
  return imported;
}

function extractPythonPackages(content: string, imported: Set<string>): void {
  const patterns = [
    /^import\s+(\w+)/gm,
    /^from\s+(\w+)/gm,
  ];
  for (const pattern of patterns) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(content)) !== null) {
      const mod = match[1];
      if (!PYTHON_STDLIB.has(mod)) {
        imported.add(PYTHON_IMPORT_MAP[mod] || mod);
      }
    }
  }
}

export async function scanPythonImports(cwd: string): Promise<Set<string>> {
  const imported = new Set<string>();
  const files = await glob('**/*.py', {
    cwd,
    ignore: ['**/__pycache__/**', '**/.git/**', '**/venv/**', '**/.venv/**', '**/env/**'],
    maxDepth: 8,
  });

  for (const file of files) {
    try {
      extractPythonPackages(readFileSync(join(cwd, file), 'utf-8'), imported);
    } catch {
      // Skip
    }
  }
  return imported;
}

export function getDeclaredDeps(cwd: string, stack: string): Map<string, string> {
  const deps = new Map<string, string>();

  if (stack === 'node') {
    readNodeDeps(cwd, deps);
  } else if (stack === 'python') {
    readPythonDeps(cwd, deps);
  }

  return deps;
}

function parsePkgDeps(content: string): Array<[string, string]> {
  try {
    const pkg = JSON.parse(content);
    return Object.entries({ ...pkg.dependencies, ...pkg.devDependencies } || {}) as Array<[string, string]>;
  } catch {
    return [];
  }
}

function readNodeDeps(cwd: string, deps: Map<string, string>): void {
  const pkgPath = join(cwd, 'package.json');
  if (fileExists(pkgPath)) {
    for (const [name, version] of parsePkgDeps(readFile(pkgPath))) {
      deps.set(name, version);
    }
  }
  try {
    const subPkgs = globSync('*/package.json', { cwd, ignore: ['node_modules/**'] });
    for (const subPkg of subPkgs) {
      for (const [name, version] of parsePkgDeps(readFileSync(join(cwd, subPkg), 'utf-8'))) {
        if (!deps.has(name)) deps.set(name, version);
      }
    }
  } catch {
    // Skip
  }
}

function readPythonDeps(cwd: string, deps: Map<string, string>): void {
  const reqPath = join(cwd, 'requirements.txt');
  if (!fileExists(reqPath)) return;
  const lines = readFile(reqPath).split('\n').filter(l => l.trim() && !l.startsWith('#'));
  for (const line of lines) {
    const name = line.split(/[>=<!\[]/)[0].trim().toLowerCase();
    if (name) deps.set(name, line);
  }
}

function readDepLicense(cwd: string, dep: string): string | null {
  const depPkgPath = join(cwd, 'node_modules', dep, 'package.json');
  if (!existsSync(depPkgPath)) return null;
  try {
    const depPkg = JSON.parse(readFileSync(depPkgPath, 'utf-8'));
    return (depPkg.license || 'unknown').toString();
  } catch {
    return null;
  }
}

function isGplLicense(license: string): boolean {
  return GPL_FAMILY.some(g => license.toUpperCase().includes(g.toUpperCase()));
}

export function checkLicenses(cwd: string, declaredDeps: Map<string, string>): DepFinding[] {
  const findings: DepFinding[] = [];
  const pkgPath = join(cwd, 'package.json');
  if (!fileExists(pkgPath)) return findings;

  try {
    const pkg = JSON.parse(readFile(pkgPath));
    const hostLicense = pkg.license || 'unknown';
    if (!PERMISSIVE.includes(hostLicense)) return findings;

    for (const dep of declaredDeps.keys()) {
      const depLicense = readDepLicense(cwd, dep);
      if (depLicense && isGplLicense(depLicense)) {
        findings.push({
          category: 'license',
          name: dep,
          detail: `${dep} uses ${depLicense}. Your project is ${hostLicense}. GPL may require your project to adopt a compatible license.`,
          severity: 'high',
        });
      }
    }
  } catch {
    // Skip
  }
  return findings;
}

const CLI_TOOLS = new Set([
  'tsup', 'vitest', 'jest', 'mocha', 'eslint', 'prettier', 'typescript',
  'tsc', 'nodemon', 'ts-node', 'tsx', 'postcss', 'autoprefixer', 'tailwindcss',
]);

const CLI_PLUGIN_PREFIXES = [
  '@typescript-eslint/', '@vitest/', '@eslint/',
  'eslint-plugin-', 'eslint-config-', '@vitejs/',
];

function findUnusedDeps(
  declared: Map<string, string>,
  imported: Set<string>,
  stack: string,
): DepFinding[] {
  const findings: DepFinding[] = [];
  const depFile = stack === 'node' ? 'package.json' : 'requirements.txt';

  for (const dep of declared.keys()) {
    if (dep.startsWith('@types/')) continue;
    if (CLI_TOOLS.has(dep)) continue;
    if (CLI_PLUGIN_PREFIXES.some(prefix => dep.startsWith(prefix))) continue;

    const depLower = dep.toLowerCase();
    const isUsed = [...imported].some(imp => imp.toLowerCase() === depLower);
    if (!isUsed) {
      findings.push({
        category: 'unused',
        name: dep,
        detail: `${dep} is declared in ${depFile} but never imported in source code.`,
        severity: 'low',
      });
    }
  }
  return findings;
}

function findPhantomDeps(declared: Map<string, string>, imported: Set<string>): DepFinding[] {
  const findings: DepFinding[] = [];
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
  return findings;
}

export async function runDepsAnalysis(cwd: string): Promise<DepFinding[]> {
  const stack = detectStack(cwd);
  const declared = getDeclaredDeps(cwd, stack);
  if (declared.size === 0) return [];

  const imported = stack === 'node'
    ? await scanNodeImports(cwd)
    : stack === 'python'
    ? await scanPythonImports(cwd)
    : new Set<string>();

  const findings: DepFinding[] = [
    ...findUnusedDeps(declared, imported, stack),
    ...findPhantomDeps(declared, imported),
  ];

  if (stack === 'node') {
    findings.push(...checkLicenses(cwd, declared));
  }

  return findings;
}
