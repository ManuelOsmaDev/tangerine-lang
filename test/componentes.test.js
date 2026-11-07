import { describe, it, expect } from "vitest";
import { Tangerine } from "../src/index.js";

const correr = (codigo) => {
  const out = [];
  const tng = new Tangerine({ output: (l) => out.push(l) });
  const valor = tng.run(codigo);
  return { out, valor, tng };
};

const CONTADOR = `
@Component("mi-contador")
struct Contador {
  @Input var paso = 1
  @Output var cambio
  @State var cuenta = 0

  fn sumar() {
    cuenta += paso
    cambio.emit(cuenta)
  }

  view {
    div(.tarjeta) {
      p(.numero) { "{cuenta}" }
      button("+") { sumar() }
    }
  }
}
`;

describe("componentes", () => {
  it("un view se convierte en HTML", () => {
    const { valor } = correr(CONTADOR + "render_html(Contador())");
    expect(valor).toBe('<div class="tarjeta"><p class="numero">0</p><button>+</button></div>');
  });

  it("los campos se usan sin self, como en Swift", () => {
    const { valor } = correr(CONTADOR + "let c = Contador()\nc.paso = 5\nc.sumar()\nc.sumar()\nc.cuenta");
    expect(valor).toBe(10);
  });

  it("@State avisa a los effect", () => {
    const { out } = correr(CONTADOR + 'let c = Contador()\neffect(|| log("cuenta {c.cuenta}"))\nc.sumar()\nc.sumar()');
    expect(out).toEqual(["cuenta 0", "cuenta 1", "cuenta 2"]);
  });

  it("@Output avisa a quien escucha", () => {
    const { out } = correr(CONTADOR + 'let c = Contador()\nc.cambio.listen(|v| log("cambió a {v}"))\nc.sumar()');
    expect(out).toEqual(["cambió a 1"]);
  });

  it("if, for, clases con guion, atributos y eventos dentro del view", () => {
    const { valor } = correr(`
struct Lista {
  var titulo = "Frutas"
  var items = ["pera", "uva"]
  var vacia = false

  view {
    h2(.titulo-grande) { titulo }
    if items.len() > 0 {
      ul {
        for (i, x) in items.enumerate() {
          li({ "data-i": i, class: if i == 0 { "primera" } else { nil } }) { x }
        }
      }
    } else {
      p { "Nada" }
    }
    a({ href: "/mas", on_click: || nil }) { "Ver más" }
  }
}
render_html(Lista())`);
    expect(valor).toBe(
      '<h2 class="titulo-grande">Frutas</h2><ul><li class="primera" data-i="0">pera</li><li data-i="1">uva</li></ul><a href="/mas">Ver más</a>'
    );
  });

  it("$campo une un input con un campo", () => {
    const { valor } = correr(`
struct Form {
  @State var nombre = "Ana"
  view {
    input(.campo, $nombre, { placeholder: "Tu nombre" })
    p { "Hola, {nombre}" }
  }
}
render_html(Form())`);
    expect(valor).toBe('<input class="campo" placeholder="Tu nombre" value="Ana"><p>Hola, Ana</p>');
  });

  it("un componente dentro de otro", () => {
    const { valor } = correr(`
struct Saludo {
  var nombre = "mundo"
  init(n) { nombre = n }
  view { strong { "Hola, {nombre}" } }
}
struct Pagina {
  view {
    div { Saludo("Ana") }
  }
}
render_html(Pagina())`);
    expect(valor).toBe("<div><strong>Hola, Ana</strong></div>");
  });

  it("los errores explican qué falta", () => {
    const { tng } = correr("");
    expect(() => tng.run('@Component("contador")\nstruct A { view { p { "x" } } }')).toThrow(/con guion/);
    expect(() => tng.run('@Component("mi-b")\nstruct B { var x = 1 }')).toThrow(/necesita un view/);
    expect(() => tng.run("@Servicio\nstruct C { }")).toThrow(/No existe el decorador @Servicio/);
    expect(() => tng.run("struct D { @Prop var x = 1 }")).toThrow(/@State, @Input o @Output/);
  });

  it("fuera de un view, div y p siguen siendo nombres normales", () => {
    const { valor } = correr("let p = 3\nfn div(a, b) { a / b }\ndiv(p, 3)");
    expect(valor).toBe(1);
  });
});
