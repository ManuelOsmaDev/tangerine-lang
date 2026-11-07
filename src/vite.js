// Plugin de Vite: permite importar archivos .tng desde JavaScript, React, Vue o Svelte.
//
//   // vite.config.js
//   import tangerine from "tangerine-lang/vite";
//   export default { plugins: [tangerine()] };
//
//   // main.jsx
//   import { Contador } from "./Contador.tng";
//
// Todos los .tng comparten un mismo intérprete. Si el proyecto tiene React instalado,
// se agrega el plugin "react" (h, use_state, use_effect...) automáticamente.
import path from "node:path";
import { createRequire } from "node:module";
import { parse, importsOf, isBare } from "./index.js";
import { nodeResolve, splitPackage, findPackage } from "./node.js";

const VIRTUAL = "virtual:tangerine";
const RESOLVED = "\0" + VIRTUAL;
const toPosix = (p) => p.split(path.sep).join("/");
// Nombres válidos en Tangerine que no pueden ser un export con nombre en JavaScript
const JS_RESERVED = new Set(["default", "new", "function", "const", "delete", "typeof", "void", "with", "yield", "enum",
  "case", "switch", "this", "try", "finally", "instanceof", "debugger", "export", "import", "extends", "null", "undefined", "await", "static"]);

/**
 * @param {{ react?: boolean, dom?: boolean, stepLimit?: number }} [opciones]
 */
export default function tangerine(opciones = {}) {
  let root = process.cwd();
  let useReact = opciones.react;

  return {
    name: "tangerine",
    enforce: "pre",

    configResolved(config) {
      root = config.root;
      if (useReact === undefined) {
        try { createRequire(path.join(root, "package.json")).resolve("react"); useReact = true; }
        catch { useReact = false; }
      }
    },

    resolveId(id) {
      if (id === VIRTUAL) return RESOLVED;
      return null;
    },

    load(id) {
      if (id !== RESOLVED) return null;
      const plugins = [];
      let imports = 'import { Tangerine } from "tangerine-lang";\nimport { wrapExport } from "tangerine-lang/react";\n';
      if (opciones.dom !== false) { imports += 'import { dom } from "tangerine-lang/dom";\n'; plugins.push("typeof document !== \"undefined\" ? dom() : null"); }
      if (useReact) { imports += 'import * as React from "react";\nimport { react } from "tangerine-lang/react";\n'; plugins.push("react(React)"); }
      return `${imports}
export const tng = new Tangerine({
  stepLimit: ${Number(opciones.stepLimit) || 0},
  plugins: [${plugins.join(", ")}].filter(Boolean),
  onError: (m) => console.error("Tangerine: " + m),
});
export const wrap = (v) => wrapExport(tng, v);
`;
    },

    transform(code, id) {
      const file = id.split("?")[0];
      if (!file.endsWith(".tng")) return null;
      const key = toPosix(path.relative(root, file));
      let ast;
      try { ast = parse(code, key); }
      catch (e) {
        const err = new Error(e.message);
        err.loc = { file, line: e.line || 1, column: (e.col || 1) - 1 };
        throw err;
      }

      const lines = [`import { tng, wrap } from ${JSON.stringify(VIRTUAL)};`];
      const extra = [];
      for (const spec of importsOf(ast)) {
        let dep;
        try { dep = nodeResolve(spec, file); }
        catch (e) { this.error(`${key}: ${e.message}`); }
        lines.push(`import ${JSON.stringify(toPosix(dep))};`);
        if (isBare(spec)) {
          const depKey = toPosix(path.relative(root, dep));
          extra.push(`tng.imports[${JSON.stringify(spec)}] = ${JSON.stringify(depKey)};`);
          const dir = findPackage(splitPackage(spec).name, path.dirname(file));
          if (dir) extra.push(`tng.imports[${JSON.stringify(splitPackage(spec).name + "/")}] = ${JSON.stringify(toPosix(path.relative(root, dir)) + "/")};`);
        }
      }
      const names = ast.filter((s) => s.type === "export").flatMap((s) => s.names);
      lines.push(...extra);
      lines.push(`tng.forget(${JSON.stringify(key)});`);
      lines.push(`tng.addModule(${JSON.stringify(key)}, ${JSON.stringify(code)});`);
      lines.push(`const __m = tng.import(${JSON.stringify(key)});`);
      for (const n of names.filter((x) => !JS_RESERVED.has(x))) lines.push(`export const ${n} = wrap(__m[${JSON.stringify(n)}]);`);
      lines.push("export default __m;");
      return { code: lines.join("\n"), map: null };
    },
  };
}

export { tangerine };
