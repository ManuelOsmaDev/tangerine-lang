// Tipos de tangerine-lang

/** Un valor de Tangerine visto desde JavaScript. Los mapas son objetos sin prototipo. */
export type TngValue = null | boolean | number | string | TngValue[] | { [key: string]: TngValue } | Function | object;

/** Función nativa que Tangerine puede llamar. */
export type NativeFn = (...args: any[]) => any;

export interface Plugin {
  name?: string;
  install(tng: Tangerine): void;
}
export type PluginLike = Plugin | ((tng: Tangerine) => void);

export interface TangerineOptions {
  /** Recibe cada línea que escribe log. Por defecto console.log. */
  output?: (line: string) => void;
  /** Máximo de pasos por ejecución. 0 o ausente = sin límite. */
  stepLimit?: number;
  /** Funciones y valores globales extra. */
  natives?: Record<string, any>;
  /** Plugins a instalar. */
  plugins?: PluginLike[];
  /** Módulos en memoria: ruta -> código. */
  modules?: Record<string, string>;
  /** Convierte la ruta de un import en una clave de módulo. */
  resolve?: (spec: string, from: string | null) => string;
  /** Lee un módulo que no está en memoria. Devuelve null si no existe. */
  read?: (key: string) => string | null;
  /** Recibe los errores de los callbacks llamados con invoke (eventos). */
  onError?: (message: string) => void;
  /** Instalar los plugins registrados con Tangerine.registerPlugin. Por defecto true. */
  globalPlugins?: boolean;
}

export interface RunResult {
  output: string[];
  error: string | null;
}

export interface Session {
  run(code: string): TngValue;
  has(name: string): boolean;
}

export class TngError extends Error {
  line: number | null;
  col: number | null;
  file: string | null;
  /** true si el código terminó antes de tiempo (falta cerrar algo). */
  incomplete: boolean;
}

export class Thrown {
  value: TngValue;
  line: number | null;
  file: string | null;
}

export interface Token {
  type: string;
  value?: any;
  line: number;
  col: number;
}

export class Tangerine {
  constructor(options?: TangerineOptions);
  readonly options: TangerineOptions;
  readonly modules: Map<string, string>;
  readonly plugins: string[];
  stepLimit: number;

  define(name: string, value: any): this;
  defineAll(values: Record<string, any>): this;
  use(plugin: PluginLike): this;
  addModule(path: string, code: string): this;
  /** Ejecuta código. Lanza TngError si falla. */
  run(code: string, options?: { file?: string }): TngValue;
  runModule(path: string): TngValue;
  /** Ejecuta código sin lanzar; captura la salida. */
  runCode(code: string, options?: { file?: string }): RunResult;
  session(): Session;
  invoke(fn: any, args?: any[]): TngValue;
  call(fn: any, args?: any[]): TngValue;
  message(err: unknown): string;
  globals(): string[];
  show(value: any, nested?: boolean): string;
  truthy(value: any): boolean;
  /** Solo en el navegador: descarga un .tng y sus imports, y lo ejecuta. */
  load?(url: string): Promise<TngValue>;

  static VERSION: string;
  static KEYWORDS: Set<string>;
  static registerPlugin(plugin: PluginLike): void;
  static runCode(code: string, options?: TangerineOptions): RunResult;
  static lexer: typeof lexer;
  static parser: typeof parser;
  static parse: typeof parse;
  static sx: typeof sx;
  static show: typeof show;
  static truthy: typeof truthy;
  static makeMap: typeof makeMap;
  static isMap: typeof isMap;
  static typeOf: typeof typeOf;
  static fromJS: typeof fromJS;
  static toJS: typeof toJS;
  static importsOf: typeof importsOf;
  static resolvePath: typeof resolvePath;
  static TngError: typeof TngError;
  static Thrown: typeof Thrown;
  /** Solo en el navegador. */
  static start?(options?: TangerineOptions): Promise<Tangerine>;
}

export const VERSION: string;
export const KEYWORDS: Set<string>;
export function lexer(src: string, options?: { line?: number; col?: number; file?: string }): Token[];
export function parser(tokens: Token[], options?: "expr" | { mode?: "expr"; file?: string }): any;
export function parse(src: string, file?: string): any[];
export function sx(node: any): string;
export function importsOf(ast: any[]): string[];
export function resolvePath(spec: string, from: string | null): string;
export function show(value: any, nested?: boolean): string;
export function truthy(value: any): boolean;
export function makeMap(pairs: Record<string, any>): Record<string, any>;
export function isMap(value: any): boolean;
export function typeOf(value: any): string;
export function fromJS(value: any): TngValue;
export function toJS(value: TngValue): any;

export default Tangerine;
