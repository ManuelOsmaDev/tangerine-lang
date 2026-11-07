// Plugin "reactivo": estado que avisa cuando cambia. Viene instalado en todas las instancias.
//
//   let cuenta = state(0)              un valor que se puede observar
//   cuenta.get()  cuenta.set(5)        leer y cambiar
//   cuenta.update(|n| n + 1)           cambiar a partir del valor anterior
//   let doble = computed(|| cuenta.get() * 2)   un valor que se calcula solo
//   effect(|| log(cuenta.get()))   se repite cada vez que cambia lo que lee
//
// El plugin "dom" usa esto para que el texto, las clases y los atributos se actualicen solos.

import { STATE, isState, norm } from "../valores.js";

const LIMITE = 1000;

/** Crea el plugin reactivo. */
export function reactivo() {
  return {
    name: "reactivo",
    install(tng) {
      const call = (f, args) => tng._rt.call(f, args || []);
      let actual = null; // el efecto que se está ejecutando
      const pendientes = new Set();
      let vaciando = false;

      function programar(e) {
        if (e.muerto) return;
        pendientes.add(e);
        if (vaciando) return;
        vaciando = true;
        try {
          let vueltas = 0;
          while (pendientes.size) {
            if (++vueltas > LIMITE) throw new Error("Un effect cambia un estado que él mismo lee, y se repite sin fin.");
            const lista = [...pendientes];
            pendientes.clear();
            for (const x of lista) if (!x.muerto) x.correr();
          }
        } finally {
          vaciando = false;
          pendientes.clear();
        }
      }

      function senal(inicial) {
        let valor = norm(inicial);
        const subs = new Set();
        return {
          read() {
            if (actual) { subs.add(actual); actual.deps.add(subs); }
            return valor;
          },
          peek: () => valor,
          write(v) {
            v = norm(v);
            // Las listas y mapas avisan siempre: pueden haber cambiado por dentro.
            if (v === valor && (v === null || typeof v !== "object")) return v;
            valor = v;
            for (const e of [...subs]) programar(e);
            return v;
          },
        };
      }

      function limpiar(e) {
        for (const d of e.deps) d.delete(e);
        e.deps.clear();
        for (const h of e.hijos) { h.muerto = true; limpiar(h); }
        e.hijos = [];
      }

      /** Ejecuta `fn` ahora y otra vez cada vez que cambie un estado que lea. */
      function efecto(fn) {
        const e = {
          deps: new Set(),
          hijos: [],
          muerto: false,
          correr() {
            limpiar(e);
            const antes = actual;
            actual = e;
            try { fn(); } finally { actual = antes; }
          },
        };
        if (actual) actual.hijos.push(e); // si su padre se repite, este se descarta
        e.correr();
        return e;
      }

      const nativa = (nombre, f) => ((f.tngName = nombre), f);

      function crearEstado(sig, soloLectura) {
        const s = Object.create(null);
        s.get = nativa("get", () => sig.read());
        if (!soloLectura) {
          s.set = nativa("set", (v) => sig.write(v));
          s.update = nativa("update", (f) => sig.write(call(f, [sig.peek()])));
        }
        Object.defineProperty(s, STATE, { value: sig });
        return s;
      }

      // Ayudas para otros plugins (el DOM).
      tng.reactive = {
        isState,
        effect: efecto,
        /** Un valor observable de bajo nivel: { read, write, peek }. */
        signal: senal,
        /** Detiene un efecto creado con effect. */
        dispose(e) { if (e) { e.muerto = true; limpiar(e); } },
        /** Llama a `aplicar(valor)` ahora y, si `v` es un estado, cada vez que cambie. */
        watch(v, aplicar) {
          if (isState(v)) efecto(() => aplicar(v[STATE].read()));
          else aplicar(v);
        },
        /** Lee un valor que puede ser un estado, sin observarlo. */
        peek: (v) => (isState(v) ? v[STATE].peek() : v),
        set: (s, v) => s[STATE].write(v),
      };

      tng.defineAll({
        state: (inicial) => crearEstado(senal(inicial), false),
        computed: (f) => {
          const sig = senal(null);
          efecto(() => sig.write(call(f)));
          return crearEstado(sig, true);
        },
        effect: (f) => { efecto(() => call(f)); return null; },
        is_state: (v) => isState(v),
      });
    },
  };
}

export default reactivo;
