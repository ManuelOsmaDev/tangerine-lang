<p align="center"><img src="https://raw.githubusercontent.com/ManuelOsmaDev/tangerine-lang/main/logo.svg" width="96" alt="Logo de Tangerine"></p>

# Tangerine

Tangerine es un micro framework para crear webs y apps con la sintaxis de Rust y Swift: llaves sin paréntesis, `match`, rangos, closures, clases y retorno implícito. Funciona en el navegador y en Node.js, y no tiene dependencias.

**Lo que lo hace distinto**

- **Errores que enseñan, en español.** Dicen archivo, línea y columna, muestran el rastro de llamadas y sugieren el nombre correcto: `List no tiene un método llamado 'length'. ¿Quisiste decir 'len'?`
- **Componentes de React en Tangerine.** `tangerine new app --con react` y escribe componentes con hooks en archivos `.tng`.
- **Una sola herramienta.** `tangerine` crea proyectos (propios, React, Vue, Angular, Swift…), instala herramientas, maneja paquetes y empaqueta tu web en un solo HTML.

```rust
import { formato_precio } from "./tienda.tng"

struct Canasta {
  var items = []
  fn add(fruta, kilos, precio) { self.items.push({ fruta, kilos, precio }); self }
  fn total() { self.items.fold(0, |s, x| s + x.kilos * x.precio) }
}

let canasta = Canasta().add("mandarina", 2, 3200).add("limón", 1, 2800)

for item in canasta.items {
  let etiqueta = match item.kilos {
    0 => "agotado",
    1..=2 => "poco",
    _ => "mucho",
  }
  println("{item.fruta}: {etiqueta}")
}
println("Total: {formato_precio(canasta.total())}")
```

**Web oficial, guía y playground:** https://manuelosmadev.github.io/tangerine-lang/

## Hecho con Tangerine

### Citrus

Cliente de APIs para backends serverless. Muestra en una sola pantalla la respuesta, los logs de CloudWatch, el cold start y las filas que cambió en MySQL. La interfaz de la app y su página están escritas en Tangerine.

- Página y descarga para Windows: https://manuelosmadev.github.io/citrus/
- Código: https://github.com/ManuelOsmaDev/citrus

### La web de Tangerine

El sitio oficial también está escrito en Tangerine: está en la carpeta `sitio/` de este repositorio.

- Web: https://manuelosmadev.github.io/tangerine-lang/
- Código: https://github.com/ManuelOsmaDev/tangerine-lang

## Instalar

```bash
npm install -g tangerine-lang      # el comando `tangerine` en tu terminal
npm install tangerine-lang         # como biblioteca en tu proyecto
```

Requiere Node.js 18 o más reciente.

## La terminal

| Comando | Qué hace |
| --- | --- |
| `tangerine` | Abre el REPL. Las variables se conservan y los bloques sin cerrar siguen en la línea siguiente. |
| `tangerine archivo.tng [args]` | Ejecuta un archivo. Los argumentos llegan en `args()`. |
| `tangerine check *.tng` | Revisa la sintaxis sin ejecutar. |
| `tangerine new mi-app [--con X]` | Crea un proyecto. Sin `--con` es una web en Tangerine; con `--con` usa otra plantilla (abajo). |
| `tangerine dev` | Construye, sirve en `localhost:3000` y recarga al guardar. |
| `tangerine build` | Empaqueta el proyecto en un solo `index.html`. |
| `tangerine serve [carpeta]` | Sirve archivos estáticos en `localhost:8000`. |
| `tangerine add <paquete>` | Instala un paquete de Tangerine desde npm, o desde GitHub con `usuario/repo`. |
| `tangerine remove <paquete>`, `tangerine buscar [texto]` | Desinstala o busca paquetes. |
| `tangerine install <herramienta>` | Instala `node`, `git`, `swift`, `python`, `angular`, `typescript`, `vscode`, `deno`, `bun`, `pnpm`, `yarn`… con winget, Homebrew o npm. Pregunta antes de ejecutar. |
| `tangerine doctor` | Muestra qué herramientas tienes instaladas y qué falta. |
| `tangerine vscode` | Instala la extensión de Tangerine en VS Code (colores y fragmentos). |

Opciones: `--limite <n>` (máximo de pasos), `-p <puerto>`, `-o <salida>`, `--entrada <archivo>`, `--cdn`, `--con <plantilla>`, `--sin-tangerine`, `--si` (no preguntar), `--forzar`, `--dev`.

### Plantillas de `tangerine new --con`

| Plantilla | Qué crea |
| --- | --- |
| `web` | Página 100% en Tangerine (por defecto). |
| `react` | React + Vite con componentes escritos en Tangerine. |
| `consola` | Programa de terminal. |
| `paquete` | Paquete de Tangerine listo para publicar en npm. |
| `vue`, `svelte`, `vite` | Proyecto oficial de Vite, con el plugin de Tangerine ya agregado (`--sin-tangerine` para omitirlo). |
| `angular`, `next`, `astro`, `expo` | Proyecto creado con el CLI oficial de cada framework. |
| `swift`, `flutter` | Proyecto con `swift package init` o `flutter create` (necesitan Swift o Flutter instalados). |

Los errores dicen dónde está el problema:

```
error: app.tng, línea 2, columna 1: Se esperaba ']' pero se encontró 'println'
  2 │ println(x)
    │ ^
```

Fuera del navegador hay funciones para trabajar con el sistema: `read_file`, `write_file`, `file_exists`, `list_dir`, `args()`, `env(nombre)` y `exit(código)`.

## Estado reactivo

Guarda los datos de tu página en un `state`. Cuando el estado cambia, todo lo que lo muestra se actualiza solo: no hay que borrar ni volver a pintar nada a mano.

```rust
let cuenta = state(0)
append(query("#app"), el("p", nil, cuenta))     // muestra 0, luego 1, 2...

let boton = append(query("#app"), el("button", nil, "Sumar"))
on(boton, "click", || cuenta.update(|n| n + 1))
```

Son cinco ideas:

| Qué | Para qué |
| --- | --- |
| `state(valor)` | Guarda un dato. Se lee con `.get()` y se cambia con `.set(nuevo)` o `.update(\|v\| ...)`. |
| `computed(\|\| ...)` | Un dato que se calcula a partir de otros y se recalcula solo: `computed(\|\| precio.get() * cantidad.get())`. |
| `effect(\|\| ...)` | Código que se repite cada vez que cambia un estado que usa: `effect(\|\| save("tema", tema.get()))`. |
| `bind(campo, estado)` | Une un `input`, `select` o casilla con un estado en los dos sentidos. |
| `render(contenedor, \|\| ...)` | Vuelve a dibujar una parte de la página, por ejemplo una lista: `render(ul, \|\| tareas.get().map(\|t\| el("li", nil, t)))`. |

Las funciones de la página aceptan un estado donde antes iba un valor, y lo siguen: `el`, `set_text`, `attr`, `toggle_class`, `set_style`, `set_visible` y `set_value`. Un estado también se puede escribir dentro de un texto: `"Hola, {nombre}"`.

Una lista de tareas completa:

```rust
let tareas = state([])
let nueva = state("")
let app = query("#app")

let campo = append(app, el("input", nil, nil))
bind(campo, nueva)
on(campo, "keydown", |e| {
  if e.key == "Enter" && nueva.get() != "" {
    tareas.update(|l| { l.push(nueva.get()); l })
    nueva.set("")
  }
})

append(app, el("p", nil, computed(|| "{tareas.get().len()} tareas")))
render(append(app, el("ul", nil, nil)), || tareas.get().map(|t| el("li", nil, t)))
```

## Proyectos web

```bash
tangerine new mi-app
cd mi-app
npm install
npm run dev
```

La configuración vive en `tangerine.json`:

```json
{
  "entry": "src/main.tng",
  "out": "dist/index.html",
  "title": "Mi app",
  "styles": ["src/estilos.css"],
  "scripts": []
}
```

| Clave | Qué hace |
| --- | --- |
| `entry` | Archivo de entrada. Sus `import` se siguen solos. |
| `out` | Dónde escribir el HTML. |
| `title`, `lang`, `head`, `body` | Título, idioma, HTML extra en `<head>` y el contenido inicial de `<body>` (por defecto `<div id="app"></div>`). |
| `styles` | Hojas de estilo que se incluyen en el HTML. |
| `scripts` | Archivos JavaScript que se incluyen, por ejemplo plugins propios. |
| `runtime` | `"inline"` (por defecto) incluye el intérprete; `"cdn"` lo carga de jsDelivr. |

## Paquetes

```bash
tangerine add colores           # desde npm
tangerine add manu/colores      # desde GitHub
```

```rust
import { NARANJA, mezclar } from "colores"
import paleta from "colores/paleta"
```

Un paquete es una carpeta con `package.json` y un archivo de entrada `.tng`, indicado en el campo `"tangerine"` (o `index.tng`). Crea uno con `tangerine new mi-paquete --con paquete` y publícalo con `npm publish`. `tangerine build` incluye los paquetes en el HTML final.

## React y Vite

```bash
tangerine new mi-app --con react
```

```rust
// src/Contador.tng
export fn Contador(props) {
  let (n, set_n) = use_state(props.inicio ?? 0)
  h("button", { class: "boton", on_click: || set_n(|x| x + 1) }, "Clics: {n}")
}
```

```jsx
// src/main.jsx
import { Contador } from "./Contador.tng";
<Contador inicio={5} />
```

Funciones disponibles: `h(etiqueta, props, ...hijos)`, `fragment(...)`, `use_state`, `use_effect`, `use_memo`, `use_ref`. Los eventos van en `on_click`, `on_change`, `on_submit`… y reciben un mapa con `value`, `key`, `checked`, `prevent()` y `stop()`. `class` se convierte en `className` y `style` acepta un mapa.

En cualquier proyecto de Vite basta con el plugin:

```js
// vite.config.js
import tangerine from "tangerine-lang/vite";
export default { plugins: [tangerine()] };
```

Sin Vite, el plugin de React se usa a mano: `new Tangerine({ plugins: [react(React)] })` con `import { react, wrapExport } from "tangerine-lang/react"`.

## En una página, sin instalar nada

```html
<div id="app"></div>
<script src="https://cdn.jsdelivr.net/npm/tangerine-lang@3.1.0/dist/tangerine.global.min.js"></script>
<script type="text/tangerine">
  let titulo = append(query("#app"), el("h1", nil, "Hola"))
  let campo = append(query("#app"), el("input"))
  on(campo, "input", |e| set_text(titulo, "Hola, {e.value}"))
</script>
```

Al cargar la página se ejecutan los `<script type="text/tangerine">` en orden:

- con `data-module="util.tng"` se registran como módulo para importarlos;
- con `src="main.tng"` se descargan, junto con sus imports (necesita un servidor, por ejemplo `tangerine serve`);
- sin atributos se ejecutan tal cual.

Para arrancar a mano agrega `data-manual` al script del intérprete y llama a `Tangerine.start()`.

## Como biblioteca

```js
import { Tangerine } from "tangerine-lang";

const tng = new Tangerine({
  output: (linea) => console.log(linea),
  stepLimit: 100_000,                       // corta ciclos infinitos
  natives: { doble: (x) => x * 2 },         // funciones de JavaScript visibles en Tangerine
  modules: { "mate.tng": "export let IVA = 0.19" },
});

tng.run('import { IVA } from "./mate"\nprintln(doble(21), IVA)');   // 42 0.19

const { output, error } = tng.runCode("println(1 / 0)");
// output: [], error: "Línea 1: División entre cero"
```

Cada instancia es independiente: tiene su propia salida, sus funciones y su caché de módulos.

| Método | Qué hace |
| --- | --- |
| `run(código, { file })` | Ejecuta y devuelve el valor de la última instrucción. Lanza `TngError` si falla. |
| `runCode(código)` | Ejecuta sin lanzar y devuelve `{ output, error }`. |
| `runModule(ruta)` | Ejecuta un módulo registrado o que `read` pueda leer. |
| `define(nombre, valor)`, `defineAll(objeto)` | Agrega funciones o valores globales. |
| `use(plugin)` | Instala un plugin. |
| `addModule(ruta, código)` | Registra un módulo en memoria. |
| `session()` | Crea una sesión cuyas variables persisten (para un REPL). |
| `call(fn, args)`, `invoke(fn, args)` | Llama a una función de Tangerine. `invoke` envía los errores a `onError` en vez de lanzarlos. |
| `message(error)` | Texto en español del error, con archivo, línea y columna. |
| `trace(error)` | Rastro de llamadas del error, de la más interna a la más externa. |
| `import(ruta)`, `forget(ruta)` | Carga un módulo y devuelve sus exports, u olvida uno ya cargado. |

Opciones del constructor: `output`, `stepLimit`, `natives`, `plugins`, `modules`, `imports` (mapa de paquetes), `resolve`, `read`, `onError`, `globalPlugins`.

En Node.js, `tangerine-lang/node` lee los imports del disco:

```js
import { runFile, createNodeTangerine } from "tangerine-lang/node";

runFile("src/main.tng", { args: ["Ana"] });
```

### Plugins

Un plugin agrega funciones nativas. Puede ser una función o un objeto con `install`:

```js
const reloj = {
  name: "reloj",
  install(tng) {
    tng.defineAll({
      hora: () => new Date().toLocaleTimeString("es"),
      cada: (ms, f) => { setInterval(() => tng.invoke(f), ms); return null; },
    });
  },
};

new Tangerine({ plugins: [reloj] });
Tangerine.registerPlugin(reloj); // para todas las instancias que se creen después
```

Los valores viajan así: los números, strings, booleanos y listas son los de JavaScript, `nil` es `null` y los mapas son objetos sin prototipo. `Tangerine.fromJS` y `Tangerine.toJS` convierten objetos completos.

## La sintaxis en un vistazo

| Tema | Ejemplo |
| --- | --- |
| Variables | `let fijo = 1`, `var cambia = 2`, `let (a, b) = (1, 2)` |
| Strings | `"Hola, {nombre}"`, `'sin interpolar'` |
| Control | `if x > 0 { "pos" } else { "neg" }` devuelve un valor |
| Match | `match n { 0 => "cero", 1..=9 => "dígito", x if x < 0 => "neg", _ => "otro" }` |
| Bucles | `for (i, x) in lista.enumerate() { }`, `while c { }`, `loop { break }` |
| Funciones | `fn area(r: Float) -> Float { PI * r ** 2 }`, `fn saludar(n, s = "Hola") { }`, `\|x\| x * 2` |
| Clases | `class Hija : Madre { init(x) { self.x = x } }`, `super.metodo()` |
| Nil seguro | `usuario?.direccion?.ciudad ?? "sin ciudad"` |
| Errores | `do { throw "falló" } catch e { println(e.message) }` |
| Módulos | `export fn f() {}`, `import { f as g } from "./util"`, `import util from "./util"` |

La guía completa, con ejemplos que se ejecutan en el navegador, está en el sitio (`sitio/`).

## Desarrollo

```bash
npm install
npm test           # construye dist/ y corre las pruebas
npm run lint
npm run sitio      # construye la web oficial en sitio/dist/index.html
npm run sitio:dev  # la web con recarga automática en localhost:3000
npm run vscode     # reempaqueta la extensión de VS Code
```

| Carpeta | Contenido |
| --- | --- |
| `src/lexer.js` | Texto a tokens. |
| `src/parser.js` | Tokens a árbol de sintaxis. |
| `src/interprete.js` | Recorre el árbol y lo ejecuta; métodos incorporados y módulos. |
| `src/valores.js` | Ámbitos, funciones, clases y utilidades de valores. |
| `src/index.js` | La clase `Tangerine` (API pública). |
| `src/plugins/dom.js` | Funciones del navegador. |
| `src/navegador.js` | Bundle global y arranque automático en la página. |
| `src/sugerencias.js` | El "¿Quisiste decir…?" de los errores. |
| `src/plugins/react.js`, `src/vite.js` | Componentes de React en Tangerine y el plugin de Vite. |
| `src/node.js`, `src/construir.js`, `src/herramientas.js`, `bin/` | Node.js, paquetes, empaquetado, plantillas, instalador y CLI. |
| `sitio/` | La web oficial, escrita en Tangerine. Se publica en GitHub Pages con `.github/workflows/sitio.yml`. |
| `plantillas/` | Lo que copia `tangerine new`. |
| `editores/vscode/` | La extensión de VS Code. |

### Publicar una versión

1. Sube la versión en `package.json` y en `VERSION` de `src/index.js` (una prueba verifica que coincidan) y anota los cambios en `CHANGELOG.md`.
2. `npm login` y luego `npm publish`. `prepublishOnly` corre el lint, las pruebas y construye `dist/`.
3. O crea un release en GitHub: el flujo `publicar.yml` publica con el secreto `NPM_TOKEN`.

## Licencia

MIT
