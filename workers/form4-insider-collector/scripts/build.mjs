import { build } from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';

// Build options
const buildOptions = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: 'dist/index.cjs',
  minify: isProduction,
  sourcemap: !isProduction,
  external: ['@aws-sdk/*'],
  banner: {
    js: '// Form4 Insider Collector - Built with esbuild',
  },
};

// Build
console.log('🔨 Building form4-insider-collector...');

build(buildOptions)
  .then(() => {
    console.log('✅ Build completed');
    
    // Copier monitored-entities.json depuis form4-company-collector
    // __dirname pointe vers scripts/, donc on remonte de 2 niveaux pour aller à workers/
    const workersDir = path.join(__dirname, '../..');
    const sourceJson = path.join(workersDir, 'form4-company-collector/src/monitored-entities.json');
    const destJson = path.join(__dirname, '../dist/monitored-entities.json');
    
    if (fs.existsSync(sourceJson)) {
      fs.copyFileSync(sourceJson, destJson);
      console.log('✅ Copied monitored-entities.json to dist/');
    } else {
      console.warn('⚠️  monitored-entities.json not found, Lambda will try to load from multiple paths');
    }
  })
  .catch((error) => {
    console.error('❌ Build failed:', error);
    process.exit(1);
  });
