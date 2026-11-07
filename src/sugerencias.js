// Sugerencias para los mensajes de error: "¿Quisiste decir ...?"

/** Distancia de edición entre dos textos (Damerau-Levenshtein simplificada). */
export function distancia(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev2 = null, prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
    }
    prev2 = prev;
    prev = cur;
  }
  return prev[n];
}

// Nombres que la gente trae de otros lenguajes
const EQUIVALENTES = {
  length: "len", size: "len", count: "len", lenght: "len",
  toUpperCase: "upper", toLowerCase: "lower", uppercase: "upper", lowercase: "lower",
  includes: "contains", indexOf: "index_of", forEach: "for_each", toString: "to_string",
  startsWith: "starts_with", endsWith: "ends_with", padStart: "pad_start", padEnd: "pad_end",
  reverse: "reversed", sort: "sorted", append: "push", add: "push", strip: "trim",
  console: "log", println: "log", print: "log", print_line: "log", printf: "write", puts: "log", echo: "log",
  null: "nil", None: "nil", undefined: "nil", True: "true", False: "false", self_: "self",
  const: "let", def: "fn", function: "fn", func: "fn", elif: "else if", try: "do", except: "catch",
};

/**
 * Devuelve el candidato más parecido a `nombre`, o null si ninguno se parece.
 * @param {string} nombre
 * @param {Iterable<string>} candidatos
 */
export function sugerir(nombre, candidatos) {
  const lista = [...candidatos];
  const eq = Object.prototype.hasOwnProperty.call(EQUIVALENTES, nombre) ? EQUIVALENTES[nombre] : null;
  if (eq && (lista.includes(eq) || /\s/.test(eq) || eq === "nil" || eq === "true" || eq === "false" || eq === "fn" || eq === "let" || eq === "do" || eq === "catch")) return eq;
  const limite = Math.max(1, Math.floor(nombre.length / 3));
  let mejor = null, mejorD = Infinity;
  const bajo = nombre.toLowerCase();
  for (const c of lista) {
    if (c === nombre) continue;
    const d = c.toLowerCase() === bajo ? 0.5 : distancia(bajo, c.toLowerCase());
    if (d < mejorD || (d === mejorD && mejor && c.length < mejor.length)) { mejor = c; mejorD = d; }
  }
  return mejorD <= limite ? mejor : null;
}

/** Texto " ¿Quisiste decir 'x'?" o "" si no hay sugerencia. */
export function quisiste(nombre, candidatos) {
  const s = sugerir(nombre, candidatos);
  return s ? ` ¿Quisiste decir '${s}'?` : "";
}
