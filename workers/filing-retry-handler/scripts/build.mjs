import { build } from "esbuild";
import { mkdir } from "fs/promises";
import { join } from "path";
import { createWriteStream } from "fs";
import archiver from "archiver";

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

// Créer le zip pour Lambda
const zipPath = join(process.cwd(), "filing-retry-handler.zip");
const output = createWriteStream(zipPath);
const archive = archiver("zip", { zlib: { level: 9 } });

await new Promise((resolve, reject) => {
  output.on("close", () => {
    console.log(`✅ Zip created: ${zipPath} (${archive.pointer()} bytes)`);
    resolve();
  });

  archive.on("error", (err) => {
    reject(err);
  });

  archive.pipe(output);
  archive.file("dist/index.js", { name: "index.js" });
  archive.finalize();
});
