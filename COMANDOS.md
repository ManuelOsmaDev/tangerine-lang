# Comandos de Tangerine

## 0. Activar el comando `tangerine` (antes de publicar en npm)

Dentro de la carpeta `tangerine-lang`:

```bash
npm install      # dependencias para pruebas y build
npm run build    # genera dist/
npm link         # crea el comando global `tangerine` apuntando a esta carpeta
tangerine --version
```

Para quitarlo: `npm unlink -g tangerine-lang`. Cuando ya esté publicado: `npm install -g tangerine-lang`.

## 1. Programar

| Comando | Qué hace |
| --- | --- |
| `tangerine` | Abre el REPL. `.ayuda`, `.limpiar`, `.salir` |
| `tangerine archivo.tng` | Ejecuta un archivo |
| `tangerine archivo.tng uno dos` | Ejecuta con argumentos (llegan en `args()`) |
| `tangerine run archivo.tng` | Igual que el anterior |
| `tangerine archivo.tng --limite 100000` | Corta el programa si pasa de 100 000 pasos |
| `tangerine check src/*.tng` | Revisa la sintaxis sin ejecutar |

## 2. Proyectos

| Comando | Qué hace |
| --- | --- |
| `tangerine new mi-app` | Web 100% en Tangerine |
| `tangerine new --lista` | Muestra todas las plantillas |
| `tangerine new mi-app --con react` | React + Vite con componentes en `.tng` |
| `tangerine new mi-app --con consola` | Programa de terminal |
| `tangerine new mi-paquete --con paquete` | Paquete para publicar en npm |
| `tangerine new mi-app --con vue` | Vue (oficial) + soporte `.tng` |
| `tangerine new mi-app --con svelte` | Svelte (oficial) + soporte `.tng` |
| `tangerine new mi-app --con vite` | Vite con JS puro + soporte `.tng` |
| `tangerine new mi-app --con vue --sin-tangerine` | Vue sin agregar Tangerine |
| `tangerine new mi-app --con angular` | Angular (CLI oficial) |
| `tangerine new mi-app --con next` | Next.js |
| `tangerine new mi-app --con astro` | Astro |
| `tangerine new mi-app --con expo` | React Native con Expo |
| `tangerine new mi-app --con swift` | Programa de Swift (necesita Swift) |
| `tangerine new mi-app --con flutter` | App de Flutter (necesita Flutter) |

Dentro de un proyecto web de Tangerine (el que tiene `tangerine.json`):

| Comando | Qué hace |
| --- | --- |
| `tangerine dev` | Construye, sirve en http://localhost:3000 y recarga al guardar |
| `tangerine dev -p 4000` | Lo mismo en otro puerto |
| `tangerine build` | Genera `dist/index.html` (un solo archivo) |
| `tangerine build -o publico/index.html` | Elige el archivo de salida |
| `tangerine build --entrada src/otra.tng` | Elige el archivo de entrada |
| `tangerine build --cdn` | No incluye el intérprete; lo carga de jsDelivr |
| `tangerine serve` | Sirve la carpeta actual en http://localhost:8000 |
| `tangerine serve dist -p 9000` | Sirve otra carpeta en otro puerto |

## 3. Paquetes de Tangerine

| Comando | Qué hace |
| --- | --- |
| `tangerine add colores` | Instala un paquete de npm |
| `tangerine add usuario/repo` | Instala desde GitHub |
| `tangerine add ../mi-paquete` | Instala desde una carpeta local |
| `tangerine add colores --dev` | Como dependencia de desarrollo |
| `tangerine remove colores` | Lo desinstala |
| `tangerine buscar texto` | Busca paquetes de Tangerine en npm |

En el código: `import { algo } from "colores"`.

## 4. Herramientas del PC

| Comando | Qué hace |
| --- | --- |
| `tangerine doctor` | Qué tienes instalado y qué falta |
| `tangerine install --lista` | Todo lo que puede instalar |
| `tangerine install node` | Node.js LTS |
| `tangerine install git` | Git |
| `tangerine install swift` | Swift |
| `tangerine install python` | Python 3 |
| `tangerine install angular` | Angular CLI |
| `tangerine install typescript` | TypeScript |
| `tangerine install vscode` | Visual Studio Code |
| `tangerine install deno` / `bun` / `pnpm` / `yarn` | Otros entornos y gestores |
| `tangerine install git python --si` | Varias a la vez, sin preguntar |
| `tangerine install node --forzar` | Reinstala aunque ya exista |
| `tangerine vscode` | Instala la extensión de Tangerine en VS Code |

`install` siempre muestra el comando y pregunta antes de ejecutarlo, salvo con `--si`.

## 5. Ayuda

| Comando | Qué hace |
| --- | --- |
| `tangerine --ayuda` | Ayuda completa |
| `tangerine --version` | Versión |

## 6. Para desarrollar Tangerine (dentro de `tangerine-lang`)

| Comando | Qué hace |
| --- | --- |
| `npm test` | Construye y corre las pruebas |
| `npm run lint` | Revisa el estilo del código |
| `npm run build` | Genera `dist/` |
| `npm run sitio` | Construye la web oficial en `sitio/dist/index.html` |
| `npm run sitio:dev` | La web con recarga en http://localhost:3000 |
| `npm run vscode` | Reempaqueta la extensión de VS Code |
| `npm publish` | Publica en npm (antes: `npm login`) |

## Prueba rápida (en orden)

```bash
tangerine doctor
tangerine new prueba-web
cd prueba-web
tangerine dev
```

```bash
tangerine new prueba-cli --con consola
cd prueba-cli
tangerine src/main.tng README.md
```

```bash
tangerine new prueba-react --con react
cd prueba-react
npm install -D ../tangerine-lang
npm run dev
```

Hasta publicar en npm, los proyectos `react`, `web`, `consola` y `paquete` no encuentran `tangerine-lang` con un `npm install` normal. Instálalo desde tu carpeta con `npm install -D <ruta a tangerine-lang>` (arriba, `../tangerine-lang` si creas el proyecto junto a ella). Eso también instala lo demás.
