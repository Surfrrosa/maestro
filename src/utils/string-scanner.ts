export interface ScannerState {
  inString: boolean;
  stringChar: string;
}

export function createScannerState(): ScannerState {
  return { inString: false, stringChar: '' };
}

/**
 * Walk one line of source code, invoking callbacks for `{` and `}` braces
 * that are outside string literals and line comments. State is mutated
 * in place so multi-line template literals are tracked across calls.
 *
 * Used by the JS analyzers (function-length, nesting, hygiene) which need
 * brace bookkeeping but want to ignore braces inside strings/comments.
 */
export function scanBracesInLine(
  line: string,
  state: ScannerState,
  onOpen: (col: number) => void,
  onClose: (col: number) => void,
): void {
  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    if (state.inString) {
      if (ch === state.stringChar && line[j - 1] !== '\\') state.inString = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      state.inString = true;
      state.stringChar = ch;
      continue;
    }
    if (ch === '/' && line[j + 1] === '/') break;
    if (ch === '{') onOpen(j);
    if (ch === '}') onClose(j);
  }
}

/**
 * Return `line` with the contents of string literals replaced by spaces.
 * Quote characters are preserved; non-string content (including comments)
 * is untouched. Column positions are preserved so `.match().index` still
 * refers to the same column as in the original line.
 *
 * State is mutated in place so multi-line template literals persist across
 * calls. Callers must reuse a single state per file, reset with
 * `createScannerState()` between files.
 *
 * Used by the hygiene analyzer to skip regex hits that fall inside string
 * literals (e.g., `"console.log(x)"` should not trigger debug-statement).
 * Line comments are intentionally NOT masked so real `// TODO` markers in
 * source still register with tech-debt-marker checks.
 */
export function maskStringsOnly(line: string, state: ScannerState): string {
  const out: string[] = [];
  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    if (state.inString) {
      if (ch === state.stringChar && line[j - 1] !== '\\') {
        state.inString = false;
        out.push(ch);
      } else {
        out.push(' ');
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      state.inString = true;
      state.stringChar = ch;
      out.push(ch);
      continue;
    }
    out.push(ch);
  }
  return out.join('');
}
