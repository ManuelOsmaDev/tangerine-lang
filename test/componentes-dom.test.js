// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { Tangerine } from "../src/index.js";
import { dom } from "../src/plugins/dom.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let n = 0;
// Cada prueba usa una etiqueta distinta: customElements no deja registrar dos veces la misma.
const contador = (tag) => `
@Component("${tag}")
struct Contador {
  @Input var paso = 1
  @Input var titulo = "Cuenta"
  @Output var cambio
  @State var cuenta = 0

  fn sumar() {
    cuenta += paso
    cambio.emit(cuenta)
  }

  view {
    div(.tarjeta) {
      h3 { titulo }
      p(.numero) { "{cuenta}" }
      button("+") { sumar() }
    }
  }
}`;

const nueva = (codigo) => {
  document.body.innerHTML = '<div id="app"></div>';
  const errores = [];
  const tng = new Tangerine({ plugins: [dom()], output: () => {}, onError: (m) => errores.push(m) });
  tng.run(codigo);
  return { tng, errores, app: document.querySelector("#app") };
};
const clic = (el) => el.dispatchEvent(new Event("click", { bubbles: true }));

describe("componentes en la página", () => {
  it("mount dibuja y actualiza sin rehacer los elementos", () => {
    const tag = `t-uno-${++n}`;
    const { app } = nueva(contador(tag) + '\nmount("#app", Contador)');
    const p = app.querySelector(".numero");
    clic(app.querySelector("button"));
    clic(app.querySelector("button"));
    expect(app.querySelector(".numero").textContent).toBe("2");
    expect(app.querySelector(".numero")).toBe(p);
  });

  it("$campo mantiene el foco y lo escrito", () => {
    const { app } = nueva(`
struct Form {
  @State var nombre = ""
  view {
    input(.campo, $nombre)
    p { if nombre == "" { "Escribe tu nombre" } else { "Hola, {nombre}" } }
  }
}
mount("#app", Form)`);
    const input = app.querySelector("input");
    input.focus();
    input.value = "Ana";
    input.dispatchEvent(new Event("input"));
    expect(app.querySelector("p").textContent).toBe("Hola, Ana");
    expect(app.querySelector("input")).toBe(input);
    expect(document.activeElement).toBe(input);
  });

  it("listas que crecen y eventos con on_", () => {
    const { app } = nueva(`
struct Tareas {
  @State var tareas = ["leer"]
  view {
    ul { for t in tareas { li { t } } }
    button(.agregar, { on_click: || tareas.push("correr") }) 
    button(.otra) { tareas = tareas + ["nadar"] }
  }
}
mount("#app", Tareas)`);
    clic(app.querySelector(".otra"));
    expect([...app.querySelectorAll("li")].map((x) => x.textContent)).toEqual(["leer", "nadar"]);
  });

  it("como Web Component en HTML: atributos y eventos", () => {
    const tag = `t-html-${++n}`;
    nueva(contador(tag));
    document.body.insertAdjacentHTML("beforeend", `<${tag} paso="5" titulo="Puntos"></${tag}>`);
    const el = document.querySelector(tag);
    const vistos = [];
    el.addEventListener("cambio", (e) => vistos.push(e.detail));
    clic(el.querySelector("button"));
    clic(el.querySelector("button"));
    expect(el.querySelector("h3").textContent).toBe("Puntos");
    expect(el.querySelector(".numero").textContent).toBe("10");
    expect(vistos).toEqual([5, 10]);
    el.setAttribute("titulo", "Nuevo");
    expect(el.querySelector("h3").textContent).toBe("Nuevo");
  });

  it("como lo usa Angular: [paso] y (cambio)", () => {
    const tag = `t-ng-${++n}`;
    nueva(contador(tag));
    const el = document.createElement(tag);
    el.paso = 3; // Angular asigna la propiedad antes de conectar el elemento
    const vistos = [];
    el.addEventListener("cambio", (e) => vistos.push(e.detail));
    document.body.appendChild(el);
    clic(el.querySelector("button"));
    el.paso = 10;
    clic(el.querySelector("button"));
    expect(vistos).toEqual([3, 13]);
    expect(el.paso).toBe(10);
  });

  it("dentro de una app de React", async () => {
    const tag = `t-react-${++n}`;
    nueva(contador(tag));
    const vistos = [];
    function App() {
      const ref = React.useRef(null);
      const [paso, setPaso] = React.useState(2);
      React.useEffect(() => {
        const el = ref.current;
        const f = (e) => vistos.push(e.detail);
        el.addEventListener("cambio", f);
        return () => el.removeEventListener("cambio", f);
      }, []);
      return React.createElement("div", null,
        React.createElement(tag, { ref, paso: String(paso), titulo: "Desde React" }),
        React.createElement("button", { id: "subir", onClick: () => setPaso(7) }, "paso 7"));
    }
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(React.createElement(App)));
    const el = host.querySelector(tag);
    await act(async () => clic(el.querySelector(".tarjeta button")));
    await act(async () => clic(host.querySelector("#subir")));
    await act(async () => clic(el.querySelector(".tarjeta button")));
    expect(el.querySelector("h3").textContent).toBe("Desde React");
    expect(vistos).toEqual([2, 9]);
    await act(async () => root.unmount());
  });

  it("un componente de Tangerine dentro de otro, pasando datos", () => {
    const tag = `t-hijo-${++n}`;
    const { app } = nueva(contador(tag) + `
struct Pagina {
  @State var total = 0
  view {
    p(.total) { "Total: {total}" }
    element("${tag}", { paso: 4, on_cambio: |e| { total = e.detail } })
  }
}
mount("#app", Pagina)`);
    clic(app.querySelector(`${tag} button`));
    expect(app.querySelector(".total").textContent).toBe("Total: 4");
    expect(app.querySelector(`${tag} .numero`).textContent).toBe("4");
  });

  it("el ejemplo de componentes del README funciona", () => {
    const { app, errores } = nueva("struct Tareas {\n  @State var tareas = []\n  @State var nueva = \"\"\n\n  fn agregar() {\n    if nueva != \"\" {\n      tareas = tareas + [nueva]\n      nueva = \"\"\n    }\n  }\n\n  view {\n    h2 { \"Pendientes ({tareas.len()})\" }\n    input(.campo, $nueva, { placeholder: \"Nueva tarea\", on_keydown: |e| { if e.key == \"Enter\" { agregar() } } })\n    button(.boton, \"Agregar\") { agregar() }\n\n    if tareas.len() == 0 {\n      p(.vacio) { \"No hay tareas\" }\n    } else {\n      ul {\n        for t in tareas { li { t } }\n      }\n    }\n  }\n}\n\nmount(\"#app\", Tareas)\n");
    const input = app.querySelector("input");
    for (const v of ["leer", "correr"]) {
      input.value = v;
      input.dispatchEvent(new Event("input"));
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    }
    expect(errores).toEqual([]);
    expect(app.querySelector("h2").textContent).toBe("Pendientes (2)");
    expect([...app.querySelectorAll("li")].map((x) => x.textContent)).toEqual(["leer", "correr"]);
    expect(app.querySelector("input").value).toBe("");
  });
});

describe("ciclo de vida y listas con key", () => {
  it("on_mount puede cargar datos con await y on_destroy limpia", async () => {
    const tag = `t-vida-${++n}`;
    vi.stubGlobal("fetch", () => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('[{"id":1,"nombre":"Ana"},{"id":2,"nombre":"Luis"}]') }));
    nueva(`

@Component("${tag}")
struct Usuarios {
  @State var usuarios = []
  @State var cargando = true
  async fn on_mount() {
    usuarios = await fetch_json("/api/usuarios")
    cargando = false
  }
  fn on_destroy() { save("destruido", 1) }
  view {
    if cargando { p { "Cargando..." } }
    ul { for u in usuarios { li({ key: u.id }) { u.nombre } } }
  }
}`);
    document.body.insertAdjacentHTML("beforeend", `<${tag}></${tag}>`);
    const el = document.querySelector(tag);
    expect(el.textContent).toContain("Cargando...");
    await new Promise((r) => setTimeout(r, 10));
    expect([...el.querySelectorAll("li")].map((x) => x.textContent)).toEqual(["Ana", "Luis"]);
    expect(el.querySelector("p")).toBeNull();
    el.remove();
    expect(localStorage.getItem("destruido")).toBe("1");
    vi.unstubAllGlobals();
  });

  it("con key, reordenar una lista conserva cada fila y lo escrito en ella", () => {
    const { app } = nueva(`
struct Lista {
  @State var items = [{ id: 1, n: "a" }, { id: 2, n: "b" }, { id: 3, n: "c" }]
  view {
    ul {
      for it in items {
        li({ key: it.id }) {
          span { it.n }
          input({ class: "nota" })
        }
      }
    }
    button(.invertir) { items = items.reversed() }
    button(.quitar) { items = items.filter(|x| x.id != 2) }
  }
}
mount("#app", Lista)`);
    const filas = [...app.querySelectorAll("li")];
    filas[0].querySelector("input").value = "nota de a";
    clic(app.querySelector(".invertir"));
    const despues = [...app.querySelectorAll("li")];
    expect(despues.map((x) => x.querySelector("span").textContent)).toEqual(["c", "b", "a"]);
    expect(despues[2]).toBe(filas[0]);
    expect(despues[2].querySelector("input").value).toBe("nota de a");
    expect(despues[0].hasAttribute("key")).toBe(false);
    clic(app.querySelector(".quitar"));
    expect([...app.querySelectorAll("li span")].map((x) => x.textContent)).toEqual(["c", "a"]);
  });
});

describe("ref y raw", () => {
  it("ref recibe el elemento y raw deja sus hijos en paz", async () => {
    const { app } = nueva(`
struct Grafico {
  @State var n = 0
  view {
    p(.n) { "{n}" }
    div(.lienzo, { raw: true, ref: |el| el_text(el) })
    button(.mas) { n += 1 }
  }
}
fn el_text(nodo) { append(nodo, el("canvas", "externo", nil)) }
mount("#app", Grafico)`);
    await new Promise((r) => setTimeout(r, 0));
    expect(app.querySelector(".lienzo canvas.externo")).not.toBeNull();
    clic(app.querySelector(".mas"));
    expect(app.querySelector(".n").textContent).toBe("1");
    expect(app.querySelector(".lienzo canvas.externo")).not.toBeNull();
    expect(app.querySelector(".lienzo").hasAttribute("raw")).toBe(false);
  });
});
