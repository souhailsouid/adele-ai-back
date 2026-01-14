import { build } from "esbuild";

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
