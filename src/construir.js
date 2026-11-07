// Empaqueta un proyecto de Tangerine en un solo index.html que funciona sin servidor.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse, importsOf, isBare, VERSION } from "./index.js";
import { nodeResolve, splitPackage, findPackage } from "./node.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const RUNTIME_FILE = path.join(here, "..", "dist", "tangerine.global.min.js");

const DEFAULTS = {
  entry: "src/main.tng",
  out: "dist/index.html",
  title: "App de Tangerine",
  lang: "es",
  styles: [],
  scripts: [],
  head: "",
  body: '<div id="app"></div>',
  runtime: "inline",
};

/** Lee tangerine.json de una carpeta (si existe) y lo combina con los valores por defecto. */
export function loadConfig(dir, overrides = {}) {
  const file = path.join(dir, "tangerine.json");
  let config = {};
  if (fs.existsSync(file)) {
    try { config = JSON.parse(fs.readFileSync(file, "utf8")); }
    catch (e) { throw new Error(`tangerine.json no es JSON válido: ${e.message}`); }
  }
  const clean = Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== undefined));
  return { ...DEFAULTS, ...config, ...clean, root: dir };
}

const toPosix = (p) => p.split(path.sep).join("/");
const escapeScript = (s) => s.replace(/<\/(script)/gi, "<\\/$1");
const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Recorre los imports desde el archivo de entrada.
 * Los paquetes (imports sin ./) se anotan en `imports`, un mapa nombre -> clave para el navegador.
 * @returns {{ key: string, file: string, source: string }[]} módulos en orden de dependencia
 */
export function collectModules(root, entry, imports = {}) {
  const result = [];
  const seen = new Map();
  const visit = (file, chain) => {
    const key = toPosix(path.relative(root, file));
    if (seen.has(key)) return key;
    if (chain.includes(key)) throw new Error(`Importación circular: ${[...chain, key].join(" -> ")}`);
    if (!fs.existsSync(file)) {
      const desde = chain.length ? ` (importado desde ${chain[chain.length - 1]})` : "";
      throw new Error(`No se encontró el módulo ${key}${desde}`);
    }
    const source = fs.readFileSync(file, "utf8");
    let deps = [];
    try { deps = importsOf(parse(source, key)); }
    catch (e) { throw new Error(`${key}: ${e.tngMessage || e.message}`); }
    for (const d of deps) {
      let dep;
      try { dep = nodeResolve(d, file); }
      catch (e) { throw new Error(`${key}: ${e.message}`); }
      const depKey = visit(dep, [...chain, key]);
      if (isBare(d)) {
        imports[d] = depKey;
        const { name } = splitPackage(d);
        const dir = findPackage(name, path.dirname(file));
        if (dir) imports[name + "/"] = toPosix(path.relative(root, dir)) + "/";
      }
    }
    seen.set(key, true);
    result.push({ key, file, source });
    return key;
  };
  visit(path.resolve(root, entry), []);
  return result;
}

function runtimeTag(config) {
  if (config.runtime === "cdn")
    return `<script src="https://cdn.jsdelivr.net/npm/tangerine-lang@${VERSION}/dist/tangerine.global.min.js"></script>`;
  if (!fs.existsSync(RUNTIME_FILE))
    throw new Error("Falta dist/tangerine.global.min.js. Ejecuta `npm run build` en el paquete tangerine-lang.");
  return `<script id="tangerine-runtime">\n${escapeScript(fs.readFileSync(RUNTIME_FILE, "utf8").trim())}\n</script>`;
}

/**
 * Construye el HTML del proyecto.
 * @param {object} config resultado de loadConfig
 * @param {{ dev?: boolean }} [opciones] dev agrega recarga automática
 * @returns {{ html: string, out: string, modules: string[], files: string[] }}
 */
export function build(config, opciones = {}) {
  const root = config.root;
  const imports = {};
  const modules = collectModules(root, config.entry, imports);
  const read = (f) => fs.readFileSync(path.resolve(root, f), "utf8");
  const styles = config.styles.map((f) => `<style>\n${read(f).trim()}\n</style>`).join("\n");
  const scripts = config.scripts.map((f) => `<script>\n${escapeScript(read(f).trim())}\n</script>`).join("\n");
  const entryKey = modules[modules.length - 1].key;
  const tngScripts = modules
    .map((m) => `<script type="text/tangerine" data-module="${escapeHtml(m.key)}"${m.key === entryKey ? " data-main" : ""}>\n${escapeScript(m.source.trimEnd())}\n</script>`)
    .join("\n");
  const importMap = Object.keys(imports).length
    ? `<script type="application/json" id="tangerine-imports">${escapeScript(JSON.stringify(imports))}</script>\n`
    : "";
  const live = opciones.dev
    ? `<script>new EventSource("/__tangerine_recarga").onmessage = () => location.reload();</script>`
    : "";

  const html = `<!doctype html>
<html lang="${escapeHtml(config.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Tangerine ${VERSION}">
<title>${escapeHtml(config.title)}</title>
${config.head || ""}
${styles}
</head>
<body>
${config.body}
${runtimeTag(config)}
${scripts}
${importMap}${tngScripts}
${live}
</body>
</html>
`.replace(/\n{3,}/g, "\n\n");

  const out = path.resolve(root, config.out);
  const files = [...modules.map((m) => m.file), ...config.styles.map((f) => path.resolve(root, f)), ...config.scripts.map((f) => path.resolve(root, f))];
  return { html, out, modules: modules.map((m) => m.key), files };
}

/** Construye y escribe el archivo de salida. */
export function buildToDisk(config, opciones) {
  const r = build(config, opciones);
  fs.mkdirSync(path.dirname(r.out), { recursive: true });
  fs.writeFileSync(r.out, r.html);
  return r;
}

/**
 * Construye un solo archivo JavaScript con el intérprete y los módulos del proyecto.
 * Al cargarlo se registran los @Component como Web Components, listos para usar
 * en cualquier página o en un proyecto de Angular, React, Vue o Svelte.
 * @param {object} config resultado de loadConfig
 * @returns {{ js: string, out: string, modules: string[], components: string[] }}
 */
export function buildComponents(config, salida) {
  const root = config.root;
  const imports = {};
  const modules = collectModules(root, config.entry, imports);
  if (!fs.existsSync(RUNTIME_FILE))
    throw new Error("Falta dist/tangerine.global.min.js. Ejecuta `npm run build` en el paquete tangerine-lang.");
  const read = (f) => fs.readFileSync(path.resolve(root, f), "utf8");
  const css = config.styles.map((f) => read(f).trim()).join("\n");
  const fuentes = Object.fromEntries(modules.map((m) => [m.key, m.source]));
  const entryKey = modules[modules.length - 1].key;
  const components = [...new Set(modules.flatMap((m) => [...m.source.matchAll(/@Component\(\s*"([^"]+)"/g)].map((x) => x[1])))];

  const js = `/*! Componentes hechos con Tangerine ${VERSION}: ${components.join(", ") || "(sin @Component)"} */
${fs.readFileSync(RUNTIME_FILE, "utf8").trim()}
${config.scripts.map((f) => read(f).trim()).join("\n")}
;(function () {
  var T = globalThis.Tangerine;
  var css = ${JSON.stringify(css)};
  if (css && typeof document !== "undefined") {
    var s = document.createElement("style");
    s.setAttribute("data-tangerine", "");
    s.textContent = css;
    document.head.appendChild(s);
  }
  var tng = new T({ imports: ${JSON.stringify(imports)}, modules: ${JSON.stringify(fuentes)} });
  T.componentes = tng;
  try { tng.import(${JSON.stringify(entryKey)}); }
  catch (e) { console.error("Tangerine: " + (e && e.message)); }
})();
`;
  const out = path.resolve(root, salida || "dist/componentes.js");
  return { js, out, modules: modules.map((m) => m.key), components };
}

/** Construye los componentes y escribe el archivo. */
export function buildComponentsToDisk(config, salida) {
  const r = buildComponents(config, salida);
  fs.mkdirSync(path.dirname(r.out), { recursive: true });
  fs.writeFileSync(r.out, r.js);
  return r;
}
