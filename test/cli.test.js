import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(raiz, "bin", "tangerine.js");
let tmp;

const tangerine = (args, opciones = {}) =>
  spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", env: { ...process.env, NO_COLOR: "1" }, ...opciones });

beforeAll(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tng-")); });
afterAll(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

describe("CLI", () => {
  it("muestra la versión y la ayuda", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(raiz, "package.json"), "utf8"));
    expect(tangerine(["--version"]).stdout.trim()).toBe(pkg.version);
    expect(tangerine(["--ayuda"]).stdout).toContain("tangerine new <carpeta>");
  });

  it("ejecuta archivos con imports, argumentos y archivos del disco", () => {
    fs.writeFileSync(path.join(tmp, "util.tng"), 'export fn saludo(n) { "Hola, {n}" }');
    fs.writeFileSync(path.join(tmp, "datos.txt"), "uno dos\ntres");
    fs.writeFileSync(path.join(tmp, "main.tng"), 'import { saludo } from "./util"\nprintln(saludo(args()[0]))\nprintln(read_file("datos.txt").words().len())');
    const r = tangerine(["main.tng", "Ana"], { cwd: tmp });
    expect(r.stderr).toBe("");
    expect(r.stdout).toBe("Hola, Ana\n3\n");
  });

  it("muestra el error con la línea de código y una flecha", () => {
    fs.writeFileSync(path.join(tmp, "malo.tng"), "let a = 1\nlet b = (a +\n");
    const r = tangerine(["malo.tng"], { cwd: tmp });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("error: malo.tng, línea 3");
  });

  it("check revisa la sintaxis sin ejecutar", () => {
    fs.writeFileSync(path.join(tmp, "bien.tng"), 'println("no se ejecuta")');
    const r = tangerine(["check", "bien.tng"], { cwd: tmp });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("✓ bien.tng");
    expect(r.stdout).not.toContain("no se ejecuta");
  });

  it("el REPL conserva variables y continúa bloques sin cerrar", () => {
    const r = tangerine(["repl"], { input: "let a = 20\nfn f(x) {\n  x + a\n}\nf(22)\n.salir\n" });
    expect(r.stdout).toContain("42");
  });

  it("build --componentes genera un .js que registra los Web Components", async () => {
    const dir = path.join(tmp, "comps");
    fs.mkdirSync(path.join(dir, "src"), { recursive: true });
    fs.writeFileSync(path.join(dir, "tangerine.json"), JSON.stringify({ entry: "src/index.tng", styles: ["src/estilos.css"] }));
    fs.writeFileSync(path.join(dir, "src", "estilos.css"), ".numero { font-weight: bold }");
    fs.writeFileSync(path.join(dir, "src", "contador.tng"), `
@Component("mi-contador")
export struct Contador {
  @Input var paso = 1
  @Output var cambio
  @State var cuenta = 0
  view {
    p(.numero) { "{cuenta}" }
    button("+") { cuenta += paso; cambio.emit(cuenta) }
  }
}`);
    fs.writeFileSync(path.join(dir, "src", "index.tng"), 'import { Contador } from "./contador"');
    const b = tangerine(["build", "--componentes"], { cwd: dir });
    expect(b.stderr).toBe("");
    expect(b.stdout).toContain("<mi-contador>");
    const js = fs.readFileSync(path.join(dir, "dist", "componentes.js"), "utf8");

    const page = new JSDOM('<!doctype html><body><mi-contador paso="3"></mi-contador></body>', { runScripts: "dangerously" });
    const w = page.window;
    const s = w.document.createElement("script");
    s.textContent = js;
    w.document.body.appendChild(s);
    const el = w.document.querySelector("mi-contador");
    const vistos = [];
    el.addEventListener("cambio", (e) => vistos.push(e.detail));
    el.querySelector("button").click();
    expect(el.querySelector(".numero").textContent).toBe("3");
    expect(vistos).toEqual([3]);
    expect(w.document.querySelector("style[data-tangerine]").textContent).toContain(".numero");
  });

  it("new crea un proyecto y build lo empaqueta en un HTML que funciona", async () => {
    const r = tangerine(["new", "mi-app"], { cwd: tmp });
    expect(r.status).toBe(0);
    const app = path.join(tmp, "mi-app");
    for (const f of ["tangerine.json", "package.json", ".gitignore", "src/main.tng"])
      expect(fs.existsSync(path.join(app, f))).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(app, "package.json"), "utf8")).name).toBe("mi-app");

    const b = tangerine(["build"], { cwd: app });
    expect(b.stderr).toBe("");
    expect(b.stdout).toContain("1 módulo,");
    const html = fs.readFileSync(path.join(app, "dist", "index.html"), "utf8");

    const dom = new JSDOM(html, { runScripts: "dangerously" });
    await new Promise((ok) => dom.window.addEventListener("load", ok));
    await new Promise((ok) => setTimeout(ok, 20));
    const doc = dom.window.document;
    expect(doc.querySelector("h1").textContent).toBe("Hola desde Tangerine");
    expect(doc.querySelector(".numero").textContent).toBe("0");
    doc.querySelector(".boton.primario").click();
    doc.querySelector(".boton.primario").click();
    expect(doc.querySelector(".numero").textContent).toBe("2");
  });
});
