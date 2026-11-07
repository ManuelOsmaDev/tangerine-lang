// Plugin "sitio": funciones nativas que solo usa la web oficial.
// Se registra antes de que arranque el programa; el plugin "dom" ya viene en el intérprete.
(function () {
  "use strict";
  const T = window.Tangerine;

  // Resaltado de sintaxis
  const RE = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\d[\d_]*(?:\.\d+)?)|([A-Za-z\u00C0-\u024F_][A-Za-z0-9\u00C0-\u024F_]*)/g;
  function paint(e, src, names) {
    e.replaceChildren();
    const frag = document.createDocumentFragment();
    const text = (t) => frag.appendChild(document.createTextNode(t));
    const span = (c, t) => {
      const s = document.createElement("span");
      s.className = c;
      s.textContent = t;
      frag.appendChild(s);
    };
    let last = 0, m;
    RE.lastIndex = 0;
    while ((m = RE.exec(src))) {
      if (m.index > last) text(src.slice(last, m.index));
      const t = m[0];
      if (m[1]) span("tk-com", t);
      else if (m[2]) span("tk-str", t);
      else if (m[3]) span("tk-num", t);
      else if (T.KEYWORDS.has(t)) span("tk-kw", t);
      else if (names.has(t)) span("tk-nat", t);
      else if (/^[A-Z]/.test(t)) span("tk-tipo", t);
      else if (src[RE.lastIndex] === "(") span("tk-fn", t);
      else text(t);
      last = RE.lastIndex;
    }
    if (last < src.length) text(src.slice(last));
    e.appendChild(frag);
  }

  const modules = () => Array.from(document.querySelectorAll('script[type="text/tangerine"][data-module]'));

  T.registerPlugin({
    name: "sitio",
    install(tng) {
      let names = null;
      tng.defineAll({
        highlight: (e, src) => {
          names = names || new Set(tng.globals());
          paint(e, String(src), names);
          return e;
        },
        // El playground corre en una instancia aparte, sin acceso a la página
        run: (src) => new T({ stepLimit: 400000, globalPlugins: false }).runCode(String(src)),
        tokens: (src) => T.lexer(String(src)).filter((t) => t.type !== "eof").map((t) =>
          t.type === "num" ? "num " + t.value :
          t.type === "str" ? JSON.stringify(t.value) :
          t.type === "template" ? "template" :
          t.type === "id" ? "id " + t.value : t.type),
        tree: (src) => T.parse(String(src)).map(T.sx).join("\n"),
        source: () => modules()
          .map((s) => `// ── ${s.dataset.module.replace(/^src\//, "")} ${"─".repeat(Math.max(3, 40 - s.dataset.module.length))}\n\n${s.textContent.trim()}`)
          .join("\n\n"),
        module_count: () => modules().length,
        engine_kb: () => {
          const r = document.getElementById("tangerine-runtime");
          return r ? Math.round(r.textContent.length / 1024) : null;
        },
        version: () => T.VERSION,
      });
    },
  });
})();
