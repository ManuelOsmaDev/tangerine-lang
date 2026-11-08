# Cambios

## 5.2.0

- **Componentes con contenido, como en SwiftUI**: `Card("Título", .destacada) { p { "hola" } }`. El bloque llega al componente como `children`, y `.nombre` en los argumentos llega como el texto `"nombre"`.
- **`{ ref: |el| ... }`** recibe el elemento real cuando ya está en la página.
- **`{ raw: true }`** deja que otro código maneje lo que hay dentro de un elemento (un gráfico, un editor) sin que el view lo borre al redibujar.
- Base de [Tangerine UI](https://manuelosmadev.github.io/tangerine-ui/), la librería de componentes.

## 5.1.0

- **`async fn` y `await`**: funciones, métodos y closures que esperan sin congelar la página. `await` va al inicio de la línea (`let x = await f()`), también dentro de `if`, `for`, `while` y `do/catch`.
- **`fetch_json` y `fetch_text`** para pedir datos a una API, con `method`, `headers` y `body`. Un error HTTP se atrapa con `do/catch`.
- **`sleep(ms)`** para esperar.
- **Ciclo de vida**: `on_mount()` al aparecer un componente y `on_destroy()` al quitarse. Pueden ser `async`.
- **Listas con `key`**: `li({ key: u.id })` conserva cada fila al reordenar, sin perder lo escrito en sus inputs.
- `async` y `await` pasan a ser palabras reservadas.

## 5.0.0

- **`log` y `write` reemplazan a `println` y `print`.** `log(...)` escribe y termina la línea; `write(...)` escribe sin terminarla. Si usas el nombre viejo, el error te dice cuál usar: `No existe 'println' en este ámbito. ¿Quisiste decir 'log'?`
- Para actualizar un proyecto, cambia `println(` por `log(` y `print(` por `write(`.

## 4.0.0

### Nuevo
- **Componentes al estilo Swift y Angular**: `struct` con `view { }`, `@State`, `@Input`, `@Output` y `@Component("mi-etiqueta")`. Dentro del view, `div(.clase) { }`, `button("+") { acción }`, `if`, `for`, atributos y eventos con `on_click`.
- **Web Components**: cada `@Component` se registra como etiqueta HTML y funciona en Angular, React, Vue, Svelte o HTML (micro-frontends).
- `tangerine build --componentes` genera `dist/componentes.js` con el intérprete y tus componentes.
- Plantilla `tangerine new --con componentes`, con ejemplos para Angular, React y Vue.
- `$campo` une un input con un `@State` en los dos sentidos, sin perder el foco.
- `mount("#app", App)` dibuja un componente en la página; `render_html(App())` da su HTML.
- Dentro de un struct, los campos y métodos se usan sin `self.`, como en Swift.

### Cambia
- La plantilla web usa componentes.
- Un campo de un struct ahora tapa a una variable global con el mismo nombre dentro de sus métodos. Si dependías de eso, usa otro nombre.

## 3.2.0

- **Estado reactivo**: `state`, `computed` y `effect`. Cuando un estado cambia, lo que depende de él se actualiza solo.
- Las funciones de la página (`el`, `set_text`, `attr`, `toggle_class`, `set_style`, `set_visible`, `set_value`) aceptan un estado y lo siguen.
- `bind(campo, estado)` une un campo de formulario con un estado en los dos sentidos.
- `render(contenedor, f)` vuelve a dibujar una parte de la página cuando cambia lo que usa.
- Un estado se puede mostrar o interpolar directamente: `"Hola, {nombre}"`.
- La plantilla web usa estado reactivo y cabe en un solo archivo.

## 3.1.1

- Logo nuevo: la naranja con el `>`, en el README, la web, el favicon y VS Code.
- Tangerine se presenta como micro framework.
- El README enlaza la web oficial y proyectos hechos con Tangerine, como Citrus.
- `package.json` incluye `homepage`, `repository` y `bugs`, para que npm muestre esos enlaces.

## 3.1.0

### Nuevo
- **Errores que enseñan**: sugerencias "¿Quisiste decir…?" para variables, campos y métodos (también para nombres de otros lenguajes como `length`, `null` o `toUpperCase`), y rastro de llamadas con archivo y línea.
- **Parámetros por defecto**: `fn saludar(nombre, saludo = "Hola")`, también en closures.
- **Paquetes**: `tangerine add` (npm o GitHub `usuario/repo`), `remove` y `buscar`. Los imports sin `./` buscan en `node_modules`; `build` genera un mapa de paquetes para el navegador.
- **Plantillas**: `tangerine new --con` react, vue, svelte, vite, angular, next, astro, expo, swift, flutter, consola y paquete.
- **Instalador de herramientas**: `tangerine install` (node, git, swift, python, angular, typescript, vscode, deno, bun, pnpm, yarn) con winget, Homebrew o npm, y `tangerine doctor`.
- **React en Tangerine**: plugin `tangerine-lang/react` (`h`, `fragment`, `use_state`, `use_effect`, `use_memo`, `use_ref`) y plugin de Vite `tangerine-lang/vite` para importar `.tng` desde JavaScript.
- **Extensión de VS Code** con colores de sintaxis y fragmentos; se instala con `tangerine vscode`.
- **Módulos**: `export` para `let`, `var`, `fn`, `class` y `struct`; `import { a, b as c } from "./x.tng"` e `import x from "./x"`. Cada módulo se ejecuta una vez y las importaciones circulares se detectan.
- **Paquete de npm** `tangerine-lang` con builds ESM, CommonJS y un bundle global para el navegador, más tipos de TypeScript.
- **CLI** `tangerine`: REPL multilínea, `run`, `check`, `new`, `build`, `dev` con recarga automática y `serve`.
- **Instancias independientes**: `new Tangerine({ output, stepLimit, natives, plugins, modules })`. Ya no hay estado global, así que varios programas pueden convivir.
- **Plugins**: `tng.use(plugin)` y `Tangerine.registerPlugin(plugin)`. Las funciones del navegador ahora son el plugin `dom`.
- **Arranque automático en el navegador**: ejecuta `<script type="text/tangerine">`, registra módulos con `data-module` y descarga archivos con `src`.
- Plugin `sistema` para Node.js: `read_file`, `write_file`, `file_exists`, `list_dir`, `args`, `env`, `exit`.
- Funciones `to_json` y `from_json`.
- Nuevas funciones del DOM: `query_all`, `remove`, `get_attr`, `set_style`, `after`. Los callbacks de `on` con un parámetro reciben `{ type, key, value, target }`.

### Cambios
- Todos los mensajes de error están en español e indican archivo, línea y, en errores de sintaxis, columna.
- `==` compara mapas por su contenido, igual que las listas.
- El límite de pasos es configurable; por defecto no hay límite (el playground usa 400 000).
- Los identificadores aceptan más letras latinas (`ñ`, `ő`, etc.).
- `sorted_by_key` calcula cada clave una sola vez y `unique` es lineal para valores simples.

### Internos
- El intérprete se dividió en `lexer`, `parser`, `valores` e `interprete`.
- La web oficial se dividió en seis módulos de Tangerine y se construye con `tangerine build`.
- Pruebas con Vitest, ESLint y CI en Linux y Windows con Node 18, 20 y 22.
- La web oficial se publica en GitHub Pages en cada push a `main`.

## 3.0.0

- `match` con rangos, alternativas y guardas; closures al estilo de Rust; clases con `init`, `self` y `super`.
