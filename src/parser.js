// ─────────────── 2. Parser: tokens a árbol de sintaxis ───────────────
import { TngError } from "./errores.js";
import { lexer, describe } from "./lexer.js";

const ASSIGN_OPS = new Set(["=", "+=", "-=", "*=", "/="]);
const ASSIGNABLE = new Set(["var", "member", "index"]);

// Etiquetas HTML que se pueden escribir directamente dentro de un view { }.
export const TAGS = new Set((
  "div span p a button h1 h2 h3 h4 h5 h6 ul ol li img input textarea select option label form " +
  "section header footer main nav article aside strong em small code pre table thead tbody tr td th " +
  "br hr figure figcaption details summary video audio canvas i b"
).split(" "));
const FIELD_DECORATORS = new Set(["State", "Input", "Output"]);

/**
 * Convierte tokens en un árbol de sintaxis.
 * @param {Array} tokens
 * @param {"expr"|{mode?: "expr", file?: string}} [opciones]
 */
export function parser(tokens, opciones) {
  const o = typeof opciones === "string" ? { mode: opciones } : opciones || {};
  const file = o.file || null;
  let pos = 0;
  let depth = 0;
  let inView = 0;   // > 0 dentro de un view { }: las etiquetas HTML crean elementos
  let noBrace = 0;  // > 0 en la condición de un if/while/for/match: '{' abre el bloque, no un elemento

  const peek = (k) => tokens[Math.min(pos + (k || 0), tokens.length - 1)];
  const is = (type) => peek().type === type;
  const isWord = (w) => peek().type === "id" && peek().value === w;
  const accept = (type) => { if (is(type)) { pos++; return true; } return false; };
  const fail = (msg, tok) => {
    const t = tok || peek();
    const e = new TngError(msg, t.line, t.col, file);
    e.incomplete = t.type === "eof";
    return e;
  };
  const expect = (type, what) => {
    if (!is(type)) throw fail(`Se esperaba ${what || "'" + type + "'"} pero se encontró ${describe(peek())}`);
    return tokens[pos++];
  };
  const endStmt = () => { accept(";"); };
  const sameLine = () => pos > 0 && peek().line === tokens[pos - 1].line;

  // Las anotaciones de tipo documentan el código; se aceptan y se ignoran.
  function skipType() {
    if (accept("[")) { skipType(); expect("]"); }
    else if (accept("(")) { while (!is(")") && !is("eof")) { skipType(); if (!accept(",")) break; } expect(")"); }
    else expect("id", "un nombre de tipo");
    if (accept("<")) { while (!is(">") && !is("eof")) { skipType(); if (!accept(",")) break; } expect(">"); }
    accept("?");
  }

  function block() {
    const open = peek();
    expect("{", "'{' para abrir un bloque");
    depth++;
    const savedBrace = noBrace;
    noBrace = 0;
    const body = [];
    if (inView > 0) body.view = true;
    while (!is("}")) {
      if (is("eof")) throw fail(`Falta '}' para cerrar el bloque abierto en la línea ${open.line}`);
      body.push(statement());
    }
    expect("}");
    noBrace = savedBrace;
    depth--;
    return body;
  }

  // Un bloque de código normal aunque esté dentro de un view (cuerpo de función o closure).
  function codeBlock() {
    const saved = inView;
    inView = 0;
    try { return block(); } finally { inView = saved; }
  }
  function codeExpr() {
    const saved = inView;
    inView = 0;
    try { return expression(); } finally { inView = saved; }
  }
  // La condición de un if/while/for/match: ahí '{' abre el bloque.
  function header() {
    noBrace++;
    try { return expression(); } finally { noBrace--; }
  }

  function decorators() {
    const list = [];
    while (accept("@")) {
      const n = expect("id", "el nombre del decorador");
      list.push({ name: n.value, args: accept("(") ? args(")") : [], line: n.line });
    }
    return list;
  }

  // Devuelve los nombres; los valores por defecto quedan en ps.defaults
  function params(close) {
    const ps = [], defaults = [];
    while (!is(close)) {
      ps.push(expect("id", "el nombre de un parámetro").value);
      if (accept(":")) skipType();
      if (accept("=")) defaults[ps.length - 1] = close === "|" ? add() : expression();
      else if (defaults.length) throw fail(`El parámetro '${ps[ps.length - 1]}' necesita un valor por defecto porque va después de otro que lo tiene`, tokens[pos - 1]);
      if (!accept(",")) break;
    }
    expect(close, `'${close}' para cerrar los parámetros`);
    ps.defaults = defaults.length ? defaults : null;
    return ps;
  }

  function fnRest(name, L) {
    expect("(", "'(' con los parámetros");
    const ps = params(")");
    if (accept("->")) skipType();
    return { type: "function", name, params: ps, defaults: ps.defaults, body: codeBlock(), line: L, file };
  }

  function binding() {
    if (accept("(")) {
      const names = [];
      while (!is(")")) { names.push(expect("id", "un nombre").value); if (!accept(",")) break; }
      expect(")");
      return names;
    }
    return expect("id", "un nombre").value;
  }

  function stringLiteral(what) {
    const t = peek();
    if (t.type !== "str") throw fail(`Se esperaba ${what} entre comillas pero se encontró ${describe(t)}`);
    pos++;
    return t.value;
  }

  // import { a, b as c } from "./ruta.tng"   |   import modulo from "./ruta.tng"
  function importStmt(L) {
    if (depth > 0) throw fail("import solo puede ir en el nivel superior del archivo, fuera de bloques y funciones");
    pos++;
    let names = null, alias = null;
    if (accept("{")) {
      names = [];
      while (!is("}")) {
        if (is("eof")) throw fail("Falta '}' para cerrar la lista del import");
        const name = expect("id", "un nombre para importar").value;
        let local = name;
        if (isWord("as")) { pos++; local = expect("id", "el nombre local después de as").value; }
        names.push([name, local]);
        if (!accept(",")) break;
      }
      expect("}", "'}' para cerrar la lista del import");
    } else {
      alias = expect("id", "un nombre o '{' después de import").value;
    }
    if (!isWord("from")) throw fail(`Se esperaba 'from' después de import pero se encontró ${describe(peek())}`);
    pos++;
    const path = stringLiteral("la ruta del módulo");
    endStmt();
    return { type: "import", names, alias, path, line: L };
  }

  function exportStmt(L) {
    if (depth > 0) throw fail("export solo puede ir en el nivel superior del archivo");
    pos++;
    if (!(is("let") || is("var") || is("fn") || is("class") || is("struct") || is("@")))
      throw fail(`Después de export va let, var, fn, class o struct, pero se encontró ${describe(peek())}`);
    const decl = statement();
    const names = decl.type === "class" ? [decl.name] : Array.isArray(decl.target) ? decl.target : [decl.target];
    return { type: "export", decl, names, line: L };
  }

  function statement() {
    const t = peek(), L = t.line;
    switch (t.type) {
      case "import": return importStmt(L);
      case "export": return exportStmt(L);
      case "@": {
        const decs = decorators();
        if (is("export") && (peek(1).type === "struct" || peek(1).type === "class")) {
          const ex = exportStmt(L);
          ex.decl.decorators = decs;
          return ex;
        }
        if (!is("struct") && !is("class")) throw fail(`Un decorador como @${decs[0].name} va justo antes de un struct o una class`);
        const st = statement();
        st.decorators = decs;
        return st;
      }
      case "let": case "var": {
        pos++;
        const target = binding();
        if (accept(":")) skipType();
        let value = null;
        if (accept("=")) value = expression();
        else if (t.type === "let")
          throw fail(`let ${Array.isArray(target) ? "(...)" : target} necesita un valor. Usa var si lo vas a asignar después`, t);
        endStmt();
        return { type: "decl", constant: t.type === "let", target, value, line: L };
      }
      case "async":
        if (peek(1).type === "fn" && peek(2).type === "id") {
          pos += 2;
          const name = expect("id").value;
          const f = fnRest(name, L);
          f.isAsync = true;
          return { type: "decl", constant: true, target: name, value: f, line: L };
        }
        break;
      case "fn":
        if (peek(1).type === "id") {
          pos++;
          const name = expect("id").value;
          return { type: "decl", constant: true, target: name, value: fnRest(name, L), line: L };
        }
        break;
      case "class": case "struct": {
        pos++;
        const name = expect("id", "el nombre de la clase").value;
        let parent = null;
        if (accept(":")) { const p = expect("id", "el nombre de la clase padre"); parent = { type: "var", name: p.value, line: p.line }; }
        expect("{", "'{' para abrir la clase");
        depth++;
        const methods = [], fields = [];
        while (!is("}")) {
          if (is("eof")) throw fail(`Falta '}' para cerrar la clase ${name}`);
          const fdecs = is("@") ? decorators() : null;
          if (fdecs) {
            for (const d of fdecs)
              if (!FIELD_DECORATORS.has(d.name)) throw fail(`@${d.name} no se puede usar en un campo. Usa @State, @Input o @Output`, tokens[pos - 1]);
            if (!is("let") && !is("var")) throw fail(`Después de @${fdecs[0].name} va var y el nombre del campo`);
          }
          if (is("let") || is("var")) {
            pos++;
            const f = expect("id", "el nombre de un campo");
            if (accept(":")) skipType();
            const value = accept("=") ? expression() : { type: "lit", value: null, line: f.line };
            fields.push({ name: f.value, value, decor: fdecs ? fdecs[0].name : null });
            endStmt();
            continue;
          }
          if (isWord("view") && peek(1).type === "{") {
            const v = tokens[pos++];
            inView++;
            let body;
            try { body = block(); } finally { inView--; }
            methods.push({ type: "function", name: "view", params: [], defaults: null, body, isView: true, line: v.line, file });
            continue;
          }
          const asyncMethod = accept("async");
          accept("fn");
          const m = expect("id", "el nombre de un método");
          const fm = fnRest(m.value, m.line);
          if (asyncMethod) fm.isAsync = true;
          methods.push(fm);
          accept(";");
        }
        expect("}");
        depth--;
        return { type: "class", name, parent, methods, fields, line: L };
      }
      case "if": return { type: "exp", exp: ifExpr(), line: L };
      case "match": return { type: "exp", exp: matchExpr(), line: L };
      case "while": { pos++; const cond = header(); return { type: "while", cond, body: block(), line: L }; }
      case "loop": { pos++; return { type: "loop", body: block(), line: L }; }
      case "for": {
        pos++;
        const target = binding();
        expect("in", "'in' después de la variable del for");
        const iter = header();
        return { type: "for", target, iter, body: block(), line: L };
      }
      case "break": pos++; endStmt(); return { type: "break", line: L };
      case "continue": pos++; endStmt(); return { type: "continue", line: L };
      case "return": {
        pos++;
        let value = null;
        if (!is(";") && !is("}") && !is("eof") && sameLine()) value = expression();
        endStmt();
        return { type: "return", value, line: L };
      }
      case "throw": { pos++; const value = expression(); endStmt(); return { type: "throw", value, line: L }; }
      case "do": {
        pos++;
        const body = block();
        expect("catch", "catch después del bloque do");
        let name = "error";
        if (accept("(")) { name = expect("id").value; expect(")"); }
        else if (is("id")) name = expect("id").value;
        return { type: "try", body, name, handler: block(), line: L };
      }
      case "else":
        throw fail("else debe ir justo después del bloque de un if", t);
    }
    const exp = expression();
    if (ASSIGN_OPS.has(peek().type)) {
      const opTok = tokens[pos++];
      if (!ASSIGNABLE.has(exp.type)) throw fail("No se puede asignar a esta expresión", opTok);
      const value = expression();
      endStmt();
      return { type: "assign", target: exp, op: opTok.type, value, line: L };
    }
    endStmt();
    return { type: "exp", exp, line: L };
  }

  function ifExpr() {
    const L = peek().line;
    expect("if");
    const cond = header();
    const then = block();
    let otherwise = null;
    if (accept("else")) {
      if (is("if")) {
        otherwise = [{ type: "exp", exp: ifExpr(), line: peek().line }];
        if (inView > 0) otherwise.view = true;
      } else otherwise = block();
    }
    return { type: "if", cond, then, otherwise, line: L };
  }

  function pattern() {
    const t = peek();
    if (t.type === "id") {
      pos++;
      return t.value === "_" ? { kind: "any" } : { kind: "bind", name: t.value };
    }
    const lit = () => {
      const neg = accept("-");
      const x = peek();
      if (x.type === "num") { pos++; return neg ? -x.value : x.value; }
      if (neg) throw fail("Se esperaba un número después de '-' en el patrón", x);
      if (x.type === "str") { pos++; return x.value; }
      if (x.type === "true") { pos++; return true; }
      if (x.type === "false") { pos++; return false; }
      if (x.type === "nil") { pos++; return null; }
      throw fail(`${describe(x)} no se puede usar como patrón`, x);
    };
    const a = lit();
    if (is("..") || is("..=")) {
      const inclusive = tokens[pos++].type === "..=";
      return { kind: "range", from: a, to: lit(), inclusive };
    }
    return { kind: "lit", value: a };
  }

  function matchExpr() {
    const L = peek().line;
    expect("match");
    const value = header();
    expect("{", "'{' para abrir el match");
    const arms = [];
    while (!is("}")) {
      if (is("eof")) throw fail("Falta '}' para cerrar el match");
      const pats = [pattern()];
      while (accept("|")) pats.push(pattern());
      const guard = accept("if") ? expression() : null;
      expect("=>", "'=>' después del patrón");
      let body, isBlock = false;
      if (is("{")) { body = block(); isBlock = true; } else body = expression();
      arms.push({ pats, guard, body, isBlock });
      accept(",");
    }
    expect("}");
    return { type: "match", value, arms, line: L };
  }

  // Expresiones, de menor a mayor precedencia
  const expression = () => coalesce();
  function leftAssoc(next, ops) {
    const set = new Set(ops);
    return function () {
      let left = next();
      while (set.has(peek().type)) {
        // "||" y "-" al inicio de una línea empiezan otra instrucción (un closure o un número negativo)
        if ((peek().type === "||" || peek().type === "-") && !sameLine()) break;
        const L = peek().line, op = tokens[pos++].type;
        left = { type: "bin", op, left, right: next(), line: L };
      }
      return left;
    };
  }
  function power() {
    const b = unary();
    if (is("**")) { const L = peek().line; pos++; return { type: "bin", op: "**", left: b, right: power(), line: L }; }
    return b;
  }
  function unary() {
    if (is("await")) { const L = peek().line; pos++; return { type: "await", value: unary(), line: L }; }
    if (is("-") || is("!")) { const L = peek().line, op = tokens[pos++].type; return { type: "unary", op, value: unary(), line: L }; }
    return postfix();
  }
  const mul = leftAssoc(power, ["*", "/", "%"]);
  const add = leftAssoc(mul, ["+", "-"]);
  function range() {
    const from = add();
    if (is("..") || is("..=")) {
      const L = peek().line, inclusive = tokens[pos++].type === "..=";
      return { type: "range", from, to: add(), inclusive, line: L };
    }
    return from;
  }
  const compare = leftAssoc(range, ["<", ">", "<=", ">="]);
  const equality = leftAssoc(compare, ["==", "!="]);
  const and = leftAssoc(equality, ["&&"]);
  const or = leftAssoc(and, ["||"]);
  const coalesce = leftAssoc(or, ["??"]);

  function propName() {
    const t = peek();
    if (typeof t.value === "string" && /^[A-Za-zÀ-ɏ_]/.test(t.value)) { pos++; return t.value; }
    throw fail(`Se esperaba el nombre de una propiedad después de '.' pero se encontró ${describe(t)}`, t);
  }
  function args(close) {
    const list = [];
    while (!is(close)) {
      if (is("eof")) throw fail(`Falta '${close}'`);
      list.push(expression());
      if (!accept(",")) break;
    }
    expect(close, `'${close}'`);
    return list;
  }
  function postfix() {
    let e = primary();
    for (;;) {
      const L = peek().line;
      if (is("(") && sameLine()) { pos++; e = { type: "call", fn: e, args: args(")"), line: L }; }
      else if (is("[") && sameLine()) { pos++; const index = expression(); expect("]", "']'"); e = { type: "index", obj: e, index, line: L }; }
      else if (is(".")) { pos++; e = { type: "member", obj: e, name: propName(), line: L }; }
      else if (is("?.")) { pos++; e = { type: "member", obj: e, name: propName(), optional: true, line: L }; }
      else return e;
    }
  }
  function closure(ps, L) {
    if (is("{")) return { type: "function", name: "closure", params: ps, defaults: ps.defaults, body: codeBlock(), closure: true, line: L, file };
    return { type: "function", name: "closure", params: ps, defaults: ps.defaults, body: codeExpr(), isExpr: true, closure: true, line: L, file };
  }
  // Un elemento dentro de un view: div(.clase, "texto", { atributo: valor }) { hijos }
  // button("Texto") { acción } ejecuta el bloque al hacer clic.
  // element("mi-etiqueta", { prop: valor }) crea cualquier etiqueta, por ejemplo otro componente.
  function elem() {
    const t = tokens[pos++], L = t.line;
    const list = [];
    let tag = { type: "lit", value: t.value, line: L };
    if (accept("(")) {
      if (t.value === "element") {
        tag = codeExpr();
        accept(",");
      }
      while (!is(")")) {
        if (is("eof")) throw fail("Falta ')' para cerrar el elemento");
        if (is(".") && peek(1).type === "id") {
          pos++;
          let last = tokens[pos++];
          let name = last.value;
          // .boton-grande: un guion pegado sigue siendo parte del nombre de la clase
          while (is("-") && peek(1).type === "id" && peek().line === last.line &&
            peek().col === last.col + String(last.value).length && peek(1).col === peek().col + 1) {
            pos++;
            last = tokens[pos++];
            name += "-" + last.value;
          }
          list.push({ type: "cls", name, line: L });
        } else list.push(codeExpr());
        if (!accept(",")) break;
      }
      expect(")", "')' para cerrar el elemento");
    } else if (t.value === "element") throw fail("element necesita la etiqueta: element(\"mi-etiqueta\")", t);
    let content = null, action = null;
    if (is("{") && sameLine()) {
      if (t.value === "button") action = { type: "function", name: "closure", params: [], defaults: null, body: codeBlock(), closure: true, line: L, file };
      else content = block();
    }
    return { type: "elem", tag, args: list, content, action, line: L };
  }

  function primary() {
    const t = peek(), L = t.line;
    switch (t.type) {
      case "num": case "str": pos++; return { type: "lit", value: t.value, line: L };
      case "template": pos++;
        return {
          type: "template",
          parts: t.parts.map((p) => (typeof p === "string" ? p : parser(lexer(p.code, { line: p.line, col: p.col, file }), { mode: "expr", file }))),
          line: L,
        };
      case "true": pos++; return { type: "lit", value: true, line: L };
      case "false": pos++; return { type: "lit", value: false, line: L };
      case "nil": pos++; return { type: "lit", value: null, line: L };
      case "self": pos++; return { type: "self", line: L };
      case "super": { pos++; expect(".", "'.' después de super"); return { type: "super", name: propName(), line: L }; }
      case "id": {
        const next = peek(1);
        const opens = next.line === t.line && (next.type === "(" || next.type === "{");
        if (inView > 0 && noBrace === 0 && opens && (TAGS.has(t.value) || t.value === "element")) return elem();
        pos++;
        return { type: "var", name: t.value, line: L };
      }
      case "$": {
        pos++;
        const n = expect("id", "el nombre de la variable o campo que se une, por ejemplo $nombre");
        return { type: "bindref", name: n.value, line: L };
      }
      case "|": { pos++; return closure(params("|"), L); }
      case "||": { pos++; return closure([], L); }
      case "if": return ifExpr();
      case "match": return matchExpr();
      case "(": {
        pos++;
        const first = expression();
        if (accept(",")) {
          const items = [first];
          while (!is(")")) { items.push(expression()); if (!accept(",")) break; }
          expect(")", "')'");
          return { type: "list", items, line: L };
        }
        expect(")", "')'");
        return first;
      }
      case "[": pos++; return { type: "list", items: args("]"), line: L };
      case "{": {
        pos++;
        const pairs = [];
        while (!is("}")) {
          const k = peek();
          if (k.type === "eof") throw fail("Falta '}' para cerrar el mapa");
          let key;
          if (k.type === "num") key = String(k.value);
          else if (typeof k.value === "string") key = k.value;
          else throw fail(`Se esperaba una clave pero se encontró ${describe(k)}`, k);
          pos++;
          if (accept(":")) pairs.push([key, expression()]);
          else if (k.type === "id") pairs.push([key, { type: "var", name: key, line: k.line }]);
          else expect(":", "':' después de la clave");
          if (!accept(",")) break;
        }
        expect("}", "'}' para cerrar el mapa");
        return { type: "map", pairs, line: L };
      }
      case "fn": {
        pos++;
        const name = is("id") ? expect("id").value : "anonymous";
        return fnRest(name, L);
      }
      case "async": {
        pos++;
        let f;
        if (accept("fn")) f = fnRest(is("id") ? expect("id").value : "anonymous", L);
        else if (accept("||")) f = closure([], L);
        else if (accept("|")) f = closure(params("|"), L);
        else throw fail("Después de async va fn o un closure: async fn cargar() { } o async || { }");
        f.isAsync = true;
        return f;
      }
    }
    throw fail(`No se esperaba ${describe(t)}`, t);
  }

  if (o.mode === "expr") {
    const e = expression();
    if (!is("eof")) throw fail("Texto inesperado dentro de {} en un string");
    return e;
  }
  const program = [];
  while (!is("eof")) program.push(statement());
  return program;
}

/** Atajo: texto fuente a árbol. */
export function parse(src, file) {
  return parser(lexer(src, { file }), { file });
}

/** Rutas de los módulos que importa un programa (sin ejecutarlo). */
export function importsOf(ast) {
  return ast.filter((s) => s.type === "import").map((s) => s.path);
}

/** Árbol de sintaxis como expresiones S (lo muestra la web). */
export function sx(n) {
  if (n === null || n === undefined) return "nil";
  if (Array.isArray(n)) return n.map(sx).join(" ");
  if (typeof n === "string") return JSON.stringify(n);
  const tgt = (t) => (Array.isArray(t) ? `(${t.join(" ")})` : t);
  switch (n.type) {
    case "lit": return typeof n.value === "string" ? JSON.stringify(n.value) : n.value === null ? "nil" : String(n.value);
    case "var": return n.name;
    case "self": return "self";
    case "template": return `(str ${n.parts.map(sx).join(" ")})`;
    case "list": return `[${n.items.map(sx).join(" ")}]`;
    case "map": return `{${n.pairs.map(([k, v]) => ` ${k}: ${sx(v)}`).join("")} }`;
    case "bin": return `(${n.op} ${sx(n.left)} ${sx(n.right)})`;
    case "unary": return `(${n.op} ${sx(n.value)})`;
    case "range": return `(${n.inclusive ? "..=" : ".."} ${sx(n.from)} ${sx(n.to)})`;
    case "member": return `(${n.optional ? "?." : "."} ${sx(n.obj)} ${n.name})`;
    case "index": return `([] ${sx(n.obj)} ${sx(n.index)})`;
    case "call": return `(${sx(n.fn)}${n.args.map((a) => " " + sx(a)).join("")})`;
    case "function": return `(fn (${n.params.join(" ")}) ${sx(n.body)})`;
    case "decl": return `(${n.constant ? "let" : "var"} ${tgt(n.target)} ${sx(n.value)})`;
    case "assign": return `(${n.op} ${sx(n.target)} ${sx(n.value)})`;
    case "exp": return sx(n.exp);
    case "return": return `(return ${sx(n.value)})`;
    case "if": return `(if ${sx(n.cond)} ${sx(n.then)}${n.otherwise ? " " + sx(n.otherwise) : ""})`;
    case "match": return `(match ${sx(n.value)} …)`;
    case "while": return `(while ${sx(n.cond)} ${sx(n.body)})`;
    case "for": return `(for ${tgt(n.target)} ${sx(n.iter)} ${sx(n.body)})`;
    case "import": return `(import ${n.alias || "{" + n.names.map((x) => x[1]).join(" ") + "}"} ${JSON.stringify(n.path)})`;
    case "export": return `(export ${sx(n.decl)})`;
    case "cls": return "." + n.name;
    case "bindref": return "$" + n.name;
    case "elem": {
      const tag = n.tag.type === "lit" ? n.tag.value : sx(n.tag);
      const args = n.args.map((a) => " " + sx(a)).join("");
      const content = n.content ? " " + sx(n.content) : "";
      const action = n.action ? ` (click ${sx(n.action.body)})` : "";
      return `(<${tag}>${args}${content}${action})`;
    }
  }
  return `(${n.type})`;
}
