// ─────────────── 3. Evaluador: recorre el árbol y lo ejecuta ───────────────
// Cada instancia tiene su propio estado (salida, contador de pasos, módulos),
// así que varios programas pueden convivir sin mezclarse.
import { TngError, Thrown, Return, StepLimit, BREAK, CONTINUE, ubicacion } from "./errores.js";
import { parse } from "./parser.js";
import { quisiste } from "./sugerencias.js";
import { Env, Fn, Class, Instance, isMap, makeMap, truthy, norm, equal, typeOf, show, fromJS, toJS } from "./valores.js";

/** Une una ruta relativa con el archivo que la importa (estilo POSIX). */
export function resolvePath(spec, from) {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(spec)) return spec;
  if (from && /^[a-z][a-z0-9+.-]*:\/\//i.test(from) && (spec.startsWith("./") || spec.startsWith("../")))
    return new URL(spec, from).href;
  let path = spec;
  if (spec.startsWith("./") || spec.startsWith("../")) {
    const base = from ? from.split("/").slice(0, -1) : [];
    path = [...base, ...spec.split("/")].join("/");
  }
  const out = [];
  for (const part of path.split("/")) {
    if (part === "." || part === "") continue;
    if (part === "..") { if (out.length && out[out.length - 1] !== "..") out.pop(); else out.push(".."); continue; }
    out.push(part);
  }
  let r = (path.startsWith("/") ? "/" : "") + out.join("/");
  if (!/\.[A-Za-z0-9]+$/.test(r)) r += ".tng";
  return r;
}

/**
 * @param {object} host
 * @param {(line: string) => void} host.output
 * @param {number} host.stepLimit 0 = sin límite
 * @param {(spec: string, from: string|null) => string} host.resolve
 * @param {(key: string) => string|null} host.read
 * @param {(msg: string) => void} host.onError
 */
export function createInterpreter(host) {
  let OUT = host.output;
  let BUFFER = "";
  let STEPS = 0;
  let CURFILE = null; // archivo que se está ejecutando (para el rastro de llamadas)
  const modules = new Map(); // clave -> { state: "loading"|"ready", exports }
  const global = new Env();

  let LIMIT = 0; // se copia de host.stepLimit al empezar cada ejecución
  function tick() {
    if (++STEPS > LIMIT && LIMIT > 0)
      throw new StepLimit(`El programa dio demasiados pasos (más de ${LIMIT}). Revisa si hay un ciclo que nunca termina.`);
  }
  function reset() {
    STEPS = 0;
    LIMIT = host.stepLimit || 0;
  }

  function operate(op, a, b, L) {
    a = norm(a);
    b = norm(b);
    switch (op) {
      case "+":
        if (typeof a === "number" && typeof b === "number") return a + b;
        if (typeof a === "string" || typeof b === "string") return show(a) + show(b);
        if (Array.isArray(a) && Array.isArray(b)) return a.concat(b);
        throw new TngError(`No se puede sumar ${typeOf(a)} con ${typeOf(b)}`, L);
      case "==": return equal(a, b);
      case "!=": return !equal(a, b);
      case "<": case ">": case "<=": case ">=":
        if (!((typeof a === "number" && typeof b === "number") || (typeof a === "string" && typeof b === "string")))
          throw new TngError(`No se puede comparar ${typeOf(a)} con ${typeOf(b)}`, L);
        return op === "<" ? a < b : op === ">" ? a > b : op === "<=" ? a <= b : a >= b;
    }
    if (op === "*" && typeof a === "string" && typeof b === "number") return a.repeat(Math.max(0, Math.floor(b)));
    if (typeof a !== "number" || typeof b !== "number")
      throw new TngError(`El operador ${op} necesita números, pero recibió ${typeOf(a)} y ${typeOf(b)}`, L);
    switch (op) {
      case "-": return a - b;
      case "*": return a * b;
      case "/": if (b === 0) throw new TngError("División entre cero", L); return a / b;
      case "%": if (b === 0) throw new TngError("Resto de una división entre cero", L); return a % b;
      case "**": return a ** b;
    }
    throw new TngError(`Operador desconocido ${op}`, L);
  }

  function makeRange(from, to, inclusive, L) {
    if (typeof from !== "number" || typeof to !== "number")
      throw new TngError(`Un rango necesita números, pero recibió ${typeOf(from)} y ${typeOf(to)}`, L);
    const end = inclusive ? to : to - 1;
    if (end - from > 1e6) throw new TngError("Un rango no puede tener más de un millón de números", L);
    const r = [];
    for (let i = from; i <= end; i++) r.push(i);
    return r;
  }

  // ── Métodos de los tipos incorporados ──
  const builtin = (name, f) => { f.tngName = name; return f; };
  const cb = (f, a) => call(f, a);
  const num = (x, who) => {
    if (typeof x !== "number") throw new TngError(`${who} espera un número, pero recibió ${typeOf(x)}`);
    return x;
  };
  const fnArg = (f, who) => {
    if (!(f instanceof Fn || typeof f === "function" || f instanceof Class))
      throw new TngError(`${who} espera una función, pero recibió ${typeOf(f)}`);
    return f;
  };
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const COMMON = {
    to_string: (x) => show(x),
  };
  const LIST = {
    len: (l) => l.length,
    is_empty: (l) => l.length === 0,
    push: (l, ...x) => { l.push(...x); return l; },
    pop: (l) => (l.length ? l.pop() : null),
    insert: (l, i, x) => { l.splice(num(i, "insert"), 0, x); return l; },
    remove: (l, i) => { num(i, "remove"); return i >= 0 && i < l.length ? l.splice(i, 1)[0] : null; },
    map: (l, f) => { fnArg(f, "map"); return l.map((x, i) => cb(f, [x, i])); },
    filter: (l, f) => { fnArg(f, "filter"); return l.filter((x, i) => truthy(cb(f, [x, i]))); },
    fold: (l, init, f) => { fnArg(f, "fold"); return l.reduce((acc, x, i) => cb(f, [acc, x, i]), init); },
    reduce: (l, f) => {
      fnArg(f, "reduce");
      if (!l.length) return null;
      let acc = l[0];
      for (let i = 1; i < l.length; i++) acc = cb(f, [acc, l[i], i]);
      return acc;
    },
    find: (l, f) => { for (let i = 0; i < l.length; i++) if (truthy(cb(f, [l[i], i]))) return l[i]; return null; },
    position: (l, f) => { for (let i = 0; i < l.length; i++) if (truthy(cb(f, [l[i], i]))) return i; return null; },
    any: (l, f) => l.some((x, i) => truthy(cb(f, [x, i]))),
    all: (l, f) => l.every((x, i) => truthy(cb(f, [x, i]))),
    count: (l, f) => (f ? l.filter((x, i) => truthy(cb(f, [x, i]))).length : l.length),
    for_each: (l, f) => { l.forEach((x, i) => cb(f, [x, i])); return null; },
    contains: (l, x) => l.some((y) => equal(x, y)),
    index_of: (l, x) => { const i = l.findIndex((y) => equal(x, y)); return i < 0 ? null : i; },
    join: (l, s) => l.map((x) => show(x)).join(s == null ? "" : s),
    slice: (l, a, b) => l.slice(a == null ? 0 : a, b == null ? undefined : b),
    take: (l, n) => l.slice(0, Math.max(0, n)),
    skip: (l, n) => l.slice(Math.max(0, n)),
    reversed: (l) => [...l].reverse(),
    sorted: (l) => [...l].sort(cmp),
    sorted_by: (l, f) => [...l].sort((a, b) => { const r = cb(f, [a, b]); return typeof r === "number" ? r : 0; }),
    sorted_by_key: (l, f) => {
      // Calcula cada clave una sola vez (antes se recalculaba en cada comparación)
      const keyed = l.map((x) => [cb(f, [x]), x]);
      keyed.sort((a, b) => cmp(a[0], b[0]));
      return keyed.map((p) => p[1]);
    },
    enumerate: (l) => l.map((x, i) => [i, x]),
    zip: (l, o) => l.slice(0, Math.min(l.length, o.length)).map((x, i) => [x, o[i]]),
    chunks: (l, n) => {
      num(n, "chunks");
      if (n < 1) throw new TngError("chunks necesita un tamaño de al menos 1");
      const r = [];
      for (let i = 0; i < l.length; i += n) r.push(l.slice(i, i + n));
      return r;
    },
    unique: (l) => {
      // Rápido para valores simples; compara a fondo solo listas y mapas
      const seen = new Set(), out = [];
      for (const x of l) {
        if (x !== null && typeof x === "object") { if (!out.some((y) => equal(x, y))) out.push(x); }
        else if (!seen.has(x)) { seen.add(x); out.push(x); }
      }
      return out;
    },
    flatten: (l) => l.flat(),
    sum: (l) => l.reduce((a, b) => operate("+", a, b), 0),
    min: (l) => (l.length ? Math.min(...l) : null),
    max: (l) => (l.length ? Math.max(...l) : null),
    first: (l) => (l.length ? l[0] : null),
    last: (l) => (l.length ? l[l.length - 1] : null),
  };
  const STRING = {
    len: (s) => Array.from(s).length,
    is_empty: (s) => s.length === 0,
    upper: (s) => s.toUpperCase(),
    lower: (s) => s.toLowerCase(),
    capitalize: (s) => s.charAt(0).toUpperCase() + s.slice(1),
    trim: (s) => s.trim(),
    split: (s, sep) => s.split(sep == null ? "" : sep),
    lines: (s) => s.split(/\r?\n/),
    words: (s) => s.trim().split(/\s+/).filter(Boolean),
    replace: (s, a, b) => s.split(String(a)).join(show(b)),
    contains: (s, x) => s.includes(x),
    starts_with: (s, x) => s.startsWith(x),
    ends_with: (s, x) => s.endsWith(x),
    slice: (s, a, b) => Array.from(s).slice(a == null ? 0 : a, b == null ? undefined : b).join(""),
    index_of: (s, x) => { const i = s.indexOf(x); return i < 0 ? null : i; },
    repeat: (s, n) => s.repeat(Math.max(0, n)),
    pad_start: (s, n, c) => s.padStart(n, c == null ? " " : c),
    pad_end: (s, n, c) => s.padEnd(n, c == null ? " " : c),
    chars: (s) => Array.from(s),
    reversed: (s) => Array.from(s).reverse().join(""),
    parse: (s) => { const t = s.trim().replace(/_/g, ""); const v = Number(t); return t === "" || isNaN(v) ? null : v; },
  };
  const NUMBER = {
    abs: (n) => Math.abs(n),
    round: (n, d) => { const f = 10 ** (d || 0); return Math.round(n * f) / f; },
    floor: (n) => Math.floor(n),
    ceil: (n) => Math.ceil(n),
    sqrt: (n) => Math.sqrt(n),
    pow: (n, e) => n ** num(e, "pow"),
    clamp: (n, a, b) => Math.min(Math.max(n, a), b),
    is_even: (n) => n % 2 === 0,
    is_odd: (n) => Math.abs(n % 2) === 1,
    to_int: (n) => Math.trunc(n),
    times: (n, f) => { fnArg(f, "times"); const r = []; for (let i = 0; i < n; i++) r.push(cb(f, [i])); return r; },
  };
  const MAP = {
    keys: (o) => Object.keys(o),
    values: (o) => Object.values(o),
    entries: (o) => Object.keys(o).map((k) => [k, o[k]]),
    has: (o, k) => show(k) in o,
    get: (o, k, d) => (show(k) in o ? o[show(k)] : d === undefined ? null : d),
    remove: (o, k) => { const c = show(k); const v = c in o ? o[c] : null; delete o[c]; return v; },
    len: (o) => Object.keys(o).length,
    is_empty: (o) => Object.keys(o).length === 0,
  };

  const builtinCall = (m, obj, args) => m(obj, ...args);

  function method(table, obj, name) {
    const m = table[name] || COMMON[name];
    return m ? builtin(name, (...a) => m(obj, ...a)) : null;
  }

  function getMember(obj, name, L, optional) {
    obj = norm(obj);
    if (obj === null) {
      if (optional) return null;
      throw new TngError(`No se puede leer '${name}' de nil. Usa ?. si el valor puede ser nil`, L);
    }
    let m = null;
    if (obj instanceof Instance) {
      if (name in obj.fields) return obj.fields[name];
      const f = obj.cls.findMethod(name);
      if (f) return f.bind(obj);
      if (name === "to_string") return method(COMMON, obj, name);
      const cands = new Set(Object.keys(obj.fields));
      for (let c = obj.cls; c; c = c.parent) for (const k of c.methods.keys()) cands.add(k);
      throw new TngError(`${obj.cls.name} no tiene un campo ni un método llamado '${name}'.${quisiste(name, cands)}`.replace(/\.$/, ""), L);
    }
    if (isMap(obj)) {
      if (name in obj) return obj[name];
      m = method(MAP, obj, name);
      return m || null;
    }
    if (Array.isArray(obj)) m = method(LIST, obj, name);
    else if (typeof obj === "string") m = method(STRING, obj, name);
    else if (typeof obj === "number") m = method(NUMBER, obj, name);
    else if (obj instanceof Class && name === "name") return obj.name;
    else m = method({}, obj, name);
    if (m) return m;
    const tabla = Array.isArray(obj) ? LIST : typeof obj === "string" ? STRING : typeof obj === "number" ? NUMBER : {};
    const cands = [...Object.keys(tabla), ...Object.keys(COMMON)];
    throw new TngError(`${typeOf(obj)} no tiene un método llamado '${name}'.${quisiste(name, cands)}`.replace(/\.$/, ""), L);
  }
  function setMember(obj, name, v, L) {
    if (obj instanceof Instance) { obj.fields[name] = v; return; }
    if (isMap(obj)) { obj[name] = v; return; }
    throw new TngError(`No se puede asignar '${name}' en ${typeOf(obj)}`, L);
  }
  function getIndex(obj, k, L) {
    obj = norm(obj);
    if (Array.isArray(obj) || typeof obj === "string") {
      const list = typeof obj === "string" ? Array.from(obj) : obj;
      if (typeof k !== "number" || !Number.isInteger(k)) throw new TngError(`El índice debe ser un Int, pero es ${typeOf(k)}`, L);
      const i = k < 0 ? list.length + k : k;
      return i >= 0 && i < list.length ? list[i] : null;
    }
    if (isMap(obj)) { const c = show(k); return c in obj ? obj[c] : null; }
    if (obj instanceof Instance) return getMember(obj, show(k), L);
    throw new TngError(`No se puede indexar ${typeOf(obj)}`, L);
  }
  function setIndex(obj, k, v, L) {
    if (Array.isArray(obj)) {
      if (typeof k !== "number" || !Number.isInteger(k)) throw new TngError("El índice debe ser un Int", L);
      const i = k < 0 ? obj.length + k : k;
      if (i < 0 || i > obj.length) throw new TngError(`El índice ${k} está fuera de una lista de largo ${obj.length}`, L);
      obj[i] = v;
      return;
    }
    if (isMap(obj)) { obj[show(k)] = v; return; }
    if (obj instanceof Instance) { obj.fields[show(k)] = v; return; }
    throw new TngError(`No se puede indexar ${typeOf(obj)}`, L);
  }

  // Ejecuta un bloque y devuelve el valor de su última instrucción
  function runBlock(stmts, env) {
    let last = null;
    for (const s of stmts) last = exec(s, env);
    return last;
  }

  function loopBody(body, env) {
    tick();
    try { runBlock(body, env); }
    catch (x) { if (x === BREAK) return false; if (x === CONTINUE) return true; throw x; }
    return true;
  }

  function bindTarget(env, target, value, constant, L) {
    if (Array.isArray(target)) {
      if (!Array.isArray(value)) throw new TngError(`No se puede desarmar ${typeOf(value)} en (${target.join(", ")})`, L);
      target.forEach((n, i) => env.define(n, value[i] === undefined ? null : value[i], constant));
    } else env.define(target, value, constant);
  }

  const catchable = (x) => x instanceof Thrown || x instanceof TngError || x instanceof RangeError;
  function errorValue(x) {
    if (x instanceof Thrown) {
      const v = norm(x.value);
      if (typeof v === "string") return makeMap({ message: v, line: x.line });
      return v;
    }
    if (x instanceof RangeError) return makeMap({ message: "Desbordamiento de pila: una función se llamó a sí misma demasiadas veces", line: null });
    return makeMap({ message: x.message, line: x.line });
  }

  function exec(s, env) {
    switch (s.type) {
      case "exp": return evaluate(s.exp, env);
      case "decl": bindTarget(env, s.target, s.value ? evaluate(s.value, env) : null, s.constant, s.line); return null;
      case "class": {
        let parent = null;
        if (s.parent) {
          parent = evaluate(s.parent, env);
          if (!(parent instanceof Class)) throw new TngError(`${s.parent.name} no es una clase`, s.line);
        }
        let menv = env;
        if (parent) { menv = new Env(env); menv.define("super", parent, true); }
        const ms = new Map();
        for (const m of s.methods) ms.set(m.name, new Fn(m, menv, m.name === "init"));
        env.define(s.name, new Class(s.name, parent, ms, s.fields, menv), true);
        return null;
      }
      case "assign": assign(s, env); return null;
      case "while":
        while (truthy(evaluate(s.cond, env))) { if (!loopBody(s.body, new Env(env))) break; }
        return null;
      case "loop":
        for (;;) { if (!loopBody(s.body, new Env(env))) break; }
        return null;
      case "for": {
        let it = norm(evaluate(s.iter, env));
        if (typeof it === "string") it = Array.from(it);
        else if (isMap(it)) { const m = it; it = Object.keys(m).map((k) => [k, m[k]]); }
        else if (it instanceof Instance) { const f = it.fields; it = Object.keys(f).map((k) => [k, f[k]]); }
        else if (!Array.isArray(it)) throw new TngError(`No se puede recorrer ${typeOf(it)} con for`, s.line);
        for (const x of it) {
          const local = new Env(env);
          bindTarget(local, s.target, x, false, s.line);
          if (!loopBody(s.body, local)) break;
        }
        return null;
      }
      case "break": throw BREAK;
      case "continue": throw CONTINUE;
      case "return": throw new Return(s.value ? evaluate(s.value, env) : null);
      case "throw": throw new Thrown(evaluate(s.value, env), s.line);
      case "try":
        try { return runBlock(s.body, new Env(env)); }
        catch (x) {
          if (!catchable(x)) throw x;
          const local = new Env(env);
          local.define(s.name, errorValue(x));
          return runBlock(s.handler, local);
        }
      case "import": doImport(s, env); return null;
      case "export": {
        if (!env.exports) throw new TngError("export solo puede usarse en el nivel superior de un módulo", s.line);
        exec(s.decl, env);
        for (const n of s.names) env.exports.add(n);
        return null;
      }
    }
    throw new TngError(`Instrucción desconocida ${s.type}`, s.line);
  }

  function assign(s, env) {
    const t = s.target, L = s.line;
    const value = evaluate(s.value, env);
    const combine = (cur) => (s.op === "=" ? value : operate(s.op[0], cur, value, L));
    if (t.type === "var") {
      env.set(t.name, s.op === "=" ? value : combine(env.get(t.name, L)), L);
    } else if (t.type === "member") {
      const obj = evaluate(t.obj, env);
      setMember(obj, t.name, s.op === "=" ? value : combine(getMember(obj, t.name, L)), L);
    } else {
      const obj = evaluate(t.obj, env), k = evaluate(t.index, env);
      setIndex(obj, k, s.op === "=" ? value : combine(getIndex(obj, k, L)), L);
    }
  }

  function matches(p, v, env) {
    switch (p.kind) {
      case "any": return true;
      case "bind": env.define(p.name, v); return true;
      case "lit": return equal(p.value, v);
      case "range": return typeof v === "number" && v >= p.from && (p.inclusive ? v <= p.to : v < p.to);
    }
    return false;
  }

  function evaluate(e, env) {
    switch (e.type) {
      case "lit": return e.value;
      case "template": {
        let s = "";
        for (const p of e.parts) s += typeof p === "string" ? p : show(evaluate(p, env));
        return s;
      }
      case "var": return env.get(e.name, e.line);
      case "self": return env.get("self", e.line);
      case "super": {
        const parent = env.get("super", e.line), inst = env.get("self", e.line);
        const m = parent.findMethod(e.name);
        if (!m) throw new TngError(`La clase ${parent.name} no tiene un método llamado '${e.name}'`, e.line);
        return m.bind(inst);
      }
      case "list": return e.items.map((x) => evaluate(x, env));
      case "map": { const o = Object.create(null); for (const [k, v] of e.pairs) o[k] = evaluate(v, env); return o; }
      case "function": return new Fn(e, env);
      case "range": return makeRange(evaluate(e.from, env), evaluate(e.to, env), e.inclusive, e.line);
      case "unary": {
        const v = evaluate(e.value, env);
        if (e.op === "!") return !truthy(v);
        if (typeof v !== "number") throw new TngError(`No se puede negar ${typeOf(v)}`, e.line);
        return -v;
      }
      case "bin": {
        if (e.op === "&&") { const a = evaluate(e.left, env); return truthy(a) ? evaluate(e.right, env) : a; }
        if (e.op === "||") { const a = evaluate(e.left, env); return truthy(a) ? a : evaluate(e.right, env); }
        if (e.op === "??") { const a = norm(evaluate(e.left, env)); return a !== null ? a : evaluate(e.right, env); }
        return operate(e.op, evaluate(e.left, env), evaluate(e.right, env), e.line);
      }
      case "if":
        if (truthy(evaluate(e.cond, env))) return runBlock(e.then, new Env(env));
        return e.otherwise ? runBlock(e.otherwise, new Env(env)) : null;
      case "match": {
        const v = evaluate(e.value, env);
        for (const arm of e.arms) {
          for (const p of arm.pats) {
            const local = new Env(env);
            if (!matches(p, v, local)) continue;
            if (arm.guard && !truthy(evaluate(arm.guard, local))) continue;
            return arm.isBlock ? runBlock(arm.body, local) : evaluate(arm.body, local);
          }
        }
        throw new TngError(`Ningún caso del match acepta ${show(v, true)}. Agrega un caso _ =>`, e.line);
      }
      case "member": return getMember(evaluate(e.obj, env), e.name, e.line, e.optional);
      case "index": return getIndex(evaluate(e.obj, env), evaluate(e.index, env), e.line);
      case "call": {
        if (e.fn.type === "member") {
          const obj = evaluate(e.fn.obj, env);
          if (e.fn.optional && norm(obj) === null) return null;
          // Atajo: métodos incorporados sin crear una función intermedia
          const table = Array.isArray(obj) ? LIST : typeof obj === "string" ? STRING : typeof obj === "number" ? NUMBER
            : isMap(obj) && !(e.fn.name in obj) ? MAP : null;
          const m = table && (table[e.fn.name] || COMMON[e.fn.name]);
          if (m) {
            const args = e.args.map((a) => evaluate(a, env));
            return call(builtinCall, [m, obj, args], e.line);
          }
          const f = getMember(obj, e.fn.name, e.line, e.fn.optional);
          return call(f, e.args.map((a) => evaluate(a, env)), e.line);
        }
        return call(evaluate(e.fn, env), e.args.map((a) => evaluate(a, env)), e.line);
      }
    }
    throw new TngError(`No se puede evaluar ${e.type}`, e.line);
  }

  function instantiate(cls, args, L) {
    const inst = new Instance(cls);
    const chain = [];
    for (let c = cls; c; c = c.parent) chain.unshift(c);
    for (const c of chain) {
      if (!c.fields.length) continue;
      const fenv = new Env(c.env);
      fenv.define("self", inst, true);
      for (const f of c.fields) inst.fields[f.name] = evaluate(f.value, fenv);
    }
    const init = cls.findMethod("init");
    if (init) call(init.bind(inst), args, L);
    else if (args.length) throw new TngError(`${cls.name} no tiene un init que reciba argumentos`, L);
    return inst;
  }

  function call(f, args, L) {
    if (typeof f === "function") {
      let r;
      try { r = f(...args); }
      catch (x) {
        if (x instanceof TngError) { if (!x.line) x.line = L; throw x; }
        if (x instanceof Error && !(x instanceof RangeError)) throw new TngError(x.message, L);
        throw x;
      }
      return r === undefined ? null : r;
    }
    if (f instanceof Fn) {
      tick();
      const d = f.decl, local = new Env(f.env);
      const ps = d.params, defs = d.defaults;
      const callerFile = CURFILE;
      if (d.file) CURFILE = d.file;
      let result;
      try {
        for (let i = 0; i < ps.length; i++) {
          let v = args[i];
          if (v === undefined && defs && defs[i]) v = evaluate(defs[i], local);
          local.define(ps[i], v === undefined ? null : v);
        }
        result = d.isExpr ? evaluate(d.body, local) : runBlock(d.body, local);
      } catch (x) {
        if (x instanceof Return) result = x.value;
        else {
          if (x instanceof TngError || x instanceof Thrown) {
            // Atribuye el error al archivo donde se escribió la función y anota la llamada en el rastro
            if (!x.file && d.file) x.file = d.file;
            if (!x.trace) x.trace = [];
            if (x.trace.length < 50) x.trace.push({ name: d.closure ? "closure" : d.name, line: L || null, file: callerFile });
          }
          if (x === BREAK || x === CONTINUE) throw new TngError(`${x.control} solo se puede usar dentro de un ciclo`, L, null, d.file);
          throw x;
        }
      } finally {
        CURFILE = callerFile;
      }
      return f.isInit ? local.get("self") : result;
    }
    if (f instanceof Class) return instantiate(f, args, L);
    throw new TngError(`${show(f, true)} no es una función`, L);
  }

  // ── Módulos ──
  function loadModule(key, L, fromFile) {
    const cached = modules.get(key);
    if (cached) {
      if (cached.state === "loading") throw new TngError(`Importación circular: '${key}' se importa a sí mismo a través de otros módulos`, L, null, fromFile);
      return cached.exports;
    }
    const src = host.read(key);
    if (src === null || src === undefined) throw new TngError(`No se encontró el módulo '${key}'`, L, null, fromFile);
    const entry = { state: "loading", exports: null };
    modules.set(key, entry);
    try {
      const env = execModule(String(src), key);
      const exp = Object.create(null);
      for (const n of env.exports) exp[n] = env.vars.get(n);
      entry.exports = exp;
      entry.state = "ready";
      return exp;
    } catch (x) {
      modules.delete(key);
      throw x;
    }
  }

  function doImport(s, env) {
    const from = env.file || null;
    let key;
    try { key = host.resolve(s.path, from); }
    catch (x) {
      if (x instanceof TngError) { if (!x.line) x.line = s.line; if (!x.file) x.file = from; }
      throw x;
    }
    const exp = loadModule(key, s.line, from);
    if (s.alias) { env.define(s.alias, exp, true); return; }
    for (const [name, local] of s.names) {
      if (!(name in exp)) throw new TngError(`El módulo '${s.path}' no exporta '${name}'`, s.line);
      env.define(local, exp[name], true);
    }
  }

  function execModule(src, file, env) {
    const ast = parse(src, file);
    env = env || new Env(global);
    env.file = file;
    env.exports = new Set();
    const prevFile = CURFILE;
    CURFILE = file;
    try {
      let last = null;
      for (const s of ast) last = exec(s, env);
      env.last = last;
    } catch (x) {
      if (x instanceof Return) { env.last = x.value; return env; }
      if ((x instanceof TngError || x instanceof Thrown) && !x.file) x.file = file;
      throw x;
    } finally {
      CURFILE = prevFile;
    }
    return env;
  }

  function message(err) {
    if (err instanceof TngError) return ubicacion(err.line, err.col, err.file) + err.message;
    if (err instanceof Thrown) {
      const v = norm(err.value);
      let m;
      if (isMap(v) && typeof v.message === "string") m = v.message;
      else if (v instanceof Instance && typeof v.fields.message === "string") m = v.fields.message;
      else m = show(v);
      return ubicacion(err.line, null, err.file) + "Error no atrapado: " + m;
    }
    if (err instanceof StepLimit) return err.message;
    if (err instanceof RangeError) return "Desbordamiento de pila: una función se llamó a sí misma demasiadas veces.";
    if (err === BREAK || err === CONTINUE) return `${err.control} solo se puede usar dentro de un ciclo.`;
    return "Error interno: " + (err && err.message);
  }

  /** Líneas del rastro de llamadas: "en total(), llamada en main.tng, línea 5". */
  function trace(err) {
    if (!err || !err.trace || !err.trace.length) return [];
    const frames = err.trace.slice(0, 12).map((f) => {
      const donde = f.line ? `${f.file ? f.file + ", " : ""}línea ${f.line}` : f.file || "";
      return `en ${f.name}()${donde ? ", llamada en " + donde : ""}`;
    });
    if (err.trace.length > 12) frames.push(`… y ${err.trace.length - 12} llamadas más`);
    return frames;
  }

  // ── Funciones globales ──
  const BUILTINS = {
    println: (...a) => { OUT(BUFFER + a.map((x) => show(x)).join(" ")); BUFFER = ""; },
    print: (...a) => { BUFFER += a.map((x) => show(x)).join(" "); },
    type_of: (x) => typeOf(x),
    assert: (cond, msg) => {
      if (!truthy(cond)) throw new Thrown(makeMap({ message: msg == null ? "La afirmación falló" : show(msg) }));
    },
    min: (...xs) => { const l = xs.length === 1 && Array.isArray(xs[0]) ? xs[0] : xs; return l.length ? Math.min(...l) : null; },
    max: (...xs) => { const l = xs.length === 1 && Array.isArray(xs[0]) ? xs[0] : xs; return l.length ? Math.max(...l) : null; },
    random: () => Math.random(),
    random_int: (a, b) => Math.floor(Math.random() * (num(b, "random_int") - num(a, "random_int") + 1)) + a,
    to_json: (v, indent) => JSON.stringify(toJS(v), null, indent || undefined) ?? "null",
    from_json: (s) => {
      try { return fromJS(JSON.parse(String(s))); }
      catch (e) { throw new TngError("from_json recibió un texto que no es JSON válido: " + e.message); }
    },
    PI: Math.PI,
  };
  for (const k in BUILTINS) if (typeof BUILTINS[k] === "function") BUILTINS[k].tngName = k;
  for (const k in BUILTINS) global.define(k, BUILTINS[k], true);

  function flush() {
    if (BUFFER) { const b = BUFFER; BUFFER = ""; OUT(b); }
  }

  return {
    global,
    define(name, value) {
      if (typeof value === "function" && !value.tngName) value.tngName = name;
      global.define(name, value, true);
    },
    /** Ejecuta un programa completo en un ámbito nuevo. Lanza el error si falla. */
    run(src, file, env) {
      reset();
      try { return execModule(String(src), file || null, env).last; }
      finally { flush(); }
    },
    /** Llama a una función de Tangerine desde JavaScript (eventos, callbacks). */
    invoke(f, args) {
      reset();
      try { return call(f, args || []); }
      catch (x) {
        if (x instanceof Return) return x.value;
        host.onError(message(x));
        return null;
      } finally { flush(); }
    },
    call: (f, args) => call(f, args || []),
    message,
    trace,
    loadModule: (key) => { reset(); try { return loadModule(key, null, null); } finally { flush(); } },
    forget: (key) => modules.delete(key),
    newEnv: () => new Env(global),
    setOutput(f) { OUT = f; },
    get output() { return OUT; },
    flush,
  };
}
