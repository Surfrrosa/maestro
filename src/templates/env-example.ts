interface EnvOptions {
  aiProvider: string;
  database: string;
  deployTarget: string;
}

export function generateEnvExample(options: EnvOptions): string {
  const lines: string[] = [
    '# Environment (development, staging, production)',
    'ENVIRONMENT=development',
    '',
  ];

  if (options.aiProvider === 'anthropic' || options.aiProvider === 'both') {
    lines.push('# Anthropic / Claude API (https://console.anthropic.com/)');
    lines.push('ANTHROPIC_API_KEY=your_api_key_here');
    lines.push('');
  }

  if (options.aiProvider === 'openai' || options.aiProvider === 'both') {
    lines.push('# OpenAI API (https://platform.openai.com/api-keys)');
    lines.push('OPENAI_API_KEY=your_api_key_here');
    lines.push('');
  }

  if (options.database === 'supabase') {
    lines.push('# Supabase (https://supabase.com/dashboard)');
    lines.push('SUPABASE_URL=https://your-project.supabase.co');
    lines.push('SUPABASE_ANON_KEY=your_anon_key_here');
    lines.push('SUPABASE_SERVICE_KEY=your_service_key_here');
    lines.push('');
  }

  if (options.database === 'postgres') {
    lines.push('# PostgreSQL');
    lines.push('DATABASE_URL=postgresql://user:password@localhost:5432/dbname');
    lines.push('');
  }

  if (options.database === 'firebase') {
    lines.push('# Firebase (https://console.firebase.google.com/)');
    lines.push('FIREBASE_API_KEY=your_api_key_here');
    lines.push('FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com');
    lines.push('FIREBASE_PROJECT_ID=your-project-id');
    lines.push('');
  }

  if (options.deployTarget === 'railway') {
    lines.push('# Railway sets PORT automatically in production');
    lines.push('PORT=8080');
    lines.push('');
  }

  if (options.deployTarget === 'fly') {
    lines.push('# Fly.io sets PORT automatically in production');
    lines.push('PORT=8080');
    lines.push('');
  }

  return lines.join('\n');
}
