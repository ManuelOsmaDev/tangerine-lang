import { describe, it, expect, afterEach, vi } from "vitest";
import { Tangerine } from "../src/index.js";

// Ejecuta el programa y espera a la promesa de main() si la hay.
async function correr(codigo) {
  const out = [];
  const tng = new Tangerine({ output: (l) => out.push(l) });
  const r = tng.run(codigo);
  const valor = r instanceof Promise ? await r : r;
  return { out, valor };
}

const respuesta = (cuerpo, status = 200) =>
  Promise.resolve({ ok: status < 400, status, text: () => Promise.resolve(typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo)) });

afterEach(() => vi.unstubAllGlobals());

describe("async y await", () => {
  it("una async fn espera y devuelve su último valor", async () => {
    const { out, valor } = await correr(`
async fn cargar() {
  log("empieza")
  await sleep(5)
  log("terminó")
  42
}
log("antes")
cargar()`);
    expect(valor).toBe(42);
    expect(out).toEqual(["antes", "empieza", "terminó"]);
  });

  it("let, asignación y return con await, también en if, for y while", async () => {
    const { valor } = await correr(`
async fn doble(x) { await sleep(1); x * 2 }
async fn main() {
  var total = 0
  for n in [1, 2, 3] {
    let d = await doble(n)
    total += d
  }
  while total < 20 { total = await doble(total) }
  if total > 10 { return await doble(total) }
  0
}
main()`);
    expect(valor).toBe(48);
  });

  it("fetch_json lee JSON y envía el body como JSON", async () => {
    const fetch = vi.fn(() => respuesta({ nombre: "Ana", edades: [1, 2] }));
    vi.stubGlobal("fetch", fetch);
    const { valor } = await correr(`
async fn main() {
  let u = await fetch_json("https://api.test/u", { method: "post", body: { x: 1 } })
  "{u.nombre} {u.edades.len()}"
}
main()`);
    expect(valor).toBe("Ana 2");
    const [url, init] = fetch.mock.calls[0];
    expect([url, init.method, init.body, init.headers["Content-Type"]]).toEqual(["https://api.test/u", "POST", '{"x":1}', "application/json"]);
  });

  it("do/catch atrapa un error HTTP", async () => {
    vi.stubGlobal("fetch", () => respuesta("no hay", 404));
    const { valor } = await correr(`
async fn main() {
  do {
    await fetch_text("https://api.test/x")
    "no debería llegar"
  } catch e {
    e.message
  }
}
main()`);
    expect(valor).toBe("HTTP 404 al pedir https://api.test/x");
  });

  it("await en otro lugar da un error que explica dónde va", async () => {
    const tng = new Tangerine({ output: () => {} });
    await expect(tng.run("async fn f() { log(await sleep(1)) }\nf()")).rejects.toThrow(/al inicio de una línea/);
    expect(Tangerine.runCode("let x = await sleep(1)").error).toMatch(/await va al inicio de una línea dentro de una async fn/);
  });

  it("type_of de una async fn llamada es Promise", async () => {
    const { valor } = await correr("async fn f() { 1 }\ntype_of(f())");
    expect(valor).toBe("Promise");
  });

  it("closures y métodos async", async () => {
    const { valor } = await correr(`
struct Api {
  var base = 10
  async fn sumar(x) { await sleep(1); base + x }
}
let f = async |x| { await sleep(1); x + 1 }
async fn main() {
  let a = await Api().sumar(5)
  let b = await f(a)
  b
}
main()`);
    expect(valor).toBe(16);
  });
});
