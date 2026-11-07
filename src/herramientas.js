// Comandos que trabajan con otras herramientas: crear proyectos (propios y de otros frameworks),
// instalar programas, revisar el entorno y manejar paquetes de Tangerine.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { VERSION } from "./index.js";
import { findPackage, packageEntry } from "./node.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const PLANTILLAS_DIR = path.join(here, "..", "plantillas");
const SO = process.platform === "win32" ? "win" : process.platform === "darwin" ? "mac" : "linux";

/** Ejecuta un comando visible para el usuario. Devuelve el código de salida. */
export function ejecutar(cmd, cwd) {
  const r = spawnSync(cmd, { shell: true, stdio: "inherit", cwd });
  return r.status === null ? 1 : r.status;
}

/** ¿Existe este programa en el PATH? */
export function existe(programa) {
  const cmd = SO === "win" ? `where ${programa}` : `command -v ${programa}`;
  return spawnSync(cmd, { shell: true, stdio: "ignore" }).status === 0;
}

/** Primera línea de `programa --version`, o null si no está instalado. */
export function version(programa, flag = "--version") {
  if (!existe(programa)) return null;
  const r = spawnSync(`${programa} ${flag}`, { shell: true, encoding: "utf8", timeout: 15000 });
  const out = `${r.stdout || ""}${r.stderr || ""}`.trim().split(/\r?\n/).find((l) => l.trim());
  return out ? out.trim() : "instalado";
}

async function confirmar(pregunta, si) {
  if (si) return true;
  if (!process.stdin.isTTY) return false;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const r = await new Promise((ok) => rl.question(`${pregunta} (s/N) `, ok));
  rl.close();
  return /^(s|si|sí|y|yes)$/i.test(r.trim());
}

const NOMBRE_VALIDO = /^[A-Za-z0-9._-]+$/;

// ─────────────── tangerine new ───────────────

/**
 * Plantillas de `tangerine new --con <nombre>`.
 * local: se copia de plantillas/. cmd: se crea con el CLI oficial del framework.
 * vite: el proyecto usa Vite y se le agrega el plugin de Tangerine.
 */
export const PLANTILLAS = {
  web: { desc: "Página web hecha 100% en Tangerine (por defecto)", local: "web" },
  react: { desc: "React + Vite con componentes escritos en Tangerine", local: "react" },
  componentes: { desc: "Web Components para usar en Angular, React, Vue o HTML", local: "componentes" },
  consola: { desc: "Programa de terminal en Tangerine", local: "consola" },
  paquete: { desc: "Paquete de Tangerine para publicar en npm", local: "paquete" },
  vue: { desc: "Vue + Vite (CLI oficial) con soporte para .tng", requiere: "npm", vite: true, cmd: (d) => `npm create vite@latest ${d} -- --template vue` },
  svelte: { desc: "Svelte + Vite (CLI oficial) con soporte para .tng", requiere: "npm", vite: true, cmd: (d) => `npm create vite@latest ${d} -- --template svelte` },
  vite: { desc: "Vite con JavaScript puro (CLI oficial) con soporte para .tng", requiere: "npm", vite: true, cmd: (d) => `npm create vite@latest ${d} -- --template vanilla` },
  angular: { desc: "Angular (CLI oficial @angular/cli)", requiere: "npx", cmd: (d) => `npx -y @angular/cli@latest new ${d} --defaults --skip-git` },
  next: { desc: "Next.js (create-next-app)", requiere: "npx", cmd: (d) => `npx -y create-next-app@latest ${d}` },
  astro: { desc: "Astro (create astro)", requiere: "npm", cmd: (d) => `npm create astro@latest ${d}` },
  expo: { desc: "React Native con Expo (create-expo-app)", requiere: "npx", cmd: (d) => `npx -y create-expo-app@latest ${d}` },
  swift: { desc: "Programa de Swift (swift package init)", requiere: "swift", swift: true },
  flutter: { desc: "App de Flutter (flutter create)", requiere: "flutter", cmd: (d) => `flutter create ${d}` },
};

export function listarPlantillas(ui) {
  console.log(`\n${ui.negrita("Plantillas")}  tangerine new <carpeta> --con <plantilla>\n`);
  const ancho = Math.max(...Object.keys(PLANTILLAS).map((k) => k.length));
  for (const [k, p] of Object.entries(PLANTILLAS)) console.log(`  ${ui.naranja(k.padEnd(ancho))}  ${p.desc}`);
  console.log("");
}

function copiarPlantilla(from, to, vars) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name === "_gitignore" ? ".gitignore" : entry.name);
    if (entry.isDirectory()) copiarPlantilla(src, dest, vars);
    else {
      let text = fs.readFileSync(src, "utf8");
      for (const [k, v] of Object.entries(vars)) text = text.split(`{{${k}}}`).join(v);
      fs.writeFileSync(dest, text);
    }
  }
}

/** Agrega tangerine-lang y su plugin de Vite a un proyecto recién creado con Vite. */
export function integrarVite(dir) {
  const pkgFile = path.join(dir, "package.json");
  if (fs.existsSync(pkgFile)) {
    const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8"));
    pkg.devDependencies = { ...(pkg.devDependencies || {}), "tangerine-lang": `^${VERSION}` };
    fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + "\n");
  }
  const config = ["vite.config.js", "vite.config.ts", "vite.config.mjs"].map((f) => path.join(dir, f)).find((f) => fs.existsSync(f));
  const importLine = 'import tangerine from "tangerine-lang/vite";\n';
  if (config) {
    let text = fs.readFileSync(config, "utf8");
    if (!text.includes("tangerine-lang/vite") && /plugins:\s*\[/.test(text)) {
      text = importLine + text.replace(/plugins:\s*\[/, "plugins: [tangerine(), ");
      fs.writeFileSync(config, text);
      return true;
    }
    return text.includes("tangerine-lang/vite");
  }
  // Plantilla sin vite.config (vanilla): se crea una
  fs.writeFileSync(path.join(dir, "vite.config.js"), `${importLine}\nexport default {\n  plugins: [tangerine()],\n};\n`);
  const ejemplo = path.join(dir, "src", "saludo.tng");
  if (fs.existsSync(path.join(dir, "src")) && !fs.existsSync(ejemplo))
    fs.writeFileSync(ejemplo, '// Impórtalo desde JavaScript: import { saludo } from "./saludo.tng"\nexport fn saludo(nombre = "mundo") {\n  "Hola, {nombre} desde Tangerine"\n}\n');
  return true;
}

export async function cmdNew(dir, flags, ui) {
  if (flags.lista) return listarPlantillas(ui);
  if (!dir) ui.fail("Indica el nombre de la carpeta: tangerine new mi-app [--con react]. Ver plantillas: tangerine new --lista");
  const nombrePlantilla = flags.con || "web";
  const plantilla = PLANTILLAS[nombrePlantilla];
  if (!plantilla) {
    listarPlantillas(ui);
    ui.fail(`No conozco la plantilla '${nombrePlantilla}'.`);
  }
  if (!NOMBRE_VALIDO.test(dir)) ui.fail("El nombre de la carpeta solo puede tener letras, números, puntos, guiones y guiones bajos");
  const target = path.resolve(dir);
  if (fs.existsSync(target) && fs.readdirSync(target).length) ui.fail(`La carpeta ${dir} ya existe y no está vacía`);
  const nombre = path.basename(target).toLowerCase().replace(/[^a-z0-9-_]/g, "-");

  if (plantilla.local) {
    copiarPlantilla(path.join(PLANTILLAS_DIR, plantilla.local), target, { nombre, version: VERSION });
    const siguiente = plantilla.local === "consola" ? "npm start -- README.md" : plantilla.local === "paquete" ? "npm test" : "npm run dev";
    console.log(`${ui.verde("✓")} Proyecto ${ui.naranja(nombrePlantilla)} creado en ${dir}\n\n  cd ${dir}\n  npm install\n  ${siguiente}\n`);
    return;
  }

  if (plantilla.requiere && !existe(plantilla.requiere)) {
    const sugerencia = plantilla.requiere === "npx" || plantilla.requiere === "npm" ? "node" : plantilla.requiere;
    ui.fail(`Esta plantilla necesita '${plantilla.requiere}' y no está instalado. Instálalo con: tangerine install ${sugerencia}`);
  }

  let codigo;
  if (plantilla.swift) {
    fs.mkdirSync(target, { recursive: true });
    const modulo = nombre.replace(/[^A-Za-z0-9]/g, "_").replace(/^(\d)/, "_$1");
    console.log(ui.gris(`> swift package init --type executable --name ${modulo}`));
    codigo = ejecutar(`swift package init --type executable --name ${modulo}`, target);
  } else {
    const cmd = plantilla.cmd(dir);
    console.log(ui.gris(`> ${cmd}`));
    codigo = ejecutar(cmd, process.cwd());
  }
  if (codigo !== 0) ui.fail(`El instalador de ${nombrePlantilla} terminó con error (código ${codigo})`);

  if (plantilla.vite && !flags.sinTangerine && fs.existsSync(target)) {
    const ok = integrarVite(target);
    console.log(ok
      ? `${ui.verde("✓")} Agregué Tangerine: ya puedes importar archivos .tng desde JavaScript`
      : ui.gris('Para usar .tng: npm i -D tangerine-lang y agrega tangerine() (de "tangerine-lang/vite") a los plugins de vite.config'));
  }
  const siguiente = plantilla.swift ? "swift run" : plantilla.cmd && /flutter/.test(plantilla.cmd("")) ? "flutter run" : "npm install\n  npm run dev";
  console.log(`\n${ui.verde("✓")} Proyecto ${ui.naranja(nombrePlantilla)} listo en ${dir}\n\n  cd ${dir}\n  ${siguiente}\n`);
}

// ─────────────── tangerine install ───────────────

const MANUAL = (url) => ({ manual: url });

/** Cómo instalar cada herramienta en cada sistema. */
export const HERRAMIENTAS = {
  node: { desc: "Node.js (LTS)", prueba: "node", win: "winget install -e --id OpenJS.NodeJS.LTS", mac: "brew install node", linux: MANUAL("https://nodejs.org/es/download") },
  git: { desc: "Git", prueba: "git", win: "winget install -e --id Git.Git", mac: "brew install git", linux: "sudo apt-get install -y git" },
  swift: {
    desc: "Swift", prueba: "swift", win: "winget install -e --id Swift.Toolchain", mac: "xcode-select --install", linux: MANUAL("https://www.swift.org/install/linux/"),
    nota: "En Windows, Swift también necesita las herramientas de C++ de Visual Studio: https://www.swift.org/install/windows/",
  },
  python: { desc: "Python 3", prueba: SO === "win" ? "python" : "python3", win: "winget install -e --id Python.Python.3.12", mac: "brew install python", linux: "sudo apt-get install -y python3" },
  angular: { desc: "Angular CLI (ng)", prueba: "ng", todos: "npm install -g @angular/cli" },
  typescript: { desc: "TypeScript (tsc)", prueba: "tsc", todos: "npm install -g typescript" },
  pnpm: { desc: "pnpm", prueba: "pnpm", todos: "npm install -g pnpm" },
  yarn: { desc: "Yarn", prueba: "yarn", todos: "npm install -g yarn" },
  bun: { desc: "Bun", prueba: "bun", todos: "npm install -g bun" },
  deno: { desc: "Deno", prueba: "deno", win: "winget install -e --id DenoLand.Deno", mac: "brew install deno", linux: MANUAL("https://docs.deno.com/runtime/getting_started/installation/") },
  vscode: { desc: "Visual Studio Code", prueba: "code", win: "winget install -e --id Microsoft.VisualStudioCode", mac: "brew install --cask visual-studio-code", linux: MANUAL("https://code.visualstudio.com/download") },
  flutter: { desc: "Flutter", prueba: "flutter", todos: MANUAL("https://docs.flutter.dev/get-started/install") },
  react: { desc: "React", sinInstalar: "React no se instala aparte: crea un proyecto con tangerine new mi-app --con react" },
  vue: { desc: "Vue", sinInstalar: "Vue no se instala aparte: crea un proyecto con tangerine new mi-app --con vue" },
  svelte: { desc: "Svelte", sinInstalar: "Svelte no se instala aparte: crea un proyecto con tangerine new mi-app --con svelte" },
  next: { desc: "Next.js", sinInstalar: "Next.js no se instala aparte: crea un proyecto con tangerine new mi-app --con next" },
  tangerine: { desc: "Tangerine", sinInstalar: "Ya tienes Tangerine. Para actualizarlo: npm install -g tangerine-lang@latest" },
};

function comoInstalar(h) {
  const forma = h.todos !== undefined ? h.todos : h[SO];
  if (!forma) return { manual: null };
  if (typeof forma === "object") return forma;
  const gestor = forma.startsWith("winget") ? "winget" : forma.startsWith("brew") ? "brew" : forma.startsWith("npm") ? "npm" : forma.includes("apt-get") ? "apt-get" : null;
  return { cmd: forma, gestor };
}

export function listarHerramientas(ui) {
  console.log(`\n${ui.negrita("Herramientas")}  tangerine install <nombre>\n`);
  const ancho = Math.max(...Object.keys(HERRAMIENTAS).map((k) => k.length));
  for (const [k, h] of Object.entries(HERRAMIENTAS)) {
    const forma = h.sinInstalar ? ui.gris("(se usa con tangerine new)") : (() => { const c = comoInstalar(h); return ui.gris(c.cmd || (c.manual ? "instalación manual" : "no disponible")); })();
    console.log(`  ${ui.naranja(k.padEnd(ancho))}  ${h.desc.padEnd(22)} ${forma}`);
  }
  console.log("");
}

export async function cmdInstall(nombres, flags, ui) {
  if (flags.lista || !nombres.length) return listarHerramientas(ui);
  let errores = 0;
  for (const nombre of nombres) {
    const h = HERRAMIENTAS[nombre.toLowerCase()];
    if (!h) { console.error(`${ui.rojo("✗")} No conozco '${nombre}'. Mira la lista con: tangerine install --lista`); errores++; continue; }
    if (h.sinInstalar) { console.log(`${ui.naranja("•")} ${h.sinInstalar}`); continue; }
    if (h.prueba && existe(h.prueba) && !flags.forzar) {
      console.log(`${ui.verde("✓")} ${h.desc} ya está instalado ${ui.gris(`(${version(h.prueba) || ""})`)}. Usa --forzar para reinstalar.`);
      continue;
    }
    const c = comoInstalar(h);
    if (!c.cmd) {
      console.log(`${ui.naranja("•")} ${h.desc}: instálalo siguiendo ${c.manual || "la guía oficial"}`);
      continue;
    }
    if (c.gestor && c.gestor !== "apt-get" && !existe(c.gestor)) {
      const ayuda = c.gestor === "brew" ? "Instala Homebrew primero: https://brew.sh" : c.gestor === "winget" ? "winget viene con Windows 10/11 (App Installer en Microsoft Store)" : "Instala Node.js primero: tangerine install node";
      console.error(`${ui.rojo("✗")} Para instalar ${h.desc} hace falta ${c.gestor}. ${ayuda}`);
      errores++;
      continue;
    }
    if (h.nota) console.log(ui.gris(h.nota));
    console.log(`${ui.naranja("→")} ${h.desc}: ${ui.negrita(c.cmd)}`);
    if (!(await confirmar("¿Lo ejecuto?", flags.si))) {
      console.log(ui.gris("  No ejecuté nada. Puedes copiar el comando de arriba, o repetir con --si."));
      continue;
    }
    const codigo = ejecutar(c.cmd);
    if (codigo === 0) console.log(`${ui.verde("✓")} ${h.desc} instalado. Si el comando no aparece, abre una terminal nueva.`);
    else { console.error(`${ui.rojo("✗")} La instalación de ${h.desc} terminó con error (código ${codigo})`); errores++; }
  }
  if (errores) process.exitCode = 1;
}

// ─────────────── tangerine doctor ───────────────

export function cmdDoctor(ui) {
  console.log(`\n${ui.naranja("Tangerine")} ${VERSION} en ${process.platform} (${process.arch}), Node ${process.version}\n`);
  const revisar = [
    ["node", "Node.js"], ["npm", "npm"], ["git", "Git"],
    ...(SO === "win" ? [["winget", "winget"]] : SO === "mac" ? [["brew", "Homebrew"]] : []),
    ["code", "VS Code", "vscode"], ["swift", "Swift"], [SO === "win" ? "python" : "python3", "Python", "python"],
    ["ng", "Angular CLI", "angular"], ["tsc", "TypeScript", "typescript"], ["deno", "Deno"], ["bun", "Bun"], ["flutter", "Flutter"],
  ];
  const faltan = [];
  for (const [prog, nombre, clave] of revisar) {
    const v = version(prog, prog === "winget" || prog === "flutter" ? "--version" : "--version");
    if (v) console.log(`  ${ui.verde("✓")} ${nombre.padEnd(12)} ${ui.gris(v.slice(0, 60))}`);
    else { console.log(`  ${ui.gris("·")} ${ui.gris(nombre.padEnd(12) + " no instalado")}`); faltan.push(clave || prog); }
  }
  const major = Number(process.version.slice(1).split(".")[0]);
  if (major < 18) console.log(`\n${ui.rojo("!")} Tangerine necesita Node 18 o más reciente. Actualiza con: tangerine install node --forzar`);
  const utiles = faltan.filter((k) => HERRAMIENTAS[k] && !["npm", "winget", "brew"].includes(k));
  if (utiles.length) console.log(`\nPuedes instalar lo que falta con: ${ui.negrita("tangerine install " + utiles[0])}  ${ui.gris("(lista: tangerine install --lista)")}`);
  console.log("");
}

// ─────────────── tangerine add / remove / buscar ───────────────

const SPEC_VALIDO = /^[@A-Za-z0-9._/:#~^<>=+-]+$/;

/** Convierte "usuario/repo" en "github:usuario/repo"; deja igual paquetes de npm y @scope/paquete. */
export function specNpm(spec) {
  if (/^[A-Za-z0-9_-][A-Za-z0-9_.-]*\/[A-Za-z0-9_.-]+(#.+)?$/.test(spec)) return `github:${spec}`;
  return spec;
}

function asegurarPackageJson(dir) {
  const file = path.join(dir, "package.json");
  if (fs.existsSync(file)) return;
  const nombre = path.basename(dir).toLowerCase().replace(/[^a-z0-9-_]/g, "-") || "proyecto";
  fs.writeFileSync(file, JSON.stringify({ name: nombre, version: "0.1.0", private: true, type: "module", dependencies: {} }, null, 2) + "\n");
}

export function cmdAdd(paquetes, flags, ui) {
  if (!paquetes.length) ui.fail("Indica qué instalar: tangerine add colores   ó   tangerine add usuario/repo (GitHub)");
  for (const p of paquetes) if (!SPEC_VALIDO.test(p)) ui.fail(`Nombre de paquete no válido: ${p}`);
  if (!existe("npm")) ui.fail("Hace falta npm para instalar paquetes. Instala Node.js: tangerine install node");
  asegurarPackageJson(process.cwd());
  const specs = paquetes.map(specNpm);
  const cmd = `npm install ${flags.dev ? "--save-dev " : ""}${specs.join(" ")}`;
  console.log(ui.gris(`> ${cmd}`));
  const codigo = ejecutar(cmd, process.cwd());
  if (codigo !== 0) ui.fail(`npm terminó con error (código ${codigo})`);
  for (const p of paquetes) {
    let nombre;
    if (/^(\.|\/|[A-Za-z]:[\\/]|file:)/.test(p)) {
      // Carpeta local: el nombre está en su package.json
      try { nombre = JSON.parse(fs.readFileSync(path.join(path.resolve(p.replace(/^file:/, "")), "package.json"), "utf8")).name; }
      catch { continue; }
    } else if (p.includes(":") || specNpm(p) !== p) continue; // GitHub o URL: el nombre lo decide su package.json
    else nombre = p.startsWith("@") ? p.split("@").slice(0, 2).join("@") : p.split("@")[0];
    const dir = findPackage(nombre, process.cwd());
    if (!dir) continue;
    if (fs.existsSync(packageEntry(dir))) console.log(`${ui.verde("✓")} ${nombre}: úsalo con ${ui.negrita(`import { ... } from "${nombre}"`)}`);
    else console.log(`${ui.naranja("•")} ${nombre} se instaló, pero no es un paquete de Tangerine (no tiene index.tng ni el campo "tangerine"). Puedes usarlo desde JavaScript.`);
  }
}

export function cmdRemove(paquetes, ui) {
  if (!paquetes.length) ui.fail("Indica qué quitar: tangerine remove colores");
  for (const p of paquetes) if (!SPEC_VALIDO.test(p)) ui.fail(`Nombre de paquete no válido: ${p}`);
  const codigo = ejecutar(`npm uninstall ${paquetes.join(" ")}`, process.cwd());
  if (codigo !== 0) process.exitCode = codigo;
}

export function cmdBuscar(texto, ui) {
  const q = texto.filter((t) => SPEC_VALIDO.test(t)).join(" ");
  console.log(ui.gris(`Paquetes de Tangerine en npm${q ? ` que coinciden con "${q}"` : ""}:`));
  ejecutar(`npm search keywords:tangerine-paquete ${q}`.trim());
}

// ─────────────── tangerine vscode ───────────────

export function cmdVscode(ui) {
  const vsix = path.join(here, "..", "editores", "vscode", "tangerine-vscode.vsix");
  if (!fs.existsSync(vsix)) ui.fail("No encontré la extensión empaquetada (editores/vscode/tangerine-vscode.vsix)");
  if (!existe("code")) ui.fail("No encontré VS Code (el comando 'code'). Instálalo con: tangerine install vscode");
  console.log(ui.gris(`> code --install-extension "${vsix}"`));
  const codigo = ejecutar(`code --install-extension "${vsix}" --force`);
  if (codigo !== 0) ui.fail(`VS Code no pudo instalar la extensión (código ${codigo})`);
  console.log(`${ui.verde("✓")} Extensión de Tangerine instalada. Abre un archivo .tng en VS Code.`);
}
