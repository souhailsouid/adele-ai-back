import { build } from "esbuild";
import { mkdir } from "fs/promises";
import { dirname } from "path";

// Créer le dossier dist si nécessaire
await mkdir("dist", { recursive: true });
await mkdir("dist/handlers", { recursive: true });

// Build tous les handlers nécessaires pour les différentes Lambdas
const entryPoints = [
  { 
    input: "src/index.ts",
    output: "dist/index.cjs",
    handler: "index.handler"
  },
  { 
    input: "src/handlers/api-fast.handler.ts",
    output: "dist/handlers/api-fast.handler.cjs",
    handler: "handlers/api-fast.handler"
  },
  { 
    input: "src/handlers/api-ai-heavy.handler.ts",
    output: "dist/handlers/api-ai-heavy.handler.cjs",
    handler: "handlers/api-ai-heavy.handler"
  },
  { 
    input: "src/handlers/api-funds.handler.ts",
    output: "dist/handlers/api-funds.handler.cjs",
    handler: "handlers/api-funds.handler"
  },
];

import { readFileSync, writeFileSync } from 'fs';

for (const { input, output } of entryPoints) {
  await mkdir(dirname(output), { recursive: true });
  
  await build({
    entryPoints: [input],
    outfile: output,
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    sourcemap: false,
    // Exclure parquetjs du bundle - il sera fourni par la Lambda Layer
    external: ["parquetjs"],
  });
  
  // Fix CommonJS export: esbuild génère parfois `0 && (module.exports = {...})`
  // On force l'export en remplaçant cette ligne par un export valide
  const content = readFileSync(output, 'utf-8');
  const fixedContent = content.replace(
    /0\s*&&\s*\(module\.exports\s*=\s*\{[\s\S]*?\}\);/g,
    'module.exports = { handler };'
  );
  
  // Si le fichier contient déjà un export valide, on ne modifie pas
  if (fixedContent !== content || !content.includes('module.exports')) {
    // Si aucun export trouvé, ajouter un export par défaut
    if (!content.includes('module.exports')) {
      const handlerMatch = content.match(/var\s+handler\s*=\s*async/);
      if (handlerMatch) {
        writeFileSync(output, content + '\nmodule.exports = { handler };', 'utf-8');
        console.log(`✅ Fixed export for: ${output}`);
      } else {
        console.log(`⚠️  Could not find handler in: ${output}`);
      }
    } else {
      writeFileSync(output, fixedContent, 'utf-8');
      console.log(`✅ Fixed export for: ${output}`);
    }
  }
  
  console.log(`✅ Built: ${input} -> ${output}`);
}
