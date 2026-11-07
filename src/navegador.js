// Punto de entrada para el navegador (bundle global `Tangerine`).
//
// Al cargar la página ejecuta solo los <script type="text/tangerine">:
//   <script type="text/tangerine" data-module="util.tng"> ... </script>   registra un módulo
//   <script type="text/tangerine" src="main.tng"></script>               lo descarga con sus imports
//   <script type="text/tangerine"> println("hola") </script>             se ejecuta
// Para desactivar el arranque automático: <script src="tangerine.js" data-manual></script>
import { Tangerine, importsOf, parse, resolvePath } from "./index.js";
import { dom } from "./plugins/dom.js";

Tangerine.registerPlugin(dom());
Tangerine.dom = dom;
globalThis.Tangerine = Tangerine;

/** Descarga un módulo y todos los que importa, y los registra en `tng`. */
async function prefetch(tng, url, seen) {
  const key = resolvePath(url, null);
  if (seen.has(key) || tng.modules.has(key)) return key;
  seen.add(key);
  const res = await fetch(key);
  if (!res.ok) throw new Error(`No se pudo descargar '${key}' (HTTP ${res.status})`);
  const src = await res.text();
  tng.addModule(key, src);
  let deps = [];
  try { deps = importsOf(parse(src, key)); } catch { /* el error de sintaxis se mostrará al ejecutar */ }
  await Promise.all(deps.map((d) => prefetch(tng, resolvePath(d, key), seen)));
  return key;
}

/**
 * Carga un archivo .tng (y sus imports) por HTTP y lo ejecuta.
 * @returns {Promise<any>} el valor de la última instrucción
 */
Tangerine.prototype.load = async function (url) {
  const key = await prefetch(this, url, new Set());
  return this.runModule(key);
};

function showFailure(msg) {
  console.error("Tangerine: " + msg);
  const target = document.getElementById("app") || document.body;
  if (!target) return;
  const p = document.createElement("pre");
  p.className = "tangerine-fallo";
  p.style.cssText = "white-space:pre-wrap;font:14px/1.5 ui-monospace,monospace;color:#b42318;background:#fff4f2;border:1px solid #f3c6bf;border-radius:8px;padding:12px 16px;margin:16px";
  p.textContent = "Tangerine no pudo ejecutar el programa.\n" + msg;
  target.appendChild(p);
}

/** Ejecuta todos los <script type="text/tangerine"> de la página, en orden. */
Tangerine.start = async function (opciones = {}) {
  const mapa = document.getElementById("tangerine-imports");
  let imports = opciones.imports;
  if (mapa && !imports) {
    try { imports = JSON.parse(mapa.textContent); } catch { showFailure("El mapa de paquetes (tangerine-imports) no es JSON válido"); }
  }
  const tng = new Tangerine({ ...opciones, imports });
  const scripts = Array.from(document.querySelectorAll('script[type="text/tangerine"]'));
  for (const s of scripts) if (s.dataset.module) tng.addModule(s.dataset.module, s.textContent);
  for (const s of scripts) {
    if (s.dataset.module && !("main" in s.dataset)) continue;
    try {
      if (s.dataset.module) tng.runModule(s.dataset.module);
      else if (s.src || s.getAttribute("src")) await tng.load(s.getAttribute("src"));
      else tng.run(s.textContent, { file: s.id ? s.id + ".tng" : undefined });
    } catch (err) {
      showFailure(tng.message(err));
    }
  }
  return tng;
};

const current = typeof document !== "undefined" ? document.currentScript : null;
if (typeof document !== "undefined" && !(current && current.hasAttribute("data-manual"))) {
  const go = () => { Tangerine.instance = Tangerine.start(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go);
  else go();
}

export default Tangerine;
