// Genera dist/: ESM, CommonJS y el bundle global para el navegador.
import { build } from "esbuild";
import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const banner = `/*! Tangerine ${pkg.version} | MIT */`;
const common = { bundle: true, target: "es2020", banner: { js: banner }, logLevel: "warning" };

fs.rmSync(new URL("../dist", import.meta.url), { recursive: true, force: true });

await Promise.all([
  build({ ...common, entryPoints: ["src/index.js"], format: "esm", outfile: "dist/tangerine.mjs" }),
  build({ ...common, entryPoints: ["src/index.js"], format: "cjs", outfile: "dist/tangerine.cjs", footer: { js: "module.exports = Object.assign(module.exports.default, module.exports);" } }),
  build({ ...common, entryPoints: ["src/navegador.js"], format: "iife", outfile: "dist/tangerine.global.js" }),
  build({ ...common, entryPoints: ["src/navegador.js"], format: "iife", outfile: "dist/tangerine.global.min.js", minify: true }),
]);

for (const f of fs.readdirSync("dist")) {
  const kb = (fs.statSync(`dist/${f}`).size / 1024).toFixed(1);
  console.log(`  dist/${f}  ${kb} KB`);
}
