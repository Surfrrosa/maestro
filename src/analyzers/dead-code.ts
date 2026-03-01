import type { QualityFinding, AnalyzerContext } from './types.js';
import { getContent } from './context.js';
import { basename, dirname, join, relative } from 'node:path';
import { existsSync } from 'node:fs';
import { minimatch } from 'minimatch';

interface ImportGraph {
  imports: Map<string, Set<string>>;
  importedBy: Map<string, Set<string>>;
  exports: Map<string, Set<string>>;
}

const RESOLUTION_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js', '/index.tsx', '/index.jsx'];
const EXTENSION_REMAP: Record<string, string[]> = {
  '.js': ['.ts', '.tsx', '.js', '.jsx'],
  '.jsx': ['.tsx', '.jsx'],
  '.mjs': ['.mts', '.mjs'],
};

function resolveImport(importPath: string, fromFile: string, ctx: AnalyzerContext): string | null {
  let aliasResolved = false;
  for (const [prefix, target] of ctx.pathAliases) {
    if (importPath.startsWith(prefix)) {
      importPath = target + importPath.slice(prefix.length);
      aliasResolved = true;
      break;
    }
  }

  if (!importPath.startsWith('.') && !aliasResolved) return null;

  const fromDir = aliasResolved ? '' : dirname(fromFile);
  const resolved = join(fromDir, importPath).replace(/\\/g, '/');

  const exactMatch = ctx.files.find(f => f.replace(/\\/g, '/') === resolved);
  if (exactMatch) return exactMatch;

  const ext = '.' + (resolved.split('.').pop() || '');
  if (EXTENSION_REMAP[ext]) {
    const base = resolved.slice(0, -ext.length);
    for (const tryExt of EXTENSION_REMAP[ext]) {
      const candidate = base + tryExt;
      const match = ctx.files.find(f => f.replace(/\\/g, '/') === candidate);
      if (match) return match;
    }
  }

  for (const tryExt of RESOLUTION_EXTENSIONS) {
    const candidate = resolved + tryExt;
    const match = ctx.files.find(f => f.replace(/\\/g, '/') === candidate);
    if (match) return match;
  }

  return null;
}

let cachedGraph: { ctx: AnalyzerContext; graph: ImportGraph } | null = null;

function buildImportGraph(ctx: AnalyzerContext): ImportGraph {
  if (cachedGraph && cachedGraph.ctx === ctx) return cachedGraph.graph;

  const imports = new Map<string, Set<string>>();
  const importedBy = new Map<string, Set<string>>();
  const exports = new Map<string, Set<string>>();

  for (const file of ctx.files) {
    imports.set(file, new Set());
    if (!importedBy.has(file)) importedBy.set(file, new Set());
    exports.set(file, new Set());

    const content = getContent(ctx, file);

    if (ctx.stack === 'python') {
      buildPythonImportGraph(content, file, { imports, importedBy, exports }, ctx);
    } else {
      buildJsImportGraph(content, file, { imports, importedBy, exports }, ctx);
    }
  }

  const graph = { imports, importedBy, exports };
  cachedGraph = { ctx, graph };
  return graph;
}

function buildPythonImportGraph(content: string, file: string, graph: ImportGraph, ctx: AnalyzerContext): void {
  const patterns = [
    /^from\s+(\.[\w.]*)\s+import\s+(.+)/gm,
    /^import\s+(\.[\w.]+)/gm,
  ];
  for (const pattern of patterns) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(content)) !== null) {
      const resolved = resolveImport(match[1].replace(/\./g, '/'), file, ctx);
      if (resolved) {
        graph.imports.get(file)!.add(resolved);
        if (!graph.importedBy.has(resolved)) graph.importedBy.set(resolved, new Set());
        graph.importedBy.get(resolved)!.add(file);
      }
    }
  }

  const exportPatterns = /^(?:def|class|async\s+def)\s+(\w+)/gm;
  let expMatch;
  while ((expMatch = exportPatterns.exec(content)) !== null) {
    if (!expMatch[1].startsWith('_')) {
      graph.exports.get(file)!.add(expMatch[1]);
    }
  }
}

function buildJsImportGraph(content: string, file: string, graph: ImportGraph, ctx: AnalyzerContext): void {
  const importPatterns = [
    /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of importPatterns) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(content)) !== null) {
      const resolved = resolveImport(match[1], file, ctx);
      if (resolved) {
        graph.imports.get(file)!.add(resolved);
        if (!graph.importedBy.has(resolved)) graph.importedBy.set(resolved, new Set());
        graph.importedBy.get(resolved)!.add(file);
      }
    }
  }

  extractJsExports(content, graph.exports.get(file)!);
}

function extractJsExports(content: string, exports: Set<string>): void {
  const exportPatterns = [
    /export\s+(?:function|const|let|var|class|type|interface|enum)\s+(\w+)/g,
    /export\s+default\s+(?:function|class)?\s*(\w+)?/g,
    /export\s+\{([^}]+)\}/g,
  ];
  for (const pattern of exportPatterns) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(content)) !== null) {
      if (!match[1]) continue;
      if (pattern.source.includes('{')) {
        for (const name of match[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0].trim())) {
          if (name) exports.add(name);
        }
      } else {
        exports.add(match[1]);
      }
    }
  }
}

function isSkippableFile(file: string, ctx: AnalyzerContext): boolean {
  const base = basename(file);
  const isEntryPoint = /^(index|main|app|server|cli|maestro)\.(ts|js|tsx|jsx|py)$/.test(base);
  const isTest = file.includes('.test.') || file.includes('.spec.') || file.includes('__tests__') || file.startsWith('tests/');
  const isConfig = /\.(config|setup|d)\.(ts|js)$/.test(base) || base.startsWith('.') || /^(vite|vitest|jest|tsup|webpack|rollup|next|tailwind|postcss)/.test(base);
  const isBin = file.startsWith('bin/');
  const isCommand = file.includes('commands/');
  const isTemplate = file.includes('templates/');
  const isIgnored = ctx.config.quality.ignore.some(pattern => minimatch(file, pattern));

  return isEntryPoint || isTest || isConfig || isBin || isCommand || isTemplate || isIgnored;
}

export function analyzeDeadCode(ctx: AnalyzerContext): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const graph = buildImportGraph(ctx);

  for (const file of ctx.files) {
    const importers = graph.importedBy.get(file);
    if (!importers || importers.size === 0) {
      if (!isSkippableFile(file, ctx)) {
        findings.push({
          rule: 'unused-file',
          category: 'dead-code',
          severity: 'warning',
          file,
          message: `File is never imported by any other file in the project.`,
          suggestion: 'Remove if unused, or add to an index/barrel export.',
        });
      }
    }
  }

  return findings;
}

export { buildImportGraph, type ImportGraph };
