// Plugin "react": escribe componentes de React en Tangerine.
//
//   import * as React from "react";
//   import { react } from "tangerine-lang/react";
//   const tng = new Tangerine({ plugins: [react(React)] });
//
// En Tangerine:
//   export fn Contador(props) {
//     let (n, set_n) = use_state(props.inicio ?? 0)
//     h("button", { class: "boton", on_click: || set_n(n + 1) }, "Clics: {n}")
//   }

const EVENT_KEYS = /^on_([a-z_]+)$/;
const camel = (s) => s.replace(/_([a-z])/g, (_m, c) => c.toUpperCase());

/** Crea el plugin. Recibe el módulo de React para no depender de una versión concreta. */
export function react(React) {
  if (!React || typeof React.createElement !== "function") throw new TypeError("react(React) necesita el módulo de React: import * as React from \"react\"");
  return {
    name: "react",
    install(tng) {
      const isFn = (v) => v && typeof v === "object" && v.decl && v.env; // función de Tangerine
      const components = new WeakMap();
      const callbacks = new WeakMap();

      /** Objeto de JS (props) a mapa de Tangerine, sin tocar los valores. */
      const toMap = (obj) => {
        const m = Object.create(null);
        if (obj) for (const k of Object.keys(obj)) m[k] = obj[k];
        return m;
      };

      /** Evento de React a un mapa sencillo. */
      const eventMap = (e) => {
        if (!e || typeof e !== "object" || !("nativeEvent" in e || "target" in e)) return e;
        const m = Object.create(null);
        m.type = e.type;
        m.key = e.key ?? null;
        m.value = e.target && "value" in e.target ? e.target.value : null;
        m.checked = e.target && "checked" in e.target ? e.target.checked : null;
        m.target = e.target ?? null;
        m.prevent = () => { e.preventDefault(); return null; };
        m.stop = () => { e.stopPropagation(); return null; };
        return m;
      };

      /** Función de Tangerine a componente de React (siempre el mismo para la misma función). */
      const component = (fn) => {
        let c = components.get(fn);
        if (!c) {
          c = (props) => tng.call(fn, [toMap(props)]);
          c.displayName = fn.name || "TangerineComponent";
          components.set(fn, c);
        }
        return c;
      };

      /** Función de Tangerine a callback de JS (eventos). */
      const callback = (fn) => {
        let c = callbacks.get(fn);
        if (!c) {
          c = (...args) => tng.invoke(fn, args.map(eventMap));
          callbacks.set(fn, c);
        }
        return c;
      };

      const toJS = (v) => {
        if (isFn(v)) return callback(v);
        if (Array.isArray(v)) return v.map(toJS);
        if (v && typeof v === "object" && Object.getPrototypeOf(v) === null) {
          const o = {};
          for (const k of Object.keys(v)) o[k] = toJS(v[k]);
          return o;
        }
        return v;
      };

      const propsToJS = (props) => {
        if (props == null) return null;
        const o = {};
        for (const k of Object.keys(props)) {
          const v = props[k];
          const ev = EVENT_KEYS.exec(k);
          if (k === "class") o.className = v;
          else if (k === "for") o.htmlFor = v;
          else if (ev) o["on" + camel("_" + ev[1])] = isFn(v) ? callback(v) : v;
          else if (k === "style" && v && typeof v === "object") {
            const s = {};
            for (const p of Object.keys(v)) s[p.includes("-") ? p : camel(p)] = v[p];
            o.style = s;
          } else o[k] = toJS(v);
        }
        return o;
      };

      const children = (list) => list.flat(Infinity).map((c) => (c === undefined ? null : c));

      tng.defineAll({
        h: (tipo, props, ...hijos) => {
          const t = isFn(tipo) ? component(tipo) : tipo;
          return React.createElement(t, propsToJS(props), ...children(hijos));
        },
        fragment: (...hijos) => React.createElement(React.Fragment, null, ...children(hijos)),
        use_state: (inicial) => {
          const [valor, set] = React.useState(() => (isFn(inicial) ? tng.call(inicial, []) : inicial));
          const setter = React.useCallback((v) => { set(isFn(v) ? (prev) => tng.call(v, [prev]) : v); return null; }, []);
          return [valor, setter];
        },
        use_effect: (f, deps) => {
          React.useEffect(() => {
            const r = tng.call(f, []);
            return isFn(r) ? () => { tng.invoke(r); } : undefined;
          }, deps == null ? undefined : deps);
          return null;
        },
        use_memo: (f, deps) => React.useMemo(() => tng.call(f, []), deps == null ? undefined : deps),
        use_ref: (inicial) => {
          const ref = React.useRef(inicial === undefined ? null : inicial);
          if (Object.getPrototypeOf(ref) !== null) Object.setPrototypeOf(ref, null);
          return ref;
        },
        component: (fn) => component(fn),
      });
    },
  };
}

/** Convierte un export de Tangerine en algo útil desde JS: las funciones pasan a ser funciones de JS. */
export function wrapExport(tng, value) {
  if (value && typeof value === "object" && value.decl && value.env) {
    const f = (...args) => {
      const conv = args.map((a) => (a && typeof a === "object" && Object.getPrototypeOf(a) === Object.prototype && !a.$$typeof ? Object.assign(Object.create(null), a) : a));
      return tng.call(value, conv);
    };
    Object.defineProperty(f, "name", { value: value.decl.name });
    f.displayName = value.decl.name;
    return f;
  }
  return value;
}

export default react;
