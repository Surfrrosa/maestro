import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['bin/maestro.ts'],
    format: ['esm'],
    target: 'node18',
    outDir: 'dist/bin',
    clean: true,
    splitting: false,
    sourcemap: true,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
  {
    entry: [
      'src/templates/claude-md.ts',
      'src/templates/session-log.ts',
      'src/templates/session-index.ts',
      'src/templates/env-example.ts',
      'src/templates/gitignore.ts',
      'src/templates/readme.ts',
      'src/templates/architecture.ts',
      'src/templates/security.ts',
      'src/templates/brand-voice.ts',
      'src/templates/design-system.ts',
      'src/utils/fs.ts',
      'src/utils/format.ts',
    ],
    format: ['esm'],
    target: 'node18',
    outDir: 'dist',
    dts: true,
    splitting: false,
    sourcemap: true,
  },
]);
