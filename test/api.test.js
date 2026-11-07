import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import { Tangerine, VERSION } from "../src/index.js";

describe("instancias", () => {
  it("cada instancia tiene su propia salida", () => {
    const a = [], b = [];
    const ta = new Tangerine({ output: (l) => a.push(l) });
    const tb = new Tangerine({ output: (l) => b.push(l) });
    ta.run('println("A")');
    tb.run('println("B")');
    expect([a, b]).toEqual([["A"], ["B"]]);
  });

  it("una instancia puede ejecutar otra dentro de una nativa sin mezclar salidas", () => {
    const fuera = [];
    const tng = new Tangerine({
      output: (l) => fuera.push(l),
      natives: { sandbox: (src) => Tangerine.runCode(src).output },
    });
    tng.run('print("antes ")\nlet r = sandbox("println(1)\\nprintln(2)")\nprintln(r)');
    expect(fuera).toEqual(["antes [\"1\", \"2\"]"]);
  });

  it("runCode no lanza y devuelve la salida parcial", () => {
    const r = Tangerine.runCode('println("ok")\nprintln(1 + nil)');
    expect(r.output).toEqual(["ok"]);
    expect(r.error).toMatch(/No se puede sumar Int con Nil/);
  });

  it("stepLimit 0 permite programas largos", () => {
    const tng = new Tangerine({ output: () => {} });
    expect(tng.run("var n = 0\nwhile n < 500000 { n += 1 }\nn")).toBe(500000);
  });
});

describe("nativas y plugins", () => {
  it("define funciones nativas", () => {
    const tng = new Tangerine({ natives: { doble: (x) => x * 2 } });
    expect(tng.run("doble(21)")).toBe(42);
  });

  it("instala plugins como objeto o función, una sola vez", () => {
    const install = vi.fn((t) => t.define("saludo", () => "hola"));
    const plugin = { name: "saludos", install };
    const tng = new Tangerine({ plugins: [plugin] });
    tng.use(plugin);
    expect(install).toHaveBeenCalledTimes(1);
    expect(tng.run("saludo()")).toBe("hola");
    tng.use(function otro(t) { t.define("tres", 3); });
    expect(tng.run("tres")).toBe(3);
  });

  it("las nativas pueden llamar funciones de Tangerine", () => {
    let guardada = null;
    const tng = new Tangerine({ natives: { guardar: (f) => { guardada = f; } } });
    tng.run("var n = 0\nguardar(|x| { n += x; n })");
    expect(tng.call(guardada, [5])).toBe(5);
    expect(tng.invoke(guardada, [2])).toBe(7);
  });

  it("invoke manda los errores a onError en vez de lanzarlos", () => {
    const errores = [];
    let f = null;
    const tng = new Tangerine({ onError: (m) => errores.push(m), natives: { guardar: (x) => { f = x; } } });
    tng.run("guardar(|| nada)");
    expect(tng.invoke(f)).toBe(null);
    expect(errores[0]).toMatch(/No existe 'nada'/);
  });

  it("globals() lista las funciones disponibles", () => {
    expect(new Tangerine().globals()).toEqual(expect.arrayContaining(["println", "to_json", "PI"]));
  });
});

describe("módulos", () => {
  const modules = {
    "mate.tng": "export fn doble(x) { x * 2 }\nexport let IVA = 0.19\nlet secreto = 1\nprintln(\"cargando mate\")",
    "util/texto.tng": 'import { doble } from "../mate.tng"\nexport fn grito(s) { s.upper() + "!" * doble(1) }',
    "a.tng": 'import { b } from "./b.tng"\nexport let a = 1',
    "b.tng": 'import { a } from "./a.tng"\nexport let b = 2',
  };

  it("importa nombres, alias y el módulo completo", () => {
    const out = [];
    const tng = new Tangerine({ modules, output: (l) => out.push(l) });
    tng.run(`import { doble, IVA as iva } from "./mate.tng"
import mate from "./mate"
import { grito } from "./util/texto"
println(doble(4), iva, mate.doble(1), mate.secreto, grito("hola"))`);
    expect(out).toEqual(["cargando mate", "8 0.19 2 nil HOLA!!"]);
  });

  it("ejecuta cada módulo una sola vez", () => {
    const out = [];
    const tng = new Tangerine({ modules, output: (l) => out.push(l) });
    tng.run('import { doble } from "./mate"');
    tng.run('import mate from "./mate"');
    expect(out.filter((l) => l === "cargando mate")).toHaveLength(1);
  });

  it("detecta importaciones circulares", () => {
    const tng = new Tangerine({ modules });
    expect(() => tng.run('import { a } from "./a"')).toThrow(/Importación circular/);
  });

  it("avisa si un nombre no se exporta o el módulo no existe", () => {
    const tng = new Tangerine({ modules, output: () => {} });
    expect(() => tng.run('import { secreto } from "./mate"')).toThrow(/no exporta 'secreto'/);
    expect(() => tng.run('import { x } from "./nada"')).toThrow(/No se encontró el módulo 'nada.tng'/);
  });

  it("atribuye el error al archivo donde ocurrió", () => {
    const tng = new Tangerine({ modules: { "malo.tng": "export fn f() {\n  1 + nil\n}" } });
    try { tng.run('import { f } from "./malo"\nf()', { file: "main.tng" }); }
    catch (e) { expect(tng.message(e)).toBe("malo.tng, línea 2: No se puede sumar Int con Nil"); return; }
    throw new Error("debió fallar");
  });

  it("lee módulos con la función read", () => {
    const tng = new Tangerine({ read: (k) => (k === "x.tng" ? "export let x = 7" : null) });
    expect(tng.run('import { x } from "./x"\nx')).toBe(7);
  });
});

describe("sesión (REPL)", () => {
  it("conserva variables entre ejecuciones", () => {
    const s = new Tangerine().session();
    s.run("let a = 2");
    s.run("fn f(x) { x * a }");
    expect(s.run("f(21)")).toBe(42);
  });

  it("marca el código incompleto para pedir más líneas", () => {
    const s = new Tangerine().session();
    try { s.run("fn f() {"); } catch (e) { expect(e.incomplete).toBe(true); return; }
    throw new Error("debió fallar");
  });
});

describe("paquete", () => {
  it("la versión coincide con package.json", () => {
    const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    expect(VERSION).toBe(pkg.version);
  });

  it("los bundles de dist se pueden cargar", async () => {
    const esm = await import("../dist/tangerine.mjs");
    expect(esm.Tangerine.runCode("println(1 + 1)").output).toEqual(["2"]);
    const { createRequire } = await import("node:module");
    const cjs = createRequire(import.meta.url)("../dist/tangerine.cjs");
    expect(cjs.runCode("println(3)").output).toEqual(["3"]);
    expect(typeof cjs.Tangerine).toBe("function");
  });
});
