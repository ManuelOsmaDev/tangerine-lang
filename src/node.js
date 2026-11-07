// Utilidades para usar Tangerine en Node.js: leer archivos .tng del disco y el plugin "sistema".
import fs from "node:fs";
import path from "node:path";
import { Tangerine, TngError, isBare } from "./index.js";

/** Separa "paquete/sub/ruta" o "@org/paquete/sub" en nombre y subruta. */
export function splitPackage(spec) {
  const parts = spec.split("/");
  const n = spec.startsWith("@") ? 2 : 1;
  return { name: parts.slice(0, n).join("/"), sub: parts.slice(n).join("/") };
}

/** Archivo de entrada de un paquete: campo "tangerine" de package.json, o index.tng. */
export function packageEntry(dir) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
    if (typeof pkg.tangerine === "string") return path.join(dir, pkg.tangerine);
    if (typeof pkg.main === "string" && pkg.main.endsWith(".tng")) return path.join(dir, pkg.main);
  } catch { /* sin package.json */ }
  return path.join(dir, "index.tng");
}

/** Busca node_modules/<nombre> subiendo desde `desde`. */
export function findPackage(name, desde) {
  let dir = desde;
  for (;;) {
    const candidate = path.join(dir, "node_modules", name);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Resolutor de rutas de import con el sistema de archivos real (incluye paquetes en node_modules). */
export function nodeResolve(spec, from) {
  const base = from ? path.dirname(from) : process.cwd();
  // Sin "desde" es un archivo de entrada: siempre relativo a la carpeta actual
  if (from && isBare(spec) && !/^[A-Za-z]:[\\/]/.test(spec)) {
    const { name, sub } = splitPackage(spec);
    const dir = findPackage(name, base);
    if (!dir) throw new TngError(`No se encontró el paquete '${name}'. Instálalo con: tangerine add ${name}`);
    if (!sub) return packageEntry(dir);
    const full = path.join(dir, sub);
    return path.extname(full) ? full : full + ".tng";
  }
  let full = path.resolve(base, spec);
  if (!path.extname(full)) full += ".tng";
  return full;
}

/** Lee un módulo del disco. Devuelve null si no existe. */
export function nodeRead(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

/**
 * Plugin "sistema": archivos, argumentos y variables de entorno.
 * @param {{ args?: string[] }} [opciones]
 */
export function sistema(opciones = {}) {
  return {
    name: "sistema",
    install(tng) {
      tng.defineAll({
        read_file: (p) => fs.readFileSync(String(p), "utf8"),
        write_file: (p, contenido) => { fs.writeFileSync(String(p), tng.show(contenido)); return null; },
        file_exists: (p) => fs.existsSync(String(p)),
        list_dir: (p) => fs.readdirSync(String(p == null ? "." : p)),
        args: () => (opciones.args || []).slice(),
        env: (nombre) => (process.env[String(nombre)] ?? null),
        exit: (codigo) => process.exit(codigo == null ? 0 : codigo),
        now: () => performance.now(),
      });
    },
  };
}

/** Crea un intérprete listo para Node: lee imports del disco e instala el plugin "sistema". */
export function createNodeTangerine(opciones = {}) {
  const { args, ...resto } = opciones;
  return new Tangerine({
    resolve: nodeResolve,
    read: nodeRead,
    ...resto,
    plugins: [sistema({ args }), ...(resto.plugins || [])],
  });
}

/** Ejecuta un archivo .tng del disco. */
export function runFile(archivo, opciones = {}) {
  const tng = createNodeTangerine(opciones);
  return tng.runModule(path.resolve(archivo));
}

export { Tangerine };
export default Tangerine;
