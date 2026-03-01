import { describe, it, expect } from 'vitest';
import { generateClaudeMd } from '../src/templates/claude-md.js';

describe('generateClaudeMd', () => {
  it('generates CLAUDE.md content with project name as heading', () => {
    const result = generateClaudeMd({
      projectName: 'test',
      projectType: 'api-node',
      description: 'Test',
      deployTarget: 'local',
      aiProvider: 'none',
      database: 'none',
    });
    expect(result).toContain('# test');
  });

  it('includes run commands for the given project type', () => {
    const result = generateClaudeMd({
      projectName: 'test',
      projectType: 'api-node',
      description: 'Test',
      deployTarget: 'local',
      aiProvider: 'none',
      database: 'none',
    });
    expect(result).toContain('npm run dev');
  });
});
