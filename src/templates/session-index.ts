export function generateSessionIndex(projectName: string): string {
  return `# ${projectName} - Session Logs

Session logs provide continuity between AI-assisted development sessions. Read the latest log before starting work.

## Log

| Date | Status | Summary |
|------|--------|---------|
`;
}

export function appendSessionEntry(existing: string, date: string, status: string, summary: string): string {
  const entry = `| ${date} | ${status} | ${summary} |`;
  return existing.trimEnd() + '\n' + entry + '\n';
}
