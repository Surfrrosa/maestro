import type { ProjectType } from './claude-md.js';

interface ReadmeOptions {
  projectName: string;
  projectType: ProjectType;
  description: string;
  deployTarget: string;
}

const setupByType: Record<ProjectType, string> = {
  'api-python': `\`\`\`bash
# Clone and install
git clone <repo-url>
cd <project>
pip install -r requirements.txt

# Set up environment
cp .env.example .env
# Fill in your values

# Run
uvicorn src.api.main:app --reload
\`\`\``,
  'api-node': `\`\`\`bash
# Clone and install
git clone <repo-url>
cd <project>
npm install

# Set up environment
cp .env.example .env
# Fill in your values

# Run
npm run dev
\`\`\``,
  'frontend-next': `\`\`\`bash
# Clone and install
git clone <repo-url>
cd <project>
npm install

# Set up environment
cp .env.example .env
# Fill in your values

# Run
npm run dev
\`\`\``,
  'frontend-static': `\`\`\`bash
# Clone and serve
git clone <repo-url>
cd <project>
npx serve .
\`\`\``,
  'mobile-react-native': `\`\`\`bash
# Clone and install
git clone <repo-url>
cd <project>
npm install

# Set up environment
cp .env.example .env
# Fill in your values

# Run
npx expo start
\`\`\``,
  'data-pipeline': `\`\`\`bash
# Clone and install
git clone <repo-url>
cd <project>
pip install -r requirements.txt

# Set up environment
cp .env.example .env
# Fill in your values

# Run
python -m src.pipeline.main
\`\`\``,
  'cli-tool': `\`\`\`bash
# Clone and install
git clone <repo-url>
cd <project>
npm install

# Build and run
npm run build
node dist/bin/cli.js
\`\`\``,
};

export function generateReadme(options: ReadmeOptions): string {
  return `# ${options.projectName}

${options.description}

## Setup

${setupByType[options.projectType]}

## Project Structure

\`\`\`
${options.projectName}/
├── CLAUDE.md                # AI session instructions
├── .env.example             # Environment variable template
├── docs/
│   ├── ARCHITECTURE.md      # System design
│   ├── SECURITY_CHECKLIST.md
│   └── sessions/            # Development session logs
└── README.md                # This file
\`\`\`

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Security](docs/SECURITY_CHECKLIST.md)
- [Session Logs](docs/sessions/README.md)

## Development

This project uses AI-native development practices. Before starting any session:

1. Read the latest session log in \`docs/sessions/\`
2. Review \`CLAUDE.md\` for project rules and conventions
3. Write a session log before ending your session
`;
}
