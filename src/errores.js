// Errores y señales de control del intérprete.

/** Error de Tangerine: sintaxis o ejecución. Lleva línea, columna y archivo cuando se conocen. */
export class TngError extends Error {
  constructor(mensaje, linea, columna, archivo) {
    super(mensaje);
    this.name = "TngError";
    this.line = linea || null;
    this.col = columna || null;
    this.file = archivo || null;
    /** true cuando el código terminó antes de tiempo (útil para el REPL multilínea). */
    this.incomplete = false;
  }
}

/** Valor lanzado con `throw` desde Tangerine. */
export class Thrown {
  constructor(valor, linea, archivo) {
    this.value = valor;
    this.line = linea || null;
    this.file = archivo || null;
  }
}

/** Señal interna de `return`. */
export class Return {
  constructor(valor) {
    this.value = valor;
  }
}

/** El programa superó el límite de pasos configurado. */
export class StepLimit {
  constructor(mensaje) {
    this.message = mensaje;
  }
}

export const BREAK = { control: "break" };
export const CONTINUE = { control: "continue" };

/** Antepone la ubicación ("main.tng, línea 3, columna 5: ") a un mensaje. */
export function ubicacion(linea, columna, archivo) {
  if (!linea) return archivo ? `${archivo}: ` : "";
  const donde = `línea ${linea}${columna ? `, columna ${columna}` : ""}`;
  return archivo ? `${archivo}, ${donde}: ` : donde[0].toUpperCase() + donde.slice(1) + ": ";
}
