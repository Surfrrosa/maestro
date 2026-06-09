import { join } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { readFile } from './fs.js';

export interface ParsedSession {
  date: string;
  file: string;
  status: string;
  objectives: string[];
  accomplished: string[];
  knownIssues: string[];
  filesModified: string[];
  nextSession: string[];
}

export function extractSection(content: string, heading: string): string[] {
  const pattern = new RegExp(`## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`);
  const match = content.match(pattern);
  if (!match) return [];
  return match[1]
    .trim()
    .split('\n')
    .map(l => l.replace(/^-\s*/, '').trim())
    .filter(l => l && l !== '-' && !l.startsWith('<!--'));
}

function parseSessionLog(filePath: string, fileName: string): ParsedSession {
  const content = readFile(filePath);
  const dateMatch = fileName.match(/^(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch ? dateMatch[1] : '';

  const statusMatch = content.match(/## Status:\s*(.+)/);
  const status = statusMatch ? statusMatch[1].trim() : 'Unknown';

  return {
    date,
    file: fileName,
    status,
    objectives: extractSection(content, 'Objectives'),
    accomplished: extractSection(content, 'Accomplished'),
    knownIssues: extractSection(content, 'Known Issues Discovered'),
    filesModified: extractSection(content, 'Files Modified'),
    nextSession: extractSection(content, 'Next Session'),
  };
}

export function parseSessionLogs(cwd: string): ParsedSession[] {
  const sessionsDir = join(cwd, 'docs', 'sessions');
  if (!existsSync(sessionsDir)) return [];

  const logFiles = readdirSync(sessionsDir)
    .filter(f => /^\d{4}-\d{2}-\d{2}_session/.test(f) && f.endsWith('.md'))
    .sort();

  return logFiles.map(f => parseSessionLog(join(sessionsDir, f), f));
}
