import { describe, it, expect } from "vitest";
import { Tangerine, lexer, parse, sx, TngError, KEYWORDS } from "../src/index.js";

/** Ejecuta código y devuelve las líneas que escribió. */
function salida(codigo, opciones) {
  const lineas = [];
  new Tangerine({ output: (l) => lineas.push(l), ...opciones }).run(codigo);
  return lineas;
}
const error = (codigo, opciones) => new Tangerine({ stepLimit: 100000, ...opciones }).runCode(codigo).error;

describe("lexer", () => {
  it("reconoce números, strings, palabras clave y operadores", () => {
    const tipos = lexer('let x = 1_000.5 + "hola" ..= ?.').map((t) => t.type);
    expect(tipos).toEqual(["let", "id", "=", "num", "+", "str", "..=", "?.", "eof"]);
  });

  it("guarda línea y columna de cada token", () => {
    const t = lexer("let a = 1\n  println(a)");
    const p = t.find((x) => x.value === "println");
    expect([p.line, p.col]).toEqual([2, 3]);
  });

  it("separa las interpolaciones de un string", () => {
    const [t] = lexer('"hola {nombre}!"');
    expect(t.type).toBe("template");
    expect(t.parts[1]).toMatchObject({ code: "nombre" });
  });

  it("incluye import y export como palabras clave", () => {
    expect(KEYWORDS.has("import")).toBe(true);
    expect(KEYWORDS.has("export")).toBe(true);
  });

  it("marca como incompletos los strings sin cerrar", () => {
    try { lexer('"abc'); } catch (e) { expect(e.incomplete).toBe(true); return; }
    throw new Error("debió fallar");
  });
});

describe("parser", () => {
  it("respeta la precedencia de operadores", () => {
    expect(sx(parse("2 + 3 * 4"))).toBe("(+ 2 (* 3 4))");
    expect(sx(parse("2 ** 3 ** 2"))).toBe("(** 2 (** 3 2))");
  });

  it("acepta anotaciones de tipo y las ignora", () => {
    expect(() => parse("fn f(a: Int, b: [String]?) -> Map<String, Int> { a }")).not.toThrow();
  });

  it("informa línea y columna en errores de sintaxis", () => {
    try { parse("let x = [1, 2\nprintln(x)"); }
    catch (e) {
      expect(e).toBeInstanceOf(TngError);
      expect([e.line, e.col]).toEqual([2, 1]);
      expect(e.message).toContain("Se esperaba ']'");
      return;
    }
    throw new Error("debió fallar");
  });

  it("no permite import dentro de un bloque", () => {
    expect(() => parse('fn f() { import { a } from "./x" }')).toThrow(/nivel superior/);
  });
});

describe("evaluador", () => {
  it("escribe con println y print", () => {
    expect(salida('print("a ")\nprint("b")\nprintln()\nprintln(1, 2.5, true, nil)')).toEqual(["a b", "1 2.5 true nil"]);
  });

  it("interpola expresiones en strings", () => {
    expect(salida('let f = "lima"\nprintln("{f.upper()} {2 + 3}")')).toEqual(["LIMA 5"]);
  });

  it("protege las constantes declaradas con let", () => {
    expect(error("let a = 1\na = 2")).toMatch(/No se puede asignar dos veces a 'a'/);
  });

  it("soporta match con rangos, guardas y alternativas", () => {
    const codigo = `fn nota(n) {
      match n {
        90..=100 => "A",
        80..90 => "B",
        0 | 1 => "casi cero",
        x if x < 0 => "negativo",
        _ => "F",
      }
    }
    println(nota(95), nota(85), nota(1), nota(-3), nota(40))`;
    expect(salida(codigo)).toEqual(["A B casi cero negativo F"]);
  });

  it("tiene closures que recuerdan su entorno", () => {
    const codigo = `fn contador() {
      var n = 0
      || { n += 1; n }
    }
    let c = contador()
    c()
    println(c(), c())`;
    expect(salida(codigo)).toEqual(["2 3"]);
  });

  it("soporta clases, herencia y super", () => {
    const codigo = `class Fruta {
      var peso = 1
      init(nombre) { self.nombre = nombre }
      fn describe() { "{self.nombre} de {self.peso} kg" }
    }
    class Mandarina : Fruta {
      fn describe() { "Mandarina: " + super.describe() }
    }
    let m = Mandarina("clementina")
    m.peso = 2
    println(m.describe(), type_of(m))`;
    expect(salida(codigo)).toEqual(["Mandarina: clementina de 2 kg Mandarina"]);
  });

  it("atrapa errores con do / catch y lanza con throw", () => {
    const codigo = `do { throw "mal" } catch e { println(e.message) }
    do { let x = falta + 1 } catch { println(error.line, error.message) }`;
    expect(salida(codigo)).toEqual(["mal", "2 No existe 'falta' en este ámbito"]);
  });

  it("tiene métodos de listas, strings, números y mapas", () => {
    const codigo = `let l = [3, 1, 2, 3]
    println(l.sorted(), l.unique(), l.sum(), l.map(|x| x * 2).filter(|x| x > 4))
    println("a,b".split(","), "hola".reversed(), "42".parse() + 1)
    println(3.7.floor(), 10.clamp(0, 5), 3.times(|i| i))
    let m = { a: 1 }
    m.b = 2
    println(m.keys(), m.has("b"), m.get("z", 0))
    println(["bb", "a", "ccc"].sorted_by_key(|s| s.len()))`;
    expect(salida(codigo)).toEqual([
      "[1, 2, 3, 3] [3, 1, 2] 9 [6, 6]",
      '["a", "b"] aloh 43',
      "3 5 [0, 1, 2]",
      '["a", "b"] true 0',
      '["a", "bb", "ccc"]',
    ]);
  });

  it("compara listas y mapas por contenido", () => {
    expect(salida("println([1, [2]] == [1, [2]], { a: 1 } == { a: 1 }, { a: 1 } == { a: 2 })")).toEqual(["true true false"]);
  });

  it("convierte a JSON y de vuelta", () => {
    expect(salida(`let v = from_json('{"a": [1, 2], "b": null}')\nprintln(v.a, v.b, to_json(v))`)).toEqual(['[1, 2] nil {"a":[1,2],"b":null}']);
  });

  it("devuelve el valor de la última instrucción", () => {
    expect(new Tangerine().run("let a = 20\na + 22")).toBe(42);
  });
});

describe("errores en español", () => {
  it("indica la línea de los errores de ejecución", () => {
    expect(error("let x = 1\nprintln(x.nada())")).toBe("Línea 2: Int no tiene un método llamado 'nada'");
  });

  it("detiene ciclos infinitos con el límite de pasos", () => {
    expect(error("loop { }")).toMatch(/demasiados pasos/);
  });

  it("detecta recursión infinita", () => {
    expect(error("fn f(n) { f(n + 1) }\nf(0)")).toMatch(/Desbordamiento de pila/);
  });

  it("explica la división entre cero", () => {
    expect(error("println(1 / 0)")).toBe("Línea 1: División entre cero");
  });

  it("run() lanza TngError con el mensaje completo", () => {
    const tng = new Tangerine();
    try { tng.run("println(nada)", { file: "app.tng" }); }
    catch (e) {
      expect(e).toBeInstanceOf(TngError);
      expect(tng.message(e)).toBe("app.tng, línea 1: No existe 'nada' en este ámbito");
      return;
    }
    throw new Error("debió fallar");
  });
});
