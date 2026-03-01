import { describe, it, expect } from 'vitest';
import { generateReadme } from '../src/templates/readme.js';

describe('generateReadme', () => {
  it('generates README content with project name as heading', () => {
    const result = generateReadme({
      projectName: 'test',
      projectType: 'api-node',
      description: 'A test',
      deployTarget: 'local',
    });
    expect(result).toContain('# test');
  });

  it('includes the project description', () => {
    const result = generateReadme({
      projectName: 'test',
      projectType: 'api-node',
      description: 'A test',
      deployTarget: 'local',
    });
    expect(result).toContain('A test');
  });
});
