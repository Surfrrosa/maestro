import type { QualityFinding, AnalyzerContext } from './types.js';
import { basename } from 'node:path';
import { buildImportGraph } from './dead-code.js';
import { isTestFile } from './patterns.js';

function hasTestFile(srcFile: string, allFiles: string[]): boolean {
  const baseName = basename(srcFile).replace(/\.(ts|tsx|js|jsx|py)$/, '');
  return allFiles.some(f => {
    const testBase = basename(f);
    return testBase.includes(`${baseName}.test.`) ||
      testBase.includes(`${baseName}.spec.`) ||
      testBase.includes(`test_${baseName}.`) ||
      testBase === `${baseName}_test.py`;
  });
}

function findTestedByImport(ctx: AnalyzerContext, testFiles: Set<string>): Set<string> {
  const graph = buildImportGraph(ctx);
  const tested = new Set<string>();
  for (const testFile of testFiles) {
    const imports = graph.imports.get(testFile);
    if (imports) {
      for (const imp of imports) {
        tested.add(imp);
      }
    }
  }
  return tested;
}

function findUntestedFiles(sourceFiles: string[], allFiles: string[], testedByImport: Set<string>): string[] {
  return sourceFiles.filter(f => !hasTestFile(f, allFiles) && !testedByImport.has(f));
}

export function analyzeTesting(ctx: AnalyzerContext): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const testFiles = findTestFiles(ctx.files);
  const sourceFiles = buildSourceFileList(ctx.files, testFiles);
  if (sourceFiles.length === 0) return findings;

  const testedByImport = findTestedByImport(ctx, testFiles);
  const untestedFiles = findUntestedFiles(sourceFiles, ctx.files, testedByImport);

  if (testFiles.size > 0 && untestedFiles.length > 0) {
    const coverage = Math.round(((sourceFiles.length - untestedFiles.length) / sourceFiles.length) * 100);
    if (coverage < 50) {
      findings.push({
        rule: 'low-test-coverage', category: 'testing', severity: 'warning', file: '.',
        message: `Test coverage: ${coverage}% (${sourceFiles.length - untestedFiles.length}/${sourceFiles.length} source files have tests).`,
        suggestion: 'Add tests for untested source files.',
      });
    }
    for (const file of untestedFiles.slice(0, 10)) {
      findings.push({
        rule: 'missing-test', category: 'testing', severity: 'info', file,
        message: `No test file found for ${file}.`,
        suggestion: `Create a test file to cover this module.`,
      });
    }
  }

  return findings;
}

function findTestFiles(files: string[]): Set<string> {
  return new Set(files.filter(isTestFile));
}

function buildSourceFileList(files: string[], testFiles: Set<string>): string[] {
  return files.filter(f => {
    if (testFiles.has(f)) return false;
    const base = basename(f);
    if (/^index\.(ts|js|tsx|jsx|py)$/.test(base)) return false;
    if (/\.(config|setup|d)\.(ts|js)$/.test(base)) return false;
    if (base.endsWith('.d.ts')) return false;
    if (!f.startsWith('src/') && !f.startsWith('lib/') && !f.startsWith('app/')) return false;
    return true;
  });
}
