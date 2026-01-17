import { build } from 'esbuild';
import { readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Copier les fichiers depuis shared-utils
import { copyFileSync, mkdirSync } from 'fs';

const sharedUtilsSrc = join(__dirname, '../../shared-utils/src');
const sharedUtilsDist = join(__dirname, '../dist/shared-utils');

// Créer le dossier de destination
mkdirSync(sharedUtilsDist, { recursive: true });

// Copier les fichiers TypeScript (esbuild les compilera)
const files = ['sec-client.ts', 'athena-client.ts'];
for (const file of files) {
  copyFileSync(
    join(sharedUtilsSrc, file),
    join(sharedUtilsDist, file)
  );
}

// Build
await build({
  entryPoints: ['src/index.ts', 'dist/shared-utils/sec-client.ts', 'dist/shared-utils/athena-client.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outdir: 'dist',
  external: ['@aws-sdk/*'],
  sourcemap: false,
  minify: false,
});

console.log('✅ Build completed');
