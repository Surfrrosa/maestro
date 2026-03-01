/** Matches JS/TS function declarations: named functions, const arrow functions, method shorthand */
export const FUNC_PATTERN = /(?:(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(|(\w+)\s*\([^)]*\)\s*(?::\s*\w[^{]*)?\s*\{)/;

/** Matches Python function declarations */
export const PYTHON_DEF_PATTERN = /^(\s*)(?:async\s+)?def\s+(\w+)/;

/** JS keywords that match FUNC_PATTERN's third alternative but aren't function names */
export const JS_KEYWORDS = new Set(['if', 'else', 'for', 'while', 'do', 'switch', 'try', 'catch', 'finally', 'with', 'return', 'throw', 'new', 'delete', 'typeof', 'void', 'in', 'of']);

/** Determines whether a file path is a test file */
export function isTestFile(file: string): boolean {
  return file.includes('.test.') || file.includes('.spec.') ||
    file.includes('__tests__/') || file.startsWith('tests/') || file.startsWith('test/');
}
