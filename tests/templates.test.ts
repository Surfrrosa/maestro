import { describe, it, expect } from 'vitest';
import { generateClaudeMd } from '../src/templates/claude-md.js';
import { generateSessionLog } from '../src/templates/session-log.js';
import { generateSessionIndex, appendSessionEntry } from '../src/templates/session-index.js';
import { generateEnvExample } from '../src/templates/env-example.js';
import { generateGitignore } from '../src/templates/gitignore.js';
import { generateReadme } from '../src/templates/readme.js';
import { generateArchitecture } from '../src/templates/architecture.js';
import { generateSecurityChecklist } from '../src/templates/security.js';
import { generateBrandVoice } from '../src/templates/brand-voice.js';
import { generateDesignSystem } from '../src/templates/design-system.js';

describe('CLAUDE.md template', () => {
  it('generates for Python API projects', () => {
    const result = generateClaudeMd({
      projectName: 'test-api',
      projectType: 'api-python',
      description: 'A test API',
      deployTarget: 'railway',
      aiProvider: 'anthropic',
      database: 'supabase',
    });
    expect(result).toContain('# test-api');
    expect(result).toContain('A test API');
    expect(result).toContain('uvicorn');
    expect(result).toContain('Session Protocol');
    expect(result).toContain('docs/sessions/');
    expect(result).toContain('Domain Rules');
    expect(result).toContain('Known Technical Debt');
    expect(result).toContain('Dependencies');
  });

  it('generates for Next.js frontend projects', () => {
    const result = generateClaudeMd({
      projectName: 'test-frontend',
      projectType: 'frontend-next',
      description: 'A Next.js app',
      deployTarget: 'vercel',
      aiProvider: 'none',
      database: 'none',
    });
    expect(result).toContain('npm run dev');
    expect(result).toContain('Content Security Policy');
  });

  it('generates for React Native mobile projects', () => {
    const result = generateClaudeMd({
      projectName: 'test-mobile',
      projectType: 'mobile-react-native',
      description: 'A mobile app',
      deployTarget: 'local',
      aiProvider: 'openai',
      database: 'firebase',
    });
    expect(result).toContain('expo start');
    expect(result).toContain('Certificate pinning');
  });

  it('generates for CLI tool projects', () => {
    const result = generateClaudeMd({
      projectName: 'test-cli',
      projectType: 'cli-tool',
      description: 'A CLI tool',
      deployTarget: 'local',
      aiProvider: 'both',
      database: 'none',
    });
    expect(result).toContain('npm run build');
  });
});

describe('Session log template', () => {
  it('generates with correct date', () => {
    const result = generateSessionLog('2026-02-21');
    expect(result).toContain('# Session: 2026-02-21');
    expect(result).toContain('## Status: In Progress');
    expect(result).toContain('## Objectives');
    expect(result).toContain('## Accomplished');
    expect(result).toContain('## Decisions Made');
    expect(result).toContain('## Next Session');
  });
});

describe('Session index template', () => {
  it('generates with project name', () => {
    const result = generateSessionIndex('my-project');
    expect(result).toContain('# my-project - Session Logs');
    expect(result).toContain('| Date | Status | Summary |');
  });

  it('appends entries', () => {
    const index = generateSessionIndex('test');
    const updated = appendSessionEntry(index, '2026-02-21', 'Complete', 'Built the thing');
    expect(updated).toContain('| 2026-02-21 | Complete | Built the thing |');
  });
});

describe('.env.example template', () => {
  it('includes Anthropic key for anthropic provider', () => {
    const result = generateEnvExample({ aiProvider: 'anthropic', database: 'none', deployTarget: 'local' });
    expect(result).toContain('ANTHROPIC_API_KEY');
    expect(result).not.toContain('OPENAI_API_KEY');
  });

  it('includes both keys for both provider', () => {
    const result = generateEnvExample({ aiProvider: 'both', database: 'none', deployTarget: 'local' });
    expect(result).toContain('ANTHROPIC_API_KEY');
    expect(result).toContain('OPENAI_API_KEY');
  });

  it('includes Supabase config', () => {
    const result = generateEnvExample({ aiProvider: 'none', database: 'supabase', deployTarget: 'local' });
    expect(result).toContain('SUPABASE_URL');
    expect(result).toContain('SUPABASE_ANON_KEY');
  });

  it('includes PostgreSQL config', () => {
    const result = generateEnvExample({ aiProvider: 'none', database: 'postgres', deployTarget: 'local' });
    expect(result).toContain('DATABASE_URL');
  });

  it('includes Firebase config', () => {
    const result = generateEnvExample({ aiProvider: 'none', database: 'firebase', deployTarget: 'local' });
    expect(result).toContain('FIREBASE_API_KEY');
  });
});

describe('.gitignore template', () => {
  it('includes node_modules for node projects', () => {
    const result = generateGitignore('api-node');
    expect(result).toContain('node_modules');
    expect(result).toContain('.env');
    expect(result).toContain('.DS_Store');
  });

  it('includes __pycache__ for python projects', () => {
    const result = generateGitignore('api-python');
    expect(result).toContain('__pycache__');
    expect(result).toContain('.pytest_cache');
  });

  it('includes .expo for react native projects', () => {
    const result = generateGitignore('mobile-react-native');
    expect(result).toContain('.expo');
  });

  it('includes data ignores for data pipelines', () => {
    const result = generateGitignore('data-pipeline');
    expect(result).toContain('cache/');
    expect(result).toContain('data/raw/');
  });
});

describe('README template', () => {
  it('generates with project info', () => {
    const result = generateReadme({
      projectName: 'test-project',
      projectType: 'api-python',
      description: 'A test project',
      deployTarget: 'railway',
    });
    expect(result).toContain('# test-project');
    expect(result).toContain('A test project');
    expect(result).toContain('pip install');
    expect(result).toContain('CLAUDE.md');
  });
});

describe('Architecture template', () => {
  it('generates with project info', () => {
    const result = generateArchitecture('test-project', 'A test project');
    expect(result).toContain('# test-project - Architecture');
    expect(result).toContain('A test project');
    expect(result).toContain('Components');
    expect(result).toContain('Data Flow');
  });
});

describe('Security checklist template', () => {
  it('includes API checks for API projects', () => {
    const result = generateSecurityChecklist('api-python');
    expect(result).toContain('Rate limiting');
    expect(result).toContain('SQL injection');
    expect(result).toContain('Content Security Policy');
  });

  it('includes mobile checks for mobile projects', () => {
    const result = generateSecurityChecklist('mobile-react-native');
    expect(result).toContain('Certificate pinning');
    expect(result).toContain('Keychain/Keystore');
  });

  it('always includes general checks', () => {
    const result = generateSecurityChecklist('cli-tool');
    expect(result).toContain('No secrets committed');
    expect(result).toContain('Dependencies audited');
  });
});

describe('Brand voice template', () => {
  it('generates with all sections', () => {
    const result = generateBrandVoice({
      audience: 'Developers',
      toneAdjectives: ['direct', 'grounded', 'opinionated'],
      soundsLike: 'A sharp friend',
      doesNotSoundLike: 'A corporate blog',
      bannedPhrases: ['delve', 'navigate'],
      formattingRules: ['No emojis', 'Use contractions'],
      frameworks: 'Systems thinking, behavioral psychology',
    });
    expect(result).toContain('Developers');
    expect(result).toContain('direct');
    expect(result).toContain('A sharp friend');
    expect(result).toContain('A corporate blog');
    expect(result).toContain('delve');
    expect(result).toContain('No emojis');
    expect(result).toContain('Systems thinking');
    expect(result).toContain('Review Checklist');
  });

  it('omits frameworks section when empty', () => {
    const result = generateBrandVoice({
      audience: 'General',
      toneAdjectives: ['warm'],
      soundsLike: 'test',
      doesNotSoundLike: 'test',
      bannedPhrases: [],
      formattingRules: [],
      frameworks: '',
    });
    expect(result).not.toContain('Intellectual Foundations');
  });
});

describe('Design system template', () => {
  it('generates with colors and fonts', () => {
    const result = generateDesignSystem({
      brandName: 'TestBrand',
      colorMode: 'dark',
      colors: [
        { name: 'Background', hex: '#1A1A1A', usage: 'Page bg' },
        { name: 'Accent', hex: '#FF0000', usage: 'Buttons' },
        { name: 'Text', hex: '#FFFFFF', usage: 'Body text' },
      ],
      displayFont: 'Bodoni Moda',
      bodyFont: 'Inter',
      principles: ['Dark-First', 'Restraint'],
    });
    expect(result).toContain('# TestBrand - Design System');
    expect(result).toContain('#1A1A1A');
    expect(result).toContain('26, 26, 26'); // RGB conversion
    expect(result).toContain('Bodoni Moda');
    expect(result).toContain('Inter');
    expect(result).toContain('Dark-First');
    expect(result).toContain('Dark mode only');
    expect(result).toContain('--color-background');
    expect(result).toContain('--color-accent');
  });

  it('handles both color mode', () => {
    const result = generateDesignSystem({
      brandName: 'Test',
      colorMode: 'both',
      colors: [{ name: 'Bg', hex: '#000000', usage: 'bg' }],
      displayFont: 'Inter',
      bodyFont: 'Inter',
      principles: [],
    });
    expect(result).toContain('Dark and light modes supported');
  });
});
