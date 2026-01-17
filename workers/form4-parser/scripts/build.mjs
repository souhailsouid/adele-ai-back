import { build } from "esbuild";
import { execSync } from "child_process";
import { existsSync, unlinkSync } from "fs";

// Builder le Lambda
await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.cjs",
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  sourcemap: false,
  external: ["@aws-sdk/*"],
});

console.log("✅ Build completed");

// Créer le zip pour Terraform
console.log("📦 Creating form4-parser.zip...");
if (existsSync("form4-parser.zip")) {
  unlinkSync("form4-parser.zip");
}
execSync("cd dist && zip -q ../form4-parser.zip index.cjs ../package.json", { stdio: "inherit" });
console.log("✅ Zip created: form4-parser.zip");
