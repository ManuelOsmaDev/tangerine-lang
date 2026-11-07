// ─────────────── 1. Lexer: texto fuente a tokens ───────────────
import { TngError } from "./errores.js";

export const KEYWORDS = new Set([
  "let", "var", "fn", "return", "if", "else", "while", "loop", "for", "in", "break", "continue",
  "match", "class", "struct", "self", "super", "do", "catch", "throw", "true", "false", "nil",
  "import", "export", "async", "await",
]);

const OPS3 = new Set(["..="]);
const OPS2 = new Set(["==", "!=", "<=", ">=", "&&", "||", "=>", "->", "**", "??", "?.", "..", "+=", "-=", "*=", "/="]);
const OPS1 = new Set("+-*/%<>=!(){}[],;.:?|@$");
const esc = (e) => (e === "n" ? "\n" : e === "t" ? "\t" : e === "r" ? "\r" : e === "0" ? "\0" : e);

const isDigit = (c) => c >= "0" && c <= "9";
const IDENT_START = /[A-Za-zÀ-ɏ_]/;
const IDENT_PART = /[A-Za-z0-9À-ɏ_]/;

/**
 * Convierte código fuente en una lista de tokens.
 * @param {string} src
 * @param {{line?: number, col?: number, file?: string}} [opciones] posición inicial (para interpolaciones)
 */
export function lexer(src, opciones) {
  const o = typeof opciones === "number" ? { line: opciones } : opciones || {};
  const file = o.file || null;
  const t = [];
  const n = src.length;
  let i = 0;
  let line = o.line || 1;
  // Columna = i - lineStart + 1. En la primera línea se desplaza si el código empieza a mitad de línea.
  let lineStart = -((o.col || 1) - 1);
  const col = (at) => at - lineStart + 1;
  const fail = (msg, l, c, incomplete) => {
    const e = new TngError(msg, l, c, file);
    e.incomplete = !!incomplete;
    return e;
  };
  const newline = (at) => { line++; lineStart = at + 1; };

  while (i < n) {
    const c = src[i];
    if (c === "\n") { newline(i); i++; continue; }
    if (c === " " || c === "\t" || c === "\r") { i++; continue; }
    if (c === "/" && src[i + 1] === "/") { while (i < n && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") {
      const l0 = line, c0 = col(i);
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) { if (src[i] === "\n") newline(i); i++; }
      if (i >= n) throw fail("Comentario sin cerrar: falta */", l0, c0, true);
      i += 2;
      continue;
    }
    if (isDigit(c)) {
      const start = i, c0 = col(i);
      while (i < n && (isDigit(src[i]) || src[i] === "_")) i++;
      if (src[i] === "." && isDigit(src[i + 1] || "")) {
        i++;
        while (i < n && (isDigit(src[i]) || src[i] === "_")) i++;
      }
      t.push({ type: "num", value: Number(src.slice(start, i).replace(/_/g, "")), line, col: c0 });
      continue;
    }
    if (c === "'") {
      const l0 = line, c0 = col(i);
      let s = "";
      i++;
      while (i < n && src[i] !== "'") {
        if (src[i] === "\\" && i + 1 < n) { s += esc(src[i + 1]); i += 2; continue; }
        if (src[i] === "\n") newline(i);
        s += src[i++];
      }
      if (i >= n) throw fail("String sin cerrar: falta la comilla ' final", l0, c0, true);
      i++;
      t.push({ type: "str", value: s, line: l0, col: c0 });
      continue;
    }
    if (c === '"') {
      const l0 = line, c0 = col(i), parts = [];
      let s = "", interp = false;
      i++;
      while (i < n && src[i] !== '"') {
        const ch = src[i];
        if (ch === "\\" && i + 1 < n) { s += esc(src[i + 1]); i += 2; continue; }
        if (ch === "{") {
          interp = true;
          if (s) parts.push(s);
          s = "";
          const lb = line, cb = col(i);
          i++;
          const el = line, ec = col(i);
          let depth = 1;
          const start = i;
          while (i < n) {
            const d = src[i];
            if (d === '"' || d === "'") {
              i++;
              while (i < n && src[i] !== d) { if (src[i] === "\\") i++; i++; }
              if (i < n) i++;
              continue;
            }
            if (d === "{") depth++;
            else if (d === "}") { depth--; if (depth === 0) break; }
            if (d === "\n") newline(i);
            i++;
          }
          if (i >= n) throw fail("Falta '}' para cerrar la interpolación dentro del string", lb, cb, true);
          const expr = src.slice(start, i);
          i++;
          if (!expr.trim()) throw fail("Hay un {} vacío dentro del string. Usa \\{ para escribir una llave", lb, cb);
          parts.push({ code: expr, line: el, col: ec });
          continue;
        }
        if (ch === "\n") newline(i);
        s += ch;
        i++;
      }
      if (i >= n) throw fail('String sin cerrar: falta la comilla " final', l0, c0, true);
      i++;
      if (!interp) t.push({ type: "str", value: s, line: l0, col: c0 });
      else { if (s) parts.push(s); t.push({ type: "template", parts, line: l0, col: c0 }); }
      continue;
    }
    if (IDENT_START.test(c)) {
      const start = i, c0 = col(i);
      while (i < n && IDENT_PART.test(src[i])) i++;
      const id = src.slice(start, i);
      t.push({ type: KEYWORDS.has(id) ? id : "id", value: id, line, col: c0 });
      continue;
    }
    const three = src.slice(i, i + 3), two = src.slice(i, i + 2);
    if (OPS3.has(three)) { t.push({ type: three, line, col: col(i) }); i += 3; continue; }
    if (OPS2.has(two)) { t.push({ type: two, line, col: col(i) }); i += 2; continue; }
    if (OPS1.has(c)) { t.push({ type: c, line, col: col(i) }); i++; continue; }
    throw fail(`Carácter inesperado '${c}'`, line, col(i));
  }
  t.push({ type: "eof", line, col: col(i) });
  return t;
}

/** Describe un token en lenguaje humano para los mensajes de error. */
export function describe(t) {
  if (t.type === "eof") return "el final del programa";
  if (t.type === "num") return `el número ${t.value}`;
  if (t.type === "str" || t.type === "template") return "un string";
  if (t.value !== undefined) return `'${t.value}'`;
  return `'${t.type}'`;
}
