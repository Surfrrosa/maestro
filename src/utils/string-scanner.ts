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
