// Valores de Tangerine y utilidades para manejarlos.
import { TngError } from "./errores.js";
import { quisiste } from "./sugerencias.js";

/** Ámbito de variables. */
export class Env {
  constructor(parent) {
    this.vars = new Map();
    this.consts = null;
    this.parent = parent || null;
  }
  define(n, v, constant) {
    this.vars.set(n, v);
    if (constant) (this.consts || (this.consts = new Set())).add(n);
    else if (this.consts) this.consts.delete(n);
  }
  // Dentro de un método, los campos de self se pueden usar sin self. (como en Swift).
  has(n) {
    for (let e = this; e; e = e.parent) if (e.vars.has(n) || (e.inst && (n in e.inst.fields || e.inst.cls.findMethod(n)))) return true;
    return false;
  }
  get(n, L) {
    for (let e = this; e; e = e.parent) {
      if (e.vars.has(n)) return e.vars.get(n);
      if (e.inst) {
        if (n in e.inst.fields) return e.inst.fields[n];
        const m = e.inst.cls.findMethod(n);
        if (m) return m.bind(e.inst);
      }
    }
    if (n === "self") throw new TngError("self solo existe dentro de un método", L);
    if (n === "super") throw new TngError("super solo existe dentro de una clase con padre", L);
    throw new TngError(`No existe '${n}' en este ámbito.${quisiste(n, this.names())}`.replace(/\.$/, ""), L);
  }
  /** Todos los nombres visibles desde este ámbito. */
  names() {
    const out = new Set();
    for (let e = this; e; e = e.parent) {
      for (const k of e.vars.keys()) out.add(k);
      if (e.inst) {
        for (const k of Object.keys(e.inst.fields)) out.add(k);
        for (let c = e.inst.cls; c; c = c.parent) for (const k of c.methods.keys()) out.add(k);
      }
    }
    return out;
  }
  set(n, v, L) {
    for (let e = this; e; e = e.parent) {
      if (e.vars.has(n)) {
        if (e.consts && e.consts.has(n))
          throw new TngError(`No se puede asignar dos veces a '${n}'. Declárala con var para que pueda cambiar`, L);
        e.vars.set(n, v);
        return;
      }
      if (e.inst && n in e.inst.fields) { e.inst.fields[n] = v; return; }
    }
    const s = quisiste(n, this.names());
    throw new TngError(s ? `No existe '${n}' en este ámbito.${s}` : `No existe '${n}' en este ámbito. Declárala primero con var`, L);
  }
}

/** Función o closure escrito en Tangerine. */
export class Fn {
  constructor(decl, env, isInit) {
    this.decl = decl;
    this.env = env;
    this.isInit = !!isInit;
  }
  get name() {
    return this.decl.name;
  }
  bind(inst) {
    const e = new Env(this.env);
    e.define("self", inst, true);
    e.inst = inst;
    return new Fn(this.decl, e, this.isInit);
  }
}

export class Class {
  constructor(name, parent, methods, fields, env) {
    this.name = name;
    this.parent = parent;
    this.methods = methods;
    this.fields = fields;
    this.env = env;
  }
  findMethod(n) {
    return this.methods.has(n) ? this.methods.get(n) : this.parent ? this.parent.findMethod(n) : null;
  }
}

export class Instance {
  constructor(cls) {
    this.cls = cls;
    this.fields = Object.create(null);
  }
}

/** Un elemento de un view { }: etiqueta, clases, atributos, eventos e hijos. Aún no es DOM. */
export class VNode {
  constructor(tag) {
    this.tag = tag; // null = un grupo de hijos sin etiqueta
    this.classes = [];
    this.attrs = Object.create(null);
    this.on = Object.create(null);
    this.bind = null;
    this.children = [];
  }
}

/** Marca de las uniones de dos sentidos ($nombre). */
export const BINDING = Symbol("tangerine.binding");
export const makeBinding = (get, set) => ({ [BINDING]: true, get, set });
export const isBinding = (v) => v !== null && typeof v === "object" && !!v[BINDING];

/** Marca interna de los estados reactivos (state y computed). */
export const STATE = Symbol("tangerine.state");
export const isState = (v) => v !== null && typeof v === "object" && !!v[STATE];

export const isMap = (v) => v !== null && typeof v === "object" && Object.getPrototypeOf(v) === null;
export const makeMap = (pairs) => {
  const o = Object.create(null);
  for (const k in pairs) o[k] = pairs[k];
  return o;
};
export const truthy = (v) => v !== null && v !== undefined && v !== false;
export const norm = (v) => (v === undefined ? null : v);

export function equal(a, b) {
  a = norm(a);
  b = norm(b);
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => equal(x, b[i]));
  if (isMap(a) && isMap(b)) {
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => k in b && equal(a[k], b[k]));
  }
  return false;
}

/** Nombre del tipo de un valor, como lo ve Tangerine. */
export function typeOf(v) {
  v = norm(v);
  if (v === null) return "Nil";
  if (typeof v === "number") return Number.isInteger(v) ? "Int" : "Float";
  if (typeof v === "string") return "String";
  if (typeof v === "boolean") return "Bool";
  if (Array.isArray(v)) return "List";
  if (v instanceof Fn || typeof v === "function") return "Fn";
  if (v instanceof Class) return "Class";
  if (v instanceof Instance) return v.cls.name;
  if (isState(v)) return "State";
  if (v instanceof VNode) return "View";
  if (isBinding(v)) return "Binding";
  if (isMap(v)) return "Map";
  if (v instanceof Promise) return "Promise";
  return "Element";
}

/** Convierte un valor en texto. Con `nested`, los strings llevan comillas. */
export function show(v, nested, depth) {
  depth = depth || 0;
  if (isState(v)) return show(v[STATE].read(), nested, depth);
  if (v instanceof VNode) return v.tag ? `<${v.tag}>` : "<view>";
  if (v instanceof Promise) return "<promise>";
  if (isBinding(v)) return show(v.get(), nested, depth);
  v = norm(v);
  if (v === null) return "nil";
  if (typeof v === "string") return nested ? JSON.stringify(v) : v;
  if (typeof v === "number") return Number.isInteger(v) || !isFinite(v) ? String(v) : String(Math.round(v * 1e10) / 1e10);
  if (typeof v === "boolean") return String(v);
  if (depth > 5) return "…";
  if (Array.isArray(v)) return "[" + v.map((x) => show(x, true, depth + 1)).join(", ") + "]";
  if (v instanceof Fn) return v.decl.closure ? "<closure>" : `<fn ${v.name}>`;
  if (v instanceof Class) return `<class ${v.name}>`;
  if (typeof v === "function") return `<fn ${v.tngName || "nativa"}>`;
  const fields = (o) => {
    const ks = Object.keys(o);
    return ks.length ? "{ " + ks.map((k) => `${k}: ${show(o[k], true, depth + 1)}`).join(", ") + " }" : "{}";
  };
  if (v instanceof Instance) return v.cls.name + " " + fields(v.fields);
  if (isMap(v)) return fields(v);
  if (typeof globalThis.Element !== "undefined" && v instanceof globalThis.Element) return `<${v.tagName.toLowerCase()}>`;
  return String(v);
}

/** Convierte un valor de JavaScript (JSON) en un valor de Tangerine. */
export function fromJS(v) {
  if (v === undefined || v === null) return null;
  if (Array.isArray(v)) return v.map(fromJS);
  if (typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype) {
    const o = Object.create(null);
    for (const k of Object.keys(v)) o[k] = fromJS(v[k]);
    return o;
  }
  return v;
}

/** Convierte un valor de Tangerine en JavaScript plano (mapas a objetos normales). */
export function toJS(v) {
  v = norm(v);
  if (Array.isArray(v)) return v.map(toJS);
  if (isMap(v)) {
    const o = {};
    for (const k of Object.keys(v)) o[k] = toJS(v[k]);
    return o;
  }
  if (v instanceof Instance) {
    const o = {};
    for (const k of Object.keys(v.fields)) o[k] = toJS(v.fields[k]);
    return o;
  }
  return v;
}
