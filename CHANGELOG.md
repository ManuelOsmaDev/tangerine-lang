# Cambios

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
