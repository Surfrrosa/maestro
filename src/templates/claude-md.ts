export type ProjectType = 'api-python' | 'api-node' | 'frontend-next' | 'frontend-static' | 'mobile-react-native' | 'data-pipeline' | 'cli-tool';

interface ClaudeMdOptions {
  projectName: string;
  projectType: ProjectType;
  description: string;
  deployTarget: string;
  aiProvider: string;
  database: string;
}

const runCommands: Record<ProjectType, string> = {
  'api-python': `\`\`\`bash
# Install dependencies
pip install -r requirements.txt

# Start dev server
uvicorn src.api.main:app --reload

# Run tests
python -m pytest tests/ -x
\`\`\``,
  'api-node': `\`\`\`bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npm test
\`\`\``,
  'frontend-next': `\`\`\`bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Run tests
npm test
\`\`\``,
  'frontend-static': `\`\`\`bash
# Serve locally
npx serve .

# Or open index.html directly in browser
\`\`\``,
  'mobile-react-native': `\`\`\`bash
# Install dependencies
npm install

# Start Expo dev server
npx expo start

# Run on iOS simulator
npx expo run:ios

# Run on Android emulator
npx expo run:android

# Run tests
npm test
\`\`\``,
  'data-pipeline': `\`\`\`bash
# Install dependencies
pip install -r requirements.txt

# Run pipeline
python -m src.pipeline.main

# Run tests
python -m pytest tests/ -x
\`\`\``,
  'cli-tool': `\`\`\`bash
# Install dependencies
npm install

# Build
npm run build

# Run locally
node dist/bin/cli.js

# Run tests
npm test
\`\`\``,
};

const securitySection: Record<string, string> = {
  web: `## Security

### Content Security Policy
Update CSP headers when adding new external services:

| Service | Domains needed |
|---------|---------------|
| (add as needed) | |

### Checklist
- [ ] CSP headers configured
- [ ] Rate limiting enabled
- [ ] Auth endpoints hardened
- [ ] Input sanitization on all user inputs
- [ ] CORS configured for allowed origins only
- [ ] No secrets in client-side code
`,
  api: `## Security

### Checklist
- [ ] Rate limiting on all public endpoints
- [ ] Input validation on all request bodies
- [ ] Auth middleware on protected routes
- [ ] No secrets in version control
- [ ] CORS configured for allowed origins only
- [ ] SQL injection prevention (parameterized queries)
`,
  mobile: `## Security

### Checklist
- [ ] API keys not hardcoded in app bundle
- [ ] Certificate pinning configured
- [ ] Sensitive data stored in secure storage (Keychain/Keystore)
- [ ] No secrets in version control
- [ ] Deep link validation
`,
  default: `## Security

### Checklist
- [ ] No secrets in version control
- [ ] Dependencies audited for vulnerabilities
- [ ] Input validation on external data
`,
};

function getSecurityType(projectType: ProjectType): string {
  if (projectType.includes('frontend') || projectType === 'frontend-static') return 'web';
  if (projectType.includes('api')) return 'api';
  if (projectType === 'mobile-react-native') return 'mobile';
  return 'default';
}

function generateCspSection(projectType: ProjectType): string {
  const secType = getSecurityType(projectType);
  return securitySection[secType];
}

function generateDependencySection(): string {
  return `## Dependencies

All dependencies must be pinned to exact versions. No \`^\` or \`~\` prefixes.

When adding a dependency:
1. Verify it's necessary (don't add libraries for one-time operations)
2. Pin the exact version
3. Document why it was added if non-obvious`;
}

export function generateClaudeMd(options: ClaudeMdOptions): string {
  return `# ${options.projectName}

${options.description}

## Session Protocol

**Before starting any work, read the latest session log in \`docs/sessions/\`.**

Write a session log before ending every session. Format: \`docs/sessions/YYYY-MM-DD_session.md\`

## Key Files

| File | Purpose |
|------|---------|
| CLAUDE.md | This file. Project instructions for AI sessions. |
| docs/sessions/ | Session logs for continuity between sessions |
| docs/ARCHITECTURE.md | System architecture and data flows |
| docs/SECURITY_CHECKLIST.md | Security requirements and status |
| .env.example | Required environment variables |

## Running

${runCommands[options.projectType]}

## Domain Rules

<!-- Add project-specific rules here. Examples: -->
<!-- - NEVER guess data. Always verify computationally. -->
<!-- - Use this naming convention for X. -->
<!-- - This module should never import from that module. -->

## Known Technical Debt

<!-- Track technical debt explicitly. Example: -->
<!-- ### Duplicated template code (Medium) -->
<!-- Pages share boilerplate that should be extracted. -->
<!-- Files affected: src/pages/*.html -->
<!-- Estimated effort: 4-6 hours -->

${generateDependencySection()}

${generateCspSection(options.projectType)}
`;
}
