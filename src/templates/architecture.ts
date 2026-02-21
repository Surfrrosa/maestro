export function generateArchitecture(projectName: string, description: string): string {
  return `# ${projectName} - Architecture

## Overview

${description}

## System Diagram

\`\`\`
┌─────────────────────────────────────────────┐
│                                             │
│              (diagram here)                 │
│                                             │
│   Replace this with your system diagram.    │
│   Show components, data flows, and          │
│   external service connections.             │
│                                             │
└─────────────────────────────────────────────┘
\`\`\`

## Components

| Component | Purpose | Location |
|-----------|---------|----------|
| | | |

## External Services

| Service | Purpose | Credentials |
|---------|---------|-------------|
| | | See .env.example |

## Data Flow

1. (describe the primary data flow through your system)

## Key Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| | | |
`;
}
