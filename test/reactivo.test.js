// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { Tangerine } from "../src/index.js";
import { dom } from "../src/plugins/dom.js";

const correr = (codigo) => {
  const out = [];
  const tng = new Tangerine({ output: (l) => out.push(l) });
  const valor = tng.run(codigo);
  return { out, valor, tng };
};

describe("estado reactivo", () => {
  it("state guarda, lee y cambia un valor", () => {
    const { valor } = correr("let n = state(1)\nn.set(5)\nn.update(|x| x * 2)\nn.get()");
    expect(valor).toBe(10);
  });

  it("effect se repite cuando cambia lo que lee", () => {
    const { out } = correr('let n = state(1)\neffect(|| println("n = {n.get()}"))\nn.set(2)\nn.set(2)\nn.set(3)');
    expect(out).toEqual(["n = 1", "n = 2", "n = 3"]);
  });

  it("computed se calcula solo", () => {
    const { valor } = correr("let precio = state(10)\nlet total = computed(|| precio.get() * 3)\nprecio.set(20)\ntotal.get()");
    expect(valor).toBe(60);
  });

  it("un estado se puede mostrar e interpolar directamente", () => {
    const { out } = correr('let nombre = state("Ana")\nprintln("Hola, {nombre}")\nprintln(type_of(nombre))');
    expect(out).toEqual(["Hola, Ana", "State"]);
  });

  it("las listas avisan aunque cambien por dentro", () => {
    const { out } = correr("let l = state([])\neffect(|| println(l.get().len()))\nl.update(|x| { x.push(1); x })");
    expect(out).toEqual(["0", "1"]);
  });

  it("solo observa lo que leyó la última vez", () => {
    const { out } = correr(
      'let ver = state(true)\nlet a = state("a")\nlet b = state("b")\n' +
        'effect(|| println(if ver.get() { a.get() } else { b.get() }))\n' +
        'ver.set(false)\na.set("A")\nb.set("B")'
    );
    expect(out).toEqual(["a", "b", "B"]);
  });

  it("computed no se puede cambiar a mano", () => {
    const { tng } = correr("");
    expect(() => tng.run("let d = computed(|| 1)\nd.set(2)")).toThrow();
  });

  it("avisa de un effect que se repite sin fin", () => {
    const { tng } = correr("");
    expect(() => tng.run("let n = state(0)\neffect(|| n.set(n.get() + 1))")).toThrow(/sin fin/);
  });
});

describe("estado reactivo en la página", () => {
  const pagina = (codigo) => {
    document.body.innerHTML = '<div id="app"></div>';
    const tng = new Tangerine({ plugins: [dom()], output: () => {} });
    tng.run(codigo);
    return document.querySelector("#app");
  };
  const clic = (sel) => document.querySelector(sel).dispatchEvent(new Event("click"));

  it("el texto de un elemento sigue a su estado", () => {
    const app = pagina(
      'let n = state(0)\nlet app = query("#app")\nappend(app, el("p", "numero", n))\n' +
        'on(append(app, el("button", "mas", "+")), "click", || n.update(|x| x + 1))'
    );
    clic(".mas");
    clic(".mas");
    expect(app.querySelector(".numero").textContent).toBe("2");
  });

  it("clases, atributos y visibilidad siguen a su estado", () => {
    const app = pagina(
      'let activo = state(false)\nlet p = append(query("#app"), el("p", nil, "hola"))\n' +
        'toggle_class(p, "on", activo)\nattr(p, "title", computed(|| if activo.get() { "sí" } else { nil }))\n' +
        'set_visible(p, activo)\nactivo.set(true)'
    );
    const p = app.querySelector("p");
    expect([p.className, p.title, p.hidden]).toEqual(["on", "sí", false]);
  });

  it("bind une un campo con un estado en los dos sentidos", () => {
    const app = pagina('let nombre = state("Ana")\nlet c = append(query("#app"), el("input", nil, nil))\nbind(c, nombre)\nappend(query("#app"), el("p", nil, computed(|| "Hola, {nombre}")))');
    const input = app.querySelector("input");
    expect(input.value).toBe("Ana");
    input.value = "Luis";
    input.dispatchEvent(new Event("input"));
    expect(app.querySelector("p").textContent).toBe("Hola, Luis");
  });

  it("render vuelve a dibujar una lista cuando cambia", () => {
    const app = pagina(
      'let tareas = state(["leer"])\nlet ul = append(query("#app"), el("ul", nil, nil))\n' +
        'render(ul, || tareas.get().map(|t| el("li", nil, t)))\ntareas.update(|l| { l.push("correr"); l })'
    );
    expect([...app.querySelectorAll("li")].map((li) => li.textContent)).toEqual(["leer", "correr"]);
  });

  it("el ejemplo de la lista de tareas del README funciona", () => {
    const app = pagina("let tareas = state([])\nlet nueva = state(\"\")\nlet app = query(\"#app\")\n\nlet campo = append(app, el(\"input\", nil, nil))\nbind(campo, nueva)\non(campo, \"keydown\", |e| {\n  if e.key == \"Enter\" && nueva.get() != \"\" {\n    tareas.update(|l| { l.push(nueva.get()); l })\n    nueva.set(\"\")\n  }\n})\n\nappend(app, el(\"p\", nil, computed(|| \"{tareas.get().len()} tareas\")))\nrender(append(app, el(\"ul\", nil, nil)), || tareas.get().map(|t| el(\"li\", nil, t)))\n");
    const input = app.querySelector("input");
    for (const v of ["leer", "correr"]) {
      input.value = v;
      input.dispatchEvent(new Event("input"));
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    }
    expect(input.value).toBe("");
    expect(app.querySelector("p").textContent).toBe("2 tareas");
    expect([...app.querySelectorAll("li")].map((li) => li.textContent)).toEqual(["leer", "correr"]);
  });
});
