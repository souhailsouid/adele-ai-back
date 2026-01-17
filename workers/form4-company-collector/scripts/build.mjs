import { build } from 'esbuild';
import { readdirSync, copyFileSync, mkdirSync } from 'fs';
import { join } from 'path';

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
    js: '// Form4 Company Collector - Built with esbuild',
  },
};

// Copy JSON files
function copyJsonFiles() {
  const srcDir = 'src';
  const distDir = 'dist';
  
  try {
    mkdirSync(distDir, { recursive: true });
    
    const files = readdirSync(srcDir);
    files.forEach(file => {
      if (file.endsWith('.json')) {
        copyFileSync(join(srcDir, file), join(distDir, file));
        console.log(`✅ Copied ${file} to dist/`);
      }
    });
  } catch (error) {
    console.error('Error copying JSON files:', error);
  }
}

// Build
console.log('🔨 Building form4-company-collector...');

build(buildOptions)
  .then(() => {
    console.log('✅ Build completed');
    copyJsonFiles();
  })
  .catch((error) => {
    console.error('❌ Build failed:', error);
    process.exit(1);
  });
