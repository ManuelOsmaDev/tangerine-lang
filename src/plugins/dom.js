// Plugin "dom": conecta Tangerine con el navegador.
// Uso: new Tangerine({ plugins: [dom()] })  (en el bundle del navegador ya viene instalado)

import { Class, Instance, VNode, fromJS, toJS, norm, isState } from "../valores.js";

const reducedMotion = () => !!(typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);

/** Crea el plugin del DOM. */
export function dom() {
  return {
    name: "dom",
    install(tng) {
      const show = (v) => tng.show(v);
      const truthy = (v) => tng.truthy(v);
      const invoke = (f, args) => tng.invoke(f, args);
      let currentRoute = null;
      // Si `v` es un estado (state o computed), `f` se vuelve a aplicar cada vez que cambia.
      const live = (v, f) => (tng.reactive ? tng.reactive.watch(v, f) : f(v));
      const call = (f, args) => tng._rt.call(f, args || []);
      const isElement = (x) => typeof Element !== "undefined" && x instanceof Element;

      // ---------- Componentes: del view (VNode) al DOM ----------
      const kebab = (n) => n.replace(/_/g, "-").replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
      const camel = (n) => n.replace(/[-_]([a-z0-9])/g, (_, c) => c.toUpperCase());
      const comps = () => tng.components;
      const esComponente = (tag) => !!(comps() && comps().registry.has(tag));

      function eventInfo(ev) {
        const info = Object.create(null);
        info.type = ev.type;
        info.key = ev.key === undefined ? null : ev.key;
        info.value = ev.target && "value" in ev.target ? ev.target.value : null;
        info.detail = ev.detail === undefined ? null : fromJS(ev.detail);
        info.target = ev.target || null;
        return info;
      }

      function setAttrs(el, v) {
        const prev = el.__tngAttrs || Object.create(null);
        const custom = v.tag.includes("-");
        for (const k of Object.keys(prev)) if (!(k in v.attrs)) { el.removeAttribute(k); if (custom) el[camel(k)] = undefined; }
        for (const k of Object.keys(v.attrs)) {
          if (k === "key" || k === "ref" || k === "raw") continue;
          let x = norm(v.attrs[k]);
          if (isState(x)) x = x.get();
          if (custom && x !== null && typeof x !== "string") { el[camel(k)] = x; continue; }
          if (k === "value" && "value" in el) { const t = x === null ? "" : show(x); if (el.value !== t) el.value = t; continue; }
          if (k === "checked" && "checked" in el) { el.checked = truthy(x); continue; }
          if (x === null || x === false) el.removeAttribute(k);
          else { const t = x === true ? "" : show(x); if (el.getAttribute(k) !== t) el.setAttribute(k, t); }
        }
        el.__tngAttrs = v.attrs;
        const cls = v.classes.join(" ");
        if ((el.getAttribute("class") || "") !== cls) { if (cls) el.setAttribute("class", cls); else el.removeAttribute("class"); }
      }

      function setEvents(el, v) {
        el.__tngOn = v.on;
        const types = el.__tngTypes || (el.__tngTypes = new Set());
        for (const type of Object.keys(v.on)) {
          if (types.has(type)) continue;
          types.add(type);
          el.addEventListener(type, (ev) => {
            const f = el.__tngOn && el.__tngOn[type];
            if (!f) return;
            if (type === "submit") ev.preventDefault();
            invoke(f, f.decl && f.decl.params.length ? [eventInfo(ev)] : []);
          });
        }
      }

      function setBinding(el, v) {
        el.__tngBind = v.bind;
        if (!v.bind) return;
        const casilla = el.type === "checkbox" || el.type === "radio";
        const x = norm(v.bind.get());
        if (casilla) el.checked = truthy(x);
        else { const t = x === null ? "" : show(x); if (el.value !== t) el.value = t; }
        if (el.__tngBound) return;
        el.__tngBound = true;
        const numero = el.type === "number" || el.type === "range";
        el.addEventListener(casilla || el.tagName === "SELECT" ? "change" : "input", () => {
          const b = el.__tngBind;
          if (!b) return;
          const val = casilla ? el.checked : numero ? (el.value === "" ? null : Number(el.value)) : el.value;
          invoke(() => b.set(val));
        });
      }

      function update(el, v) {
        setAttrs(el, v);
        setEvents(el, v);
        setBinding(el, v);
      }

      function crear(v) {
        if (typeof v === "string") return document.createTextNode(v);
        const el = document.createElement(v.tag);
        if (v.tag === "button" && !("type" in v.attrs)) el.type = "button";
        el.__tngKey = keyOf(v);
        update(el, v);
        if (!esComponente(v.tag)) for (const c of v.children) el.appendChild(crear(c));
        // { ref: |el| ... } recibe el elemento real cuando ya está en la página.
        const ref = norm(v.attrs.ref);
        if (ref) queueMicrotask(() => invoke(ref, [el]));
        return el;
      }

      const mismoTipo = (d, v) =>
        typeof v === "string" ? d.nodeType === 3 : d.nodeType === 1 && d.tagName.toLowerCase() === v.tag.toLowerCase();

      // Con { key: id }, cada elemento de una lista conserva su nodo aunque la lista se reordene.
      const keyOf = (v) => (typeof v === "string" || v.attrs.key === undefined || v.attrs.key === null ? null : show(v.attrs.key));

      function patchKeyed(parent, vs) {
        const porKey = new Map();
        for (const d of Array.from(parent.childNodes)) if (d.__tngKey != null) porKey.set(d.__tngKey, d);
        let i = 0;
        for (const v of vs) {
          const k = keyOf(v);
          let d;
          if (k !== null) {
            d = porKey.get(k);
            porKey.delete(k);
            if (d && !mismoTipo(d, v)) d = null;
          } else {
            d = parent.childNodes[i];
            if (d && (d.__tngKey != null || !mismoTipo(d, v))) d = null;
          }
          if (!d) d = crear(v);
          else if (typeof v === "string") { if (d.data !== v) d.data = v; }
          else {
            update(d, v);
            if (!esComponente(v.tag) && !truthy(v.attrs.raw)) patch(d, v.children);
          }
          const actual = parent.childNodes[i];
          if (actual !== d) parent.insertBefore(d, actual || null);
          i++;
        }
        while (parent.childNodes.length > vs.length) parent.lastChild.remove();
      }

      // Cambia el DOM existente para que coincida con el view, sin rehacer lo que no cambió
      // (así un input no pierde el foco ni lo que tiene escrito).
      function patch(parent, vs) {
        if (vs.some((v) => keyOf(v) !== null)) return patchKeyed(parent, vs);
        let i = 0;
        for (const v of vs) {
          const d = parent.childNodes[i];
          if (!d) parent.appendChild(crear(v));
          else if (!mismoTipo(d, v)) parent.replaceChild(crear(v), d);
          else if (typeof v === "string") { if (d.data !== v) d.data = v; }
          else {
            update(d, v);
            // { raw: true }: lo de adentro lo maneja otro código (un gráfico, un editor...).
            if (!esComponente(v.tag) && !truthy(v.attrs.raw)) patch(d, v.children);
          }
          i++;
        }
        while (parent.childNodes.length > vs.length) parent.lastChild.remove();
      }

      // Dibuja el view de `inst` dentro de `target` y lo vuelve a dibujar cuando cambia su estado.
      function renderInto(target, inst) {
        return tng.reactive.effect(() => {
          const vn = comps().renderView(inst);
          patch(target, vn instanceof VNode ? (vn.tag === null ? vn.children : [vn]) : []);
        });
      }

      // on_mount() al aparecer en la página y on_destroy() al quitarse. Pueden ser async.
      function ciclo(inst, nombre) {
        const m = inst instanceof Instance && inst.cls.findMethod(nombre);
        if (m) invoke(m.bind(inst));
      }

      const coerce = (texto, inicial) => {
        if (typeof inicial === "number") { const n = Number(texto); return Number.isNaN(n) ? inicial : n; }
        if (typeof inicial === "boolean") return texto !== "false" && texto !== null;
        return texto;
      };

      // Cada @Component("mi-etiqueta") se registra como Web Component: sirve en HTML, Angular, React o Vue.
      function definir(cls) {
        if (typeof customElements === "undefined") return;
        const meta = cls.component;
        if (customElements.get(meta.tag)) return;
        const L = comps().LISTENERS;
        const iniciales = Object.create(null);

        class TangerineElement extends HTMLElement {
          static get observedAttributes() { return meta.inputs.map(kebab); }
          constructor() {
            super();
            this._tng = null;
            this._fx = null;
            this._pending = Object.create(null);
          }
          _set(name, v) {
            invoke(() => { this._tng.fields[name] = v; });
          }
          connectedCallback() {
            if (!this._tng) {
              const inst = invoke(cls);
              if (!(inst instanceof Instance)) return;
              this._tng = inst;
              for (const n of meta.inputs) {
                if (!(n in iniciales)) iniciales[n] = norm(inst.fields[n]);
                const a = this.getAttribute(kebab(n));
                if (a !== null) inst.fields[n] = coerce(a, iniciales[n]);
                if (n in this._pending) inst.fields[n] = this._pending[n];
              }
              for (const o of meta.outputs) {
                const em = inst.fields[o];
                if (em && em[L]) em[L].push((v) => this.dispatchEvent(new CustomEvent(o, { detail: toJS(v), bubbles: true, composed: true })));
              }
            }
            if (!this._fx) {
              const self = this;
              invoke(() => { self._fx = renderInto(self, self._tng); });
              if (this._fx) ciclo(this._tng, "on_mount");
            }
          }
          disconnectedCallback() {
            if (this._fx) {
              tng.reactive.dispose(this._fx);
              this._fx = null;
              ciclo(this._tng, "on_destroy");
            }
          }
          attributeChangedCallback(attr, _old, v) {
            const n = meta.inputs.find((x) => kebab(x) === attr);
            if (!n || !this._tng) return;
            this._set(n, v === null ? iniciales[n] : coerce(v, iniciales[n]));
          }
        }
        for (const n of meta.inputs) {
          const prop = {
            get() { return this._tng ? toJS(this._tng.fields[n]) : this._pending[n]; },
            set(v) {
              const x = v instanceof Node ? v : fromJS(v);
              if (this._tng) this._set(n, x);
              else this._pending[n] = x;
            },
            configurable: true,
          };
          Object.defineProperty(TangerineElement.prototype, n, prop);
          if (camel(n) !== n) Object.defineProperty(TangerineElement.prototype, camel(n), prop);
        }
        customElements.define(meta.tag, TangerineElement);
      }

      if (tng.components) {
        for (const cls of tng.components.registry.values()) definir(cls);
        tng.components.onDefine(definir);
      }

      tng.defineAll({
        // mount("#app", App) dibuja un struct con view { } en la página y lo mantiene al día.
        mount: (target, what) => {
          const el = typeof target === "string" ? document.querySelector(target) : target;
          if (!el) throw new Error(`mount no encontró '${target}' en la página`);
          const inst = what instanceof Class ? tng._rt.call(what, []) : what;
          if (!(inst instanceof Instance)) throw new Error("mount necesita un struct con view { }, por ejemplo mount(\"#app\", App)");
          renderInto(el, inst);
          ciclo(inst, "on_mount");
          return inst;
        },
        query: (sel) => document.querySelector(sel),
        query_all: (sel) => Array.from(document.querySelectorAll(sel)),
        el: (tag, cls, text) => {
          const e = document.createElement(tag);
          live(cls, (c) => { e.className = c ? show(c) : ""; });
          if (tag === "button") e.type = "button";
          live(text, (t) => { if (t !== null && t !== undefined) e.textContent = show(t); });
          return e;
        },
        append: (parent, child) => { parent.appendChild(child); return child; },
        remove: (e) => { if (e) e.remove(); return null; },
        add_text: (e, s) => { e.appendChild(document.createTextNode(show(s))); return e; },
        set_text: (e, s) => { live(s, (t) => { e.textContent = show(t); }); return e; },
        attr: (e, k, v) => {
          live(v, (x) => {
            if (x === null || x === undefined || x === false) e.removeAttribute(k);
            else e.setAttribute(k, x === true ? "" : show(x));
          });
          return e;
        },
        get_attr: (e, k) => e.getAttribute(k),
        toggle_class: (e, name, on) => {
          if (on === undefined) e.classList.toggle(name);
          else live(on, (x) => e.classList.toggle(name, truthy(x)));
          return e;
        },
        set_style: (e, prop, v) => { live(v, (x) => e.style.setProperty(prop, x == null ? "" : show(x))); return e; },
        clear: (e) => { e.replaceChildren(); return e; },
        set_visible: (e, on) => { live(on, (x) => { e.hidden = !truthy(x); }); return e; },
        value: (e) => e.value,
        set_value: (e, v) => { live(v, (x) => { e.value = x == null ? "" : show(x); }); return e; },
        // Une un campo con un estado en los dos sentidos: escribir cambia el estado y viceversa.
        bind: (e, s) => {
          if (!tng.reactive || !tng.reactive.isState(s)) throw new Error("bind necesita un state: bind(campo, state(\"\"))");
          const casilla = e.type === "checkbox" || e.type === "radio";
          const numero = e.type === "number" || e.type === "range";
          live(s, (x) => {
            if (casilla) e.checked = truthy(x);
            else { const t = x == null ? "" : show(x); if (e.value !== t) e.value = t; }
          });
          e.addEventListener(casilla || e.tagName === "SELECT" ? "change" : "input", () => {
            const v = casilla ? e.checked : numero ? (e.value === "" ? null : Number(e.value)) : e.value;
            invoke(() => tng.reactive.set(s, v));
          });
          return e;
        },
        // Vuelve a dibujar el contenido de `parent` cada vez que cambia un estado que use `f`.
        // `f` puede crear los hijos con append o devolver un elemento o una lista de elementos.
        render: (parent, f) => {
          const pintar = () => {
            parent.replaceChildren();
            const r = call(f, f && f.decl && f.decl.params.length ? [parent] : []);
            for (const x of Array.isArray(r) ? r : [r]) if (isElement(x) && x.parentNode !== parent) parent.appendChild(x);
          };
          if (tng.reactive) tng.reactive.effect(pintar); else pintar();
          return parent;
        },
        // Si el callback recibe un parámetro, le llega un mapa { type, key, value, target }
        on: (e, event, f) => {
          const wantsEvent = !!(f && f.decl && f.decl.params.length);
          e.addEventListener(event, (ev) => {
            if (!wantsEvent) return invoke(f);
            const info = Object.create(null);
            info.type = ev.type;
            info.key = ev.key === undefined ? null : ev.key;
            info.value = ev.target && "value" in ev.target ? ev.target.value : null;
            info.target = ev.target || null;
            invoke(f, [info]);
          });
          return e;
        },
        on_shortcut: (e, f) => {
          e.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); invoke(f); }
          });
          return e;
        },
        now: () => performance.now(),
        after: (ms, f) => { setTimeout(() => invoke(f), ms); return null; },
        copy: (text, button) => {
          const before = button ? button.textContent : "";
          const done = (m) => {
            if (!button) return;
            button.textContent = m;
            setTimeout(() => (button.textContent = before), 1800);
          };
          try { navigator.clipboard.writeText(show(text)).then(() => done("Copiado"), () => done("Selecciona y copia a mano")); }
          catch { done("Selecciona y copia a mano"); }
          return null;
        },
        save: (key, val) => { try { localStorage.setItem(key, show(val)); } catch { /* almacenamiento no disponible */ } return null; },
        load: (key) => { try { return localStorage.getItem(key); } catch { return null; } },
        on_route: (f) => {
          currentRoute = () => invoke(f, [decodeURIComponent(location.hash.slice(1))]);
          window.addEventListener("hashchange", currentRoute);
          currentRoute();
          return null;
        },
        go: (dest) => {
          if (location.hash.slice(1) === dest) { if (currentRoute) currentRoute(); }
          else location.hash = dest;
          return null;
        },
        scroll_top: () => { window.scrollTo(0, 0); return null; },
        scroll_to: (e) => {
          if (!e) return null;
          requestAnimationFrame(() => e.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" }));
          return null;
        },
        when_visible: (e, f) => {
          if (typeof IntersectionObserver === "undefined") return null;
          new IntersectionObserver((entries) => {
            if (entries.some((x) => x.isIntersecting)) invoke(f);
          }, { rootMargin: "-90px 0px -70% 0px" }).observe(e);
          return null;
        },
      });
    },
  };
}

export default dom;
