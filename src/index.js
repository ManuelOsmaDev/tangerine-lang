// API pública de Tangerine.
import { TngError, Thrown } from "./errores.js";
import { lexer, KEYWORDS } from "./lexer.js";
import { parser, parse, sx, importsOf } from "./parser.js";
import { createInterpreter, resolvePath } from "./interprete.js";
import { show, truthy, makeMap, isMap, typeOf, fromJS, toJS } from "./valores.js";
import { reactivo } from "./plugins/reactivo.js";
import { componentes } from "./plugins/componentes.js";

export const VERSION = "5.2.2";

const globalPlugins = [];

const isBare = (spec) => !/^(\.{1,2}\/|\/|[a-z][a-z0-9+.-]*:\/\/)/i.test(spec);

/**
 * Resuelve un import usando un mapa de paquetes, como los import maps del navegador:
 * { "colores": "node_modules/colores/index.tng", "colores/": "node_modules/colores/" }
 */
export function resolveWithMap(spec, from, imports) {
  if (imports && isBare(spec)) {
    if (Object.prototype.hasOwnProperty.call(imports, spec)) return imports[spec];
    let best = null;
    for (const k of Object.keys(imports)) if (k.endsWith("/") && spec.startsWith(k) && (!best || k.length > best.length)) best = k;
    if (best) return resolvePath(imports[best] + spec.slice(best.length), null);
  }
  return resolvePath(spec, from);
}

/**
 * Un intérprete de Tangerine. Cada instancia es independiente:
 * tiene su propia salida, sus funciones nativas y su caché de módulos.
 *
 * @example
 * const tng = new Tangerine({ output: (linea) => console.log(linea) });
 * tng.run('log("Hola")');
 */
export class Tangerine {
  /**
   * @param {object} [opciones]
   * @param {(linea: string) => void} [opciones.output] recibe cada línea que escribe log
   * @param {number} [opciones.stepLimit] máximo de pasos por ejecución; 0 o ausente = sin límite
   * @param {Record<string, any>} [opciones.natives] funciones y valores globales extra
   * @param {Array} [opciones.plugins] plugins a instalar
   * @param {Record<string, string>} [opciones.modules] módulos en memoria: ruta -> código
   * @param {(ruta: string, desde: string|null) => string} [opciones.resolve] cómo resolver rutas de import
   * @param {(clave: string) => string|null} [opciones.read] cómo leer un módulo que no está en memoria
   * @param {Record<string, string>} [opciones.imports] mapa de paquetes: nombre -> clave del módulo
   * @param {(mensaje: string) => void} [opciones.onError] errores en callbacks (eventos)
   * @param {boolean} [opciones.globalPlugins] instalar los plugins registrados con Tangerine.registerPlugin (por defecto true)
   */
  constructor(opciones = {}) {
    this.options = opciones;
    /** Mapa de paquetes (nombre -> clave). Se puede ampliar en cualquier momento. */
    this.imports = { ...(opciones.imports || {}) };
    this.modules = new Map(Object.entries(opciones.modules || {}).map(([k, v]) => [resolvePath(k, null), v]));
    const self = this;
    /** Ganchos del intérprete: decoradores de clase (@Component) y aviso al crear una instancia. */
    this.hooks = { decorators: Object.create(null), onInstance: null };
    this._rt = createInterpreter({
      output: opciones.output || ((l) => console.log(l)),
      get stepLimit() { return self.stepLimit; },
      resolve: opciones.resolve || ((spec, from) => resolveWithMap(spec, from, self.imports)),
      read: (key) => (self.modules.has(key) ? self.modules.get(key) : opciones.read ? opciones.read(key) : null),
      onError: opciones.onError || ((m) => console.error("Tangerine: " + m)),
      hooks: this.hooks,
    });
    this.stepLimit = opciones.stepLimit || 0;
    this.plugins = [];
    this.use(reactivo());
    this.use(componentes());
    if (opciones.globalPlugins !== false) for (const p of globalPlugins) this.use(p);
    for (const p of opciones.plugins || []) this.use(p);
    if (opciones.natives) this.defineAll(opciones.natives);
  }

  /** Define una función o valor global visible desde Tangerine. */
  define(nombre, valor) {
    this._rt.define(nombre, valor);
    return this;
  }

  /** Define varias funciones o valores globales a la vez. */
  defineAll(objeto) {
    for (const k of Object.keys(objeto)) this.define(k, objeto[k]);
    return this;
  }

  /**
   * Instala un plugin. Un plugin es una función `(tng) => void`
   * o un objeto `{ name, install(tng) }`.
   */
  use(plugin) {
    const name = typeof plugin === "function" ? plugin.name : plugin && plugin.name;
    if (name && this.plugins.includes(name)) return this;
    if (typeof plugin === "function") plugin(this);
    else if (plugin && typeof plugin.install === "function") plugin.install(this);
    else throw new TypeError("Un plugin debe ser una función o un objeto con install(tng)");
    if (name) this.plugins.push(name);
    return this;
  }

  /** Registra un módulo en memoria para poder importarlo. */
  addModule(ruta, codigo) {
    this.modules.set(this._key(ruta), String(codigo));
    return this;
  }

  /**
   * Ejecuta código y devuelve el valor de la última instrucción.
   * Si algo falla lanza un TngError con un mensaje en español y la ubicación.
   */
  run(codigo, opciones = {}) {
    try {
      return this._rt.run(codigo, opciones.file ? this._key(opciones.file) : null);
    } catch (x) {
      throw this._wrap(x);
    }
  }

  /**
   * Carga un módulo (una sola vez) y devuelve sus exports como un mapa de Tangerine.
   * Es lo que hace `import` desde Tangerine, pero llamado desde JavaScript.
   */
  import(ruta) {
    try { return this._rt.loadModule(this._key(ruta)); }
    catch (x) { throw this._wrap(x); }
  }

  /** Olvida un módulo ya cargado para que el próximo import lo vuelva a ejecutar. */
  forget(ruta) {
    this._rt.forget(this._key(ruta));
    return this;
  }

  /** Ejecuta un módulo registrado (o que se pueda leer) por su ruta. */
  runModule(ruta) {
    const key = this._key(ruta);
    const src = this.modules.has(key) ? this.modules.get(key) : this.options.read ? this.options.read(key) : null;
    if (src == null) throw new TngError(`No se encontró el módulo '${key}'`);
    return this.run(src, { file: key });
  }

  /**
   * Ejecuta código sin lanzar errores y captura la salida.
   * Devuelve un mapa de Tangerine `{ output: [líneas], error: texto | nil }`.
   */
  runCode(codigo, opciones = {}) {
    const out = [];
    const prev = this._rt.output;
    this._rt.setOutput((l) => out.push(l));
    try {
      this._rt.run(String(codigo), opciones.file || null);
      return makeMap({ output: out, error: null, trace: [] });
    } catch (x) {
      return makeMap({ output: out, error: this._rt.message(x), trace: this._rt.trace(x) });
    } finally {
      this._rt.setOutput(prev);
    }
  }

  /** Crea una sesión con variables que persisten entre ejecuciones (para un REPL). */
  session() {
    const env = this._rt.newEnv();
    return {
      run: (codigo) => {
        try { return this._rt.run(codigo, null, env); }
        catch (x) { throw this._wrap(x); }
      },
      has: (nombre) => env.has(nombre),
    };
  }

  /** Llama a una función de Tangerine. Los errores van a `onError` en vez de lanzarse. */
  invoke(fn, args) {
    return this._rt.invoke(fn, args);
  }

  /** Llama a una función de Tangerine y lanza los errores. */
  call(fn, args) {
    try { return this._rt.call(fn, args); }
    catch (x) { throw this._wrap(x); }
  }

  /** Rastro de llamadas de un error, de la más interna a la más externa. */
  trace(err) {
    return this._rt.trace(err && err.original && !err.trace ? err.original : err);
  }

  /** Texto en español que describe un error. */
  message(err) {
    if (err instanceof TngError && !err.original) return this._rt.message(err);
    if (err && err.tngMessage) return err.tngMessage;
    return this._rt.message(err && err.original ? err.original : err);
  }

  /** Nombres de todas las funciones y valores globales disponibles. */
  globals() {
    return [...this._rt.global.vars.keys()];
  }

  show(valor, nested) { return show(valor, nested); }
  truthy(valor) { return truthy(valor); }

  _key(ruta) {
    return this.options.resolve ? this.options.resolve(ruta, null) : resolvePath(ruta, null);
  }

  _wrap(x) {
    const msg = this._rt.message(x);
    const e = x instanceof TngError ? x : new TngError(msg, x && x.line, null, x && x.file);
    e.tngMessage = msg;
    if (e !== x) { e.original = x; if (x && x.trace) e.trace = x.trace; }
    return e;
  }

  /** Registra un plugin para todas las instancias que se creen después. */
  static registerPlugin(plugin) {
    globalPlugins.push(plugin);
  }

  /** Ejecuta código en una instancia nueva y devuelve `{ output, error }` (como objeto JS). */
  static runCode(codigo, opciones) {
    const r = new Tangerine({ stepLimit: 400000, ...opciones }).runCode(codigo);
    return { output: r.output, error: r.error, trace: r.trace };
  }
}

Tangerine.VERSION = VERSION;
Tangerine.KEYWORDS = KEYWORDS;
Tangerine.lexer = lexer;
Tangerine.parser = parser;
Tangerine.parse = parse;
Tangerine.sx = sx;
Tangerine.show = show;
Tangerine.truthy = truthy;
Tangerine.makeMap = makeMap;
Tangerine.isMap = isMap;
Tangerine.typeOf = typeOf;
Tangerine.fromJS = fromJS;
Tangerine.toJS = toJS;
Tangerine.importsOf = importsOf;
Tangerine.resolvePath = resolvePath;
Tangerine.resolveWithMap = resolveWithMap;
Tangerine.TngError = TngError;
Tangerine.Thrown = Thrown;

export { TngError, Thrown, isBare, KEYWORDS, lexer, parser, parse, sx, importsOf, resolvePath, show, truthy, makeMap, isMap, typeOf, fromJS, toJS };
export default Tangerine;
