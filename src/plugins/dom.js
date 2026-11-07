// Plugin "dom": conecta Tangerine con el navegador.
// Uso: new Tangerine({ plugins: [dom()] })  (en el bundle del navegador ya viene instalado)

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

      tng.defineAll({
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
