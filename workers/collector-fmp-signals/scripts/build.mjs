import { build } from 'esbuild';
import { readdir } from 'fs/promises';
import { join } from 'path';

const entryPoints = ['src/index.ts'];

build({
  entryPoints,
  bundle: true,
  outdir: 'dist',
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  external: ['@aws-sdk/*'],
  minify: true,
  sourcemap: false,
}).catch(() => process.exit(1));


