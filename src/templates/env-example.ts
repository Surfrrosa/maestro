interface EnvOptions {
  aiProvider: string;
  database: string;
  deployTarget: string;
}

function generateEnvHeader(): string[] {
  return [
    '# Environment (development, staging, production)',
    'ENVIRONMENT=development',
    '',
  ];
}

function generateAiProviderVars(provider: string): string[] {
  const lines: string[] = [];
  if (provider === 'anthropic' || provider === 'both') {
    lines.push('# Anthropic / Claude API (https://console.anthropic.com/)', 'ANTHROPIC_API_KEY=your_api_key_here', '');
  }
  if (provider === 'openai' || provider === 'both') {
    lines.push('# OpenAI API (https://platform.openai.com/api-keys)', 'OPENAI_API_KEY=your_api_key_here', '');
  }
  return lines;
}

function generateDatabaseVars(database: string): string[] {
  if (database === 'supabase') {
    return ['# Supabase (https://supabase.com/dashboard)', 'SUPABASE_URL=https://your-project.supabase.co', 'SUPABASE_ANON_KEY=your_anon_key_here', 'SUPABASE_SERVICE_KEY=your_service_key_here', ''];
  }
  if (database === 'postgres') {
    return ['# PostgreSQL', 'DATABASE_URL=postgresql://user:password@localhost:5432/dbname', ''];
  }
  if (database === 'firebase') {
    return ['# Firebase (https://console.firebase.google.com/)', 'FIREBASE_API_KEY=your_api_key_here', 'FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com', 'FIREBASE_PROJECT_ID=your-project-id', ''];
  }
  return [];
}

function generateDeployVars(deployTarget: string): string[] {
  if (deployTarget === 'railway') {
    return ['# Railway sets PORT automatically in production', 'PORT=8080', ''];
  }
  if (deployTarget === 'fly') {
    return ['# Fly.io sets PORT automatically in production', 'PORT=8080', ''];
  }
  return [];
}

function sanitizeEnvLine(options: EnvOptions): string[] {
  return [
    ...generateAiProviderVars(options.aiProvider),
    ...generateDatabaseVars(options.database),
    ...generateDeployVars(options.deployTarget),
  ];
}

export function generateEnvExample(options: EnvOptions): string {
  const lines = [
    ...generateEnvHeader(),
    ...sanitizeEnvLine(options),
  ];
  return lines.join('\n');
}
