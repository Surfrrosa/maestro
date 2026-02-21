import type { ProjectType } from './claude-md.js';

const common = `# Environment
.env
.env.local
.env.staging
.env.production

# OS
.DS_Store
Thumbs.db

# IDE
.idea/
.vscode/
*.swp
*.swo

# Generated output
*.pdf
`;

const nodeIgnores = `# Node
node_modules/
dist/
build/
.next/
*.tgz
coverage/
`;

const pythonIgnores = `# Python
__pycache__/
*.pyc
*.pyo
.pytest_cache/
*.egg-info/
venv/
.venv/
`;

const reactNativeIgnores = `# React Native / Expo
node_modules/
dist/
.expo/
ios/Pods/
android/.gradle/
android/app/build/
*.jks
*.keystore
`;

const dataIgnores = `# Data
*.csv
*.json.bak
cache/
data/raw/
`;

export function generateGitignore(projectType: ProjectType): string {
  const sections = [common];

  switch (projectType) {
    case 'api-node':
    case 'frontend-next':
    case 'frontend-static':
    case 'cli-tool':
      sections.push(nodeIgnores);
      break;
    case 'api-python':
    case 'data-pipeline':
      sections.push(pythonIgnores);
      break;
    case 'mobile-react-native':
      sections.push(reactNativeIgnores);
      break;
  }

  if (projectType === 'data-pipeline') {
    sections.push(dataIgnores);
  }

  return sections.join('\n');
}
