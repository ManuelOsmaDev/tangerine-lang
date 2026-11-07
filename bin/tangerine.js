#!/usr/bin/env node
// CLI de Tangerine: ejecutar, revisar, crear, construir y servir proyectos.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import readline from "node:readline";
import { createNodeTangerine, nodeResolve } from "../src/node.js";
import { parse, show, VERSION, TngError } from "../src/index.js";
import { loadConfig, buildToDisk, buildComponentsToDisk } from "../src/construir.js";
import { cmdNew, cmdInstall, cmdDoctor, cmdAdd, cmdRemove, cmdBuscar, cmdVscode } from "../src/herramientas.js";

const color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (s) => (color ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const naranja = paint("38;5;208"), rojo = paint("31"), gris = paint("90"), verde = paint("32"), negrita = paint("1");

const AYUDA = `
${naranja("Tangerine")} ${VERSION}: un lenguaje pequeño con la sintaxis de Rust y Swift

${negrita("Programar")}
  tangerine                          abre el REPL interactivo
  tangerine <archivo.tng> [args]     ejecuta un archivo (también: tangerine run)
  tangerine check <archivos...>      revisa la sintaxis sin ejecutar

${negrita("Proyectos")}
  tangerine new <carpeta>            crea un proyecto web en Tangerine
  tangerine new <carpeta> --con X    usa otra plantilla: react, vue, svelte, angular,
                                     next, astro, expo, swift, flutter, consola, paquete
  tangerine new --lista              muestra todas las plantillas
  tangerine build                    empaqueta el proyecto en un solo HTML
  tangerine dev                      construye, sirve y recarga al guardar
  tangerine serve [carpeta]          sirve archivos estáticos

${negrita("Paquetes de Tangerine")}
  tangerine add <paquete...>         instala paquetes de npm o de GitHub (usuario/repo)
  tangerine remove <paquete...>      los desinstala
  tangerine buscar [texto]           busca paquetes de Tangerine en npm

${negrita("Herramientas")}
  tangerine install <nombre...>      instala node, git, swift, python, angular, vscode…
  tangerine install --lista          muestra todo lo que puede instalar
  tangerine doctor                   revisa qué tienes instalado
  tangerine vscode                   instala la extensión de Tangerine en VS Code

${negrita("Opciones")}
  --limite <n>       máximo de pasos al ejecutar (por defecto, sin límite)
  -p, --puerto <n>   puerto para dev y serve (por defecto 3000 y 8000)
  -o, --salida <f>   archivo de salida de build
  --entrada <f>      archivo de entrada de build
  --cdn              build carga el intérprete desde jsDelivr en vez de incluirlo
  --componentes      build genera dist/componentes.js con tus @Component, para Angular o React
  --con <plantilla>  plantilla para new
  --sin-tangerine    en plantillas de Vite, no agrega el plugin de Tangerine
  --si               install no pregunta antes de ejecutar
  --forzar           install reinstala aunque ya exista
  --dev              add instala como dependencia de desarrollo
  -v, --version      muestra la versión
  -h, --ayuda        muestra esta ayuda
`;

function parseArgs(argv) {
  const flags = {}, rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) fail(`Falta el valor de ${a}`);
      return argv[++i];
    };
    if (a === "--") { rest.push(...argv.slice(i + 1)); break; }
    else if (a === "--limite") flags.limite = Number(next());
    else if (a === "-p" || a === "--puerto") flags.puerto = Number(next());
    else if (a === "-o" || a === "--salida") flags.salida = next();
    else if (a === "--entrada") flags.entrada = next();
    else if (a === "--cdn") flags.cdn = true;
    else if (a === "--componentes" || a === "--components") flags.componentes = true;
    else if (a === "--con") flags.con = next().toLowerCase();
    else if (a === "--lista") flags.lista = true;
    else if (a === "--sin-tangerine") flags.sinTangerine = true;
    else if (a === "--si" || a === "-y" || a === "--yes") flags.si = true;
    else if (a === "--forzar") flags.forzar = true;
    else if (a === "--dev" || a === "-D") flags.dev = true;
    else if (a === "-v" || a === "--version") flags.version = true;
    else if (a === "-h" || a === "--ayuda" || a === "--help") flags.ayuda = true;
    else if (a.startsWith("-") && rest.length === 0) fail(`Opción desconocida: ${a}`);
    else rest.push(a);
  }
  return { flags, rest };
}

function fail(msg, code = 1) {
  console.error(rojo("error: ") + msg);
  process.exit(code);
}

/** Muestra un error de Tangerine con la línea de código y una flecha en la columna. */
function reportError(tng, err) {
  if (err instanceof TngError && err.file && path.isAbsolute(err.file)) {
    const abs = err.file;
    err.file = path.relative(process.cwd(), abs) || abs;
    console.error(rojo("error: ") + tng.message(err));
    const src = fs.existsSync(abs) ? fs.readFileSync(abs, "utf8").split(/\r?\n/) : null;
    if (src && err.line && src[err.line - 1] !== undefined) {
      const num = String(err.line);
      console.error(gris(`  ${num} │ `) + src[err.line - 1]);
      if (err.col) console.error(gris(`  ${" ".repeat(num.length)} │ `) + " ".repeat(err.col - 1) + rojo("^"));
    }
    printTrace(tng, err);
    return;
  }
  console.error(rojo("error: ") + tng.message(err));
  printTrace(tng, err);
}

function printTrace(tng, err) {
  const rel = (t) => t.replace(/(^|llamada en )(\/[^,]+|[A-Za-z]:\\[^,]+)/, (_m, a, p) => a + (path.relative(process.cwd(), p) || p));
  for (const linea of tng.trace(err)) console.error(gris("  " + rel(linea)));
}

function cmdRun(file, args, flags) {
  if (!file) fail("Indica el archivo a ejecutar: tangerine run main.tng");
  const full = nodeResolve(file, null);
  if (!fs.existsSync(full)) fail(`No existe el archivo ${file}`);
  const tng = createNodeTangerine({ args, stepLimit: flags.limite || 0 });
  try {
    tng.runModule(full);
  } catch (err) {
    reportError(tng, err);
    process.exit(1);
  }
}

function cmdCheck(files) {
  if (!files.length) fail("Indica uno o más archivos: tangerine check main.tng");
  let bad = 0;
  const tng = createNodeTangerine();
  for (const f of files) {
    const full = path.resolve(f);
    if (!fs.existsSync(full)) { console.error(rojo("✗ ") + `${f}: no existe`); bad++; continue; }
    try {
      parse(fs.readFileSync(full, "utf8"), full);
      console.log(verde("✓ ") + f);
    } catch (err) {
      bad++;
      reportError(tng, err);
    }
  }
  if (bad) process.exit(1);
}

function cmdRepl() {
  const tng = createNodeTangerine();
  const session = tng.session();
  console.log(`${naranja("Tangerine")} ${VERSION}. Escribe código y pulsa Enter. ${gris(".ayuda para ver comandos, .salir para terminar")}`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: naranja("tng> ") });
  let buffer = "";
  rl.prompt();
  rl.on("line", (line) => {
    if (!buffer) {
      const cmd = line.trim();
      if (cmd === ".salir" || cmd === ".exit") return rl.close();
      if (cmd === ".ayuda" || cmd === ".help") {
        console.log("  .salir     termina el REPL\n  .limpiar   descarta el código a medio escribir\n  Las variables se conservan entre líneas. Los bloques sin cerrar continúan en la línea siguiente.");
        return rl.prompt();
      }
    }
    if (line.trim() === ".limpiar") { buffer = ""; rl.setPrompt(naranja("tng> ")); return rl.prompt(); }
    buffer += (buffer ? "\n" : "") + line;
    try {
      const value = session.run(buffer);
      if (value !== null && value !== undefined) console.log(gris(show(value, true)));
      buffer = "";
      rl.setPrompt(naranja("tng> "));
    } catch (err) {
      if (err.incomplete) { rl.setPrompt(gris("...  ")); return rl.prompt(); }
      buffer = "";
      rl.setPrompt(naranja("tng> "));
      console.error(rojo("error: ") + tng.message(err));
    }
    rl.prompt();
  });
  rl.on("close", () => { console.log(); process.exit(0); });
}

function buildConfig(flags) {
  const config = loadConfig(process.cwd(), { entry: flags.entrada, out: flags.salida, runtime: flags.cdn ? "cdn" : undefined });
  if (!fs.existsSync(path.resolve(config.root, config.entry)))
    fail(`No existe el archivo de entrada ${config.entry}. Créalo o indica otro con --entrada (o en tangerine.json).`);
  return config;
}

function cmdBuild(flags) {
  const config = buildConfig(flags);
  if (flags.componentes) {
    try {
      const r = buildComponentsToDisk(config, flags.salida);
      const kb = (Buffer.byteLength(r.js) / 1024).toFixed(1);
      console.log(`${verde("✓")} ${path.relative(process.cwd(), r.out)} ${gris(`(${r.components.length ? r.components.map((c) => "<" + c + ">").join(" ") : "sin @Component"}, ${kb} KB)`)}`);
      if (r.components.length) console.log(gris(`  Cárgalo con <script src="componentes.js"></script> y usa <${r.components[0]}></${r.components[0]}>`));
    } catch (err) {
      fail(err.message);
    }
    return;
  }
  try {
    const r = buildToDisk(config);
    const kb = (Buffer.byteLength(r.html) / 1024).toFixed(1);
    console.log(`${verde("✓")} ${path.relative(process.cwd(), r.out)} ${gris(`(${r.modules.length} ${r.modules.length === 1 ? "módulo" : "módulos"}, ${kb} KB)`)}`);
  } catch (err) {
    fail(err.message);
  }
}

const TIPOS = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".tng": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8",
};

function staticServer(dir, extra) {
  const root = path.resolve(dir);
  return http.createServer((req, res) => {
    if (extra && extra(req, res)) return;
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, "http://x").pathname); }
    catch { res.writeHead(400); return res.end(); }
    let file = path.join(root, pathname);
    if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file)) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("No encontrado"); }
    res.writeHead(200, { "Content-Type": TIPOS[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-cache" });
    fs.createReadStream(file).pipe(res);
  });
}

function listen(server, port, label) {
  server.on("error", (e) => fail(e.code === "EADDRINUSE" ? `El puerto ${port} está ocupado. Usa otro con -p` : e.message));
  server.listen(port, () => console.log(`${naranja("Tangerine")} ${label} en ${negrita(`http://localhost:${port}`)} ${gris("(Ctrl+C para detener)")}`));
}

function cmdServe(dir, flags) {
  const folder = dir || ".";
  if (!fs.existsSync(folder)) fail(`No existe la carpeta ${folder}`);
  listen(staticServer(folder), flags.puerto || 8000, `sirviendo ${folder}`);
}

function cmdDev(flags) {
  const config = buildConfig(flags);
  const clients = new Set();
  const rebuild = () => {
    try {
      const r = buildToDisk(config, { dev: true });
      console.log(`${verde("✓")} ${gris(new Date().toLocaleTimeString("es"))} construido (${r.modules.length} ${r.modules.length === 1 ? "módulo" : "módulos"})`);
    } catch (err) {
      console.error(rojo("error: ") + err.message);
    }
    for (const c of clients) c.write("data: recarga\n\n");
  };
  rebuild();
  const outDir = path.dirname(path.resolve(config.root, config.out));
  const server = staticServer(outDir, (req, res) => {
    if (req.url !== "/__tangerine_recarga") return false;
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    res.write(": conectado\n\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return true;
  });
  let timer = null;
  try {
    fs.watch(config.root, { recursive: true }, (_e, name) => {
      if (!name) return;
      const full = path.resolve(config.root, name);
      if (full.startsWith(outDir + path.sep) || full.includes(`${path.sep}node_modules${path.sep}`)) return;
      if (!/\.(tng|css|js|json)$/.test(name)) return;
      clearTimeout(timer);
      timer = setTimeout(rebuild, 80);
    });
  } catch {
    console.warn(gris("Aviso: este sistema no permite vigilar carpetas; reconstruye con tangerine build."));
  }
  listen(server, flags.puerto || 3000, "dev");
}

const ui = { naranja, rojo, gris, verde, negrita, fail };
const { flags, rest } = parseArgs(process.argv.slice(2));
if (flags.version) { console.log(VERSION); process.exit(0); }
if (flags.ayuda) { console.log(AYUDA); process.exit(0); }

const [cmd, ...args] = rest;
switch (cmd) {
  case undefined: cmdRepl(); break;
  case "repl": cmdRepl(); break;
  case "run": cmdRun(args[0], args.slice(1), flags); break;
  case "check": cmdCheck(args); break;
  case "new": await cmdNew(args[0], flags, ui); break;
  case "install": case "instalar": await cmdInstall(args, flags, ui); break;
  case "doctor": cmdDoctor(ui); break;
  case "vscode": case "editor": cmdVscode(ui); break;
  case "add": case "agregar": cmdAdd(args, flags, ui); break;
  case "remove": case "quitar": cmdRemove(args, ui); break;
  case "buscar": case "search": cmdBuscar(args, ui); break;
  case "build": cmdBuild(flags); break;
  case "dev": cmdDev(flags); break;
  case "serve": cmdServe(args[0], flags); break;
  case "help": case "ayuda": console.log(AYUDA); break;
  default:
    if (cmd.endsWith(".tng") || fs.existsSync(cmd)) cmdRun(cmd, args, flags);
    else fail(`Comando desconocido: ${cmd}. Usa tangerine --ayuda`);
}
