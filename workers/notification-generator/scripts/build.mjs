import { build } from "esbuild";
import { mkdir } from "fs/promises";
import { join } from "path";

const outDir = join(process.cwd(), "dist");
await mkdir(outDir, { recursive: true });

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: "dist/index.js",
  external: ["@aws-sdk/*"],
  minify: true,
  sourcemap: false,
});

console.log("✅ Build completed: dist/index.js");
