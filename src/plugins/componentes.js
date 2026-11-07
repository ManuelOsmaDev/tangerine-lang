// Plugin "componentes": structs con @Component, @State, @Input, @Output y view { }.
// Viene instalado en todas las instancias. El plugin "dom" los dibuja en la página
// y los registra como Web Components para usarlos desde Angular, React o HTML.
//
//   @Component("mi-contador")
//   struct Contador {
//     @Input var paso = 1
//     @Output var cambio
//     @State var cuenta = 0
//
//     view {
//       p(.numero) { "{cuenta}" }
//       button("+") { cuenta += paso; cambio.emit(cuenta) }
//     }
//   }

import { Instance, VNode, isBinding, isMap, makeMap, show, truthy, norm } from "../valores.js";

/** Marca de los emisores de @Output: guarda quién escucha desde JavaScript. */
export const LISTENERS = Symbol("tangerine.listeners");

const ETIQUETA = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;
const VACIOS = new Set(["br", "hr", "img", "input", "meta", "link", "source", "area", "col", "embed", "wbr"]);

/** Campos decorados de una clase y de sus padres. */
export function decoratedFields(cls) {
  const chain = [];
  for (let c = cls; c; c = c.parent) chain.unshift(c);
  const out = [];
  for (const c of chain) for (const f of c.fields) if (f.decor) out.push(f);
  return out;
}

const escapar = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Convierte un view en HTML (para servidor, pruebas o correos). */
export function toHTML(v) {
  if (typeof v === "string") return escapar(v);
  if (!(v instanceof VNode)) return "";
  const inner = v.children.map(toHTML).join("");
  if (v.tag === null) return inner;
  let attrs = "";
  if (v.classes.length) attrs += ` class="${escapar(v.classes.join(" "))}"`;
  for (const k of Object.keys(v.attrs)) {
    const x = norm(v.attrs[k]);
    if (x === null || x === false) continue;
    attrs += x === true ? ` ${k}` : ` ${k}="${escapar(show(x))}"`;
  }
  if (v.bind) {
    const x = norm(v.bind.get());
    if (v.attrs.type === "checkbox") { if (truthy(x)) attrs += " checked"; }
    else if (v.tag !== "textarea" && x !== null) attrs += ` value="${escapar(show(x))}"`;
  }
  if (VACIOS.has(v.tag)) return `<${v.tag}${attrs}>`;
  const body = v.tag === "textarea" && v.bind ? escapar(show(norm(v.bind.get()) ?? "")) : inner;
  return `<${v.tag}${attrs}>${body}</${v.tag}>`;
}

/** Crea el plugin de componentes. */
export function componentes() {
  return {
    name: "componentes",
    install(tng) {
      const call = (f, args) => tng._rt.call(f, args || []);
      const registry = new Map(); // etiqueta -> clase
      const alDefinir = [];

      function emisor(nombre) {
        const listeners = [];
        const m = makeMap([]);
        m.emit = (v) => {
          for (const l of listeners.slice()) l(norm(v));
          return null;
        };
        m.emit.tngName = "emit";
        m.listen = (f) => {
          listeners.push((v) => call(f, [v]));
          return null;
        };
        m.listen.tngName = "listen";
        Object.defineProperty(m, LISTENERS, { value: listeners });
        Object.defineProperty(m, "toString", { value: () => `<output ${nombre}>` });
        return m;
      }

      // @State y @Input avisan al cambiar; @Output es un emisor con emit(valor).
      tng.hooks.onInstance = (inst) => {
        const campos = decoratedFields(inst.cls);
        if (!campos.length) return;
        for (const f of campos) {
          if (f.decor === "Output") {
            inst.fields[f.name] = emisor(f.name);
            continue;
          }
          const sig = tng.reactive.signal(inst.fields[f.name]);
          Object.defineProperty(inst.fields, f.name, {
            get: () => sig.read(),
            set: (v) => sig.write(v),
            enumerable: true,
            configurable: true,
          });
        }
      };

      tng.hooks.decorators.Component = (cls, args) => {
        const tag = args[0];
        if (typeof tag !== "string" || !ETIQUETA.test(tag))
          throw new Error(`@Component necesita una etiqueta en minúsculas con guion, por ejemplo @Component("mi-${cls.name.toLowerCase()}")`);
        if (!cls.findMethod("view")) throw new Error(`El componente ${cls.name} necesita un view { } con lo que muestra`);
        const campos = decoratedFields(cls);
        cls.component = {
          tag,
          inputs: campos.filter((f) => f.decor === "Input").map((f) => f.name),
          outputs: campos.filter((f) => f.decor === "Output").map((f) => f.name),
        };
        registry.set(tag, cls);
        for (const f of alDefinir) f(cls);
      };

      /** El view de una instancia, como árbol de VNode. */
      function renderView(inst) {
        const view = inst instanceof Instance && inst.cls.findMethod("view");
        if (!view) throw new Error(`${show(inst)} no tiene un view { }`);
        return call(view.bind(inst), []);
      }

      tng.components = { registry, renderView, onDefine: (f) => alDefinir.push(f), toHTML, LISTENERS, isBinding };

      tng.defineAll({
        // render_html(Contador()) da el HTML del view: sirve en el servidor y en pruebas.
        render_html: (x) => {
          if (x instanceof Instance) return toHTML(renderView(x));
          if (x instanceof VNode) return toHTML(x);
          if (isMap(x)) return "";
          return toHTML(String(show(x)));
        },
      });
    },
  };
}

export default componentes;
