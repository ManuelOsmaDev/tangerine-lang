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

      tng.defineAll({
        query: (sel) => document.querySelector(sel),
        query_all: (sel) => Array.from(document.querySelectorAll(sel)),
        el: (tag, cls, text) => {
          const e = document.createElement(tag);
          if (cls) e.className = cls;
          if (tag === "button") e.type = "button";
          if (text !== null && text !== undefined) e.textContent = show(text);
          return e;
        },
        append: (parent, child) => { parent.appendChild(child); return child; },
        remove: (e) => { if (e) e.remove(); return null; },
        add_text: (e, s) => { e.appendChild(document.createTextNode(show(s))); return e; },
        set_text: (e, s) => { e.textContent = show(s); return e; },
        attr: (e, k, v) => {
          if (v === null || v === undefined) e.removeAttribute(k);
          else e.setAttribute(k, show(v));
          return e;
        },
        get_attr: (e, k) => e.getAttribute(k),
        toggle_class: (e, name, on) => { e.classList.toggle(name, on === undefined ? undefined : truthy(on)); return e; },
        set_style: (e, prop, v) => { e.style.setProperty(prop, v == null ? "" : show(v)); return e; },
        clear: (e) => { e.replaceChildren(); return e; },
        set_visible: (e, on) => { e.hidden = !truthy(on); return e; },
        value: (e) => e.value,
        set_value: (e, v) => { e.value = show(v); return e; },
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
