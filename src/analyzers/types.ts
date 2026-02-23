export interface QualityFinding {
  rule: string;
  category: QualityCategory;
  severity: 'error' | 'warning' | 'info';
  file: string;
  line?: number;
  message: string;
  suggestion?: string;
}

export type QualityCategory =
  | 'complexity'
  | 'dead-code'
  | 'structure'
  | 'hygiene'
  | 'consistency'
  | 'testing'
  | 'error-handling';

export interface CategoryScore {
  category: QualityCategory;
  score: number;
  findings: QualityFinding[];
  maxDeductions: number;
  deductions: number;
}

export interface QualityReport {
  categories: CategoryScore[];
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  totalFindings: number;
  fixableCount: number;
}

export interface MaestroConfig {
  quality: {
    ignore: string[];
  };
}

export interface AnalyzerContext {
  cwd: string;
  files: string[];
  fileContents: Map<string, string>;
  stack: 'node' | 'python' | 'unknown';
  sourceExtensions: string[];
  config: MaestroConfig;
}
