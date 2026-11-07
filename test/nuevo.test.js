import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Tangerine, resolveWithMap } from "../src/index.js";
import { react, wrapExport } from "../src/plugins/react.js";
import tangerineVite from "../src/vite.js";
import { specNpm, PLANTILLAS, HERRAMIENTAS } from "../src/herramientas.js";
import { sugerir, distancia } from "../src/sugerencias.js";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(raiz, "bin", "tangerine.js");
const tangerine = (args, cwd) => spawnSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" }, input: "" });
const error = (codigo) => Tangerine.runCode(codigo).error;

describe("parámetros por defecto", () => {
  it("usan el valor por defecto cuando falta el argumento", () => {
    const tng = new Tangerine();
    expect(tng.run('fn s(n, saludo = "Hola", fin = "!") { "{saludo}, {n}{fin}" }\n[s("Ana"), s("Luis", "Hey")]')).toEqual(["Hola, Ana!", "Hey, Luis!"]);
  });
  it("pueden usar parámetros anteriores y funcionan en closures", () => {
    expect(new Tangerine().run("let f = |a, b = a * 2| a + b\n[f(1), f(1, 1)]")).toEqual([3, 2]);
  });
  it("un nil explícito no se reemplaza", () => {
    expect(new Tangerine().run("fn f(x = 1) { x }\nf(nil)")).toBe(null);
  });
  it("exigen valor por defecto después de uno que lo tiene", () => {
    expect(error("fn f(a = 1, b) { }")).toMatch(/necesita un valor por defecto/);
  });
});

describe("sugerencias", () => {
  it("calcula la distancia de edición", () => {
    expect(distancia("nombre", "nombr")).toBe(1);
    expect(distancia("ab", "ba")).toBe(1);
  });
  it("sugiere nombres parecidos y equivalentes de otros lenguajes", () => {
    expect(sugerir("lenght", ["len", "push"])).toBe("len");
    expect(sugerir("contadr", ["contador", "x"])).toBe("contador");
    expect(sugerir("zzzz", ["contador"])).toBe(null);
  });
  it("los errores incluyen ¿Quisiste decir?", () => {
    expect(error("let nombre = 1\nlog(nombr)")).toBe("Línea 2: No existe 'nombr' en este ámbito. ¿Quisiste decir 'nombre'?");
    expect(error('"hola".toUpperCase()')).toMatch(/¿Quisiste decir 'upper'\?/);
    expect(error("let x = null")).toMatch(/¿Quisiste decir 'nil'\?/);
    expect(error("class P { var edad = 1 }\nP().eda")).toMatch(/¿Quisiste decir 'edad'\?/);
  });
});

describe("rastro de llamadas", () => {
  it("lista las funciones desde la más interna", () => {
    const r = Tangerine.runCode("fn a() { nada }\nfn b() { a() }\nb()");
    expect(r.error).toMatch(/Línea 1: No existe 'nada'/);
    expect(r.trace).toEqual(["en a(), llamada en línea 2", "en b(), llamada en línea 3"]);
  });
  it("indica el archivo de cada llamada entre módulos", () => {
    const tng = new Tangerine({ modules: { "util.tng": "export fn f() {\n  1 + nil\n}" } });
    try { tng.run('import { f } from "./util"\nfn g() { f() }\ng()', { file: "main.tng" }); }
    catch (e) { expect(tng.trace(e)).toEqual(["en f(), llamada en main.tng, línea 2", "en g(), llamada en main.tng, línea 3"]); return; }
    throw new Error("debió fallar");
  });
});

describe("paquetes", () => {
  it("resuelve nombres con el mapa de paquetes", () => {
    const mapa = { colores: "node_modules/colores/index.tng", "colores/": "node_modules/colores/" };
    expect(resolveWithMap("colores", "src/main.tng", mapa)).toBe("node_modules/colores/index.tng");
    expect(resolveWithMap("colores/rojo", "src/main.tng", mapa)).toBe("node_modules/colores/rojo.tng");
    expect(resolveWithMap("./util", "src/main.tng", mapa)).toBe("src/util.tng");
  });
  it("importa un paquete y sus archivos relativos", () => {
    const tng = new Tangerine({
      imports: { colores: "node_modules/colores/index.tng" },
      modules: {
        "node_modules/colores/index.tng": 'import { base } from "./base"\nexport let NARANJA = base + "811E"',
        "node_modules/colores/base.tng": 'export let base = "#F7"',
      },
    });
    expect(tng.run('import { NARANJA } from "colores"\nNARANJA', { file: "src/main.tng" })).toBe("#F7811E");
  });
  it("convierte usuario/repo en un paquete de GitHub", () => {
    expect(specNpm("manu/colores")).toBe("github:manu/colores");
    expect(specNpm("colores")).toBe("colores");
    expect(specNpm("@org/colores")).toBe("@org/colores");
    expect(specNpm("../colores")).toBe("../colores");
  });
  it("import() y forget() desde JavaScript", () => {
    const out = [];
    const tng = new Tangerine({ output: (l) => out.push(l), modules: { "m.tng": 'log("carga")\nexport let x = 1' } });
    expect(tng.import("m").x).toBe(1);
    tng.import("m");
    tng.forget("m").import("m");
    expect(out).toEqual(["carga", "carga"]);
  });
});

describe("React", () => {
  const app = `export fn Lista(props) {
    let (filtro, _set) = use_state("")
    h("ul", { class: "lista", style: { font_size: "12px" } },
      props.items.filter(|x| x.contains(filtro)).map(|x| h("li", { key: x }, x)),
    )
  }
  export fn App(props) {
    fragment(h("h1", nil, "Hola {props.nombre}"), h(Lista, { items: ["a", "b"] }))
  }`;

  it("renderiza componentes escritos en Tangerine", () => {
    const tng = new Tangerine({ plugins: [react(React)], modules: { "app.tng": app } });
    const App = wrapExport(tng, tng.import("app").App);
    const html = renderToStaticMarkup(React.createElement(App, { nombre: "Ana" }));
    expect(html).toBe('<h1>Hola Ana</h1><ul class="lista" style="font-size:12px"><li>a</li><li>b</li></ul>');
  });

  it("wrapExport deja los valores que no son funciones", () => {
    const tng = new Tangerine();
    expect(wrapExport(tng, 5)).toBe(5);
  });
});

describe("plugin de Vite", () => {
  it("convierte un .tng en un módulo de JavaScript con sus exports", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tng-vite-"));
    fs.writeFileSync(path.join(dir, "util.tng"), "export fn doble(x) { x * 2 }");
    const plugin = tangerineVite({ react: false });
    plugin.configResolved({ root: dir });
    const r = plugin.transform('import { doble } from "./util"\nexport fn cuadruple(x) { doble(doble(x)) }\nexport let new = 1', path.join(dir, "main.tng"));
    expect(r.code).toContain(`import "${path.join(dir, "util.tng").split(path.sep).join("/")}";`);
    expect(r.code).toContain('export const cuadruple = wrap(__m["cuadruple"]);');
    expect(r.code).not.toContain("export const new");
    expect(plugin.transform("x", "a.js")).toBe(null);
    expect(plugin.load("\0virtual:tangerine")).toContain("new Tangerine");
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("CLI: plantillas, herramientas y paquetes", () => {
  it("tiene plantillas propias y de otros frameworks", () => {
    for (const k of ["web", "react", "consola", "paquete", "vue", "angular", "swift", "next"]) expect(PLANTILLAS[k]).toBeDefined();
    for (const k of ["node", "git", "swift", "python", "angular", "vscode"]) expect(HERRAMIENTAS[k]).toBeDefined();
  });

  it("new --con consola y paquete crean proyectos que funcionan", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tng-new-"));
    expect(tangerine(["new", "cli", "--con", "consola"], tmp).status).toBe(0);
    fs.writeFileSync(path.join(tmp, "cli", "notas.txt"), "hola hola mundo");
    expect(tangerine(["src/main.tng", "notas.txt"], path.join(tmp, "cli")).stdout).toContain("la más usada: hola (2)");
    expect(tangerine(["new", "pkg", "--con", "paquete"], tmp).status).toBe(0);
    expect(tangerine(["pruebas.tng"], path.join(tmp, "pkg")).stdout).toContain("Todas las pruebas pasaron");
    expect(tangerine(["new", "x", "--con", "nada"], tmp).stderr).toContain("No conozco la plantilla 'nada'");
    expect(tangerine(["new", "mal nombre", "--con", "vue"], tmp).stderr).toContain("solo puede tener letras");
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("install explica y no ejecuta nada sin confirmación", () => {
    expect(tangerine(["install", "--lista"]).stdout).toContain("angular");
    expect(tangerine(["install", "react"]).stdout).toContain("--con react");
    expect(tangerine(["install", "inventado"]).stderr).toContain("No conozco 'inventado'");
  });

  it("doctor muestra el entorno", () => {
    const r = tangerine(["doctor"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Node.js");
  });

  it("los paquetes de node_modules se importan por nombre al ejecutar y al construir", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tng-pkg-"));
    const pkg = path.join(tmp, "node_modules", "saludos");
    fs.mkdirSync(path.join(pkg, "lib"), { recursive: true });
    fs.writeFileSync(path.join(pkg, "package.json"), JSON.stringify({ name: "saludos", tangerine: "lib/main.tng" }));
    fs.writeFileSync(path.join(pkg, "lib", "main.tng"), 'import { signo } from "./signo"\nexport fn hola(n) { "Hola {n}{signo}" }');
    fs.writeFileSync(path.join(pkg, "lib", "signo.tng"), 'export let signo = "!"');
    fs.mkdirSync(path.join(tmp, "src"));
    fs.writeFileSync(path.join(tmp, "src", "main.tng"), 'import { hola } from "saludos"\nlog(hola("Ana"))');
    expect(tangerine(["src/main.tng"], tmp).stdout).toBe("Hola Ana!\n");
    expect(tangerine(["build"], tmp).status).toBe(0);
    const html = fs.readFileSync(path.join(tmp, "dist", "index.html"), "utf8");
    expect(html).toContain('"saludos":"node_modules/saludos/lib/main.tng"');
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
