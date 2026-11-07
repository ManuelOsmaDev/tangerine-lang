# Tangerine: referencia completa para agentes

> Documento de referencia para un agente (IA o persona) que va a escribir código en Tangerine o usar la librería `tangerine-lang`.
> Todo lo que aparece aquí está verificado contra la versión **3.1.0** publicada en npm.

---

## 1. Qué es

- **Tangerine** es un lenguaje de programación interpretado, pequeño, con sintaxis inspirada en Rust y Swift.
- Corre en **Node.js 18+** y en el **navegador**. El intérprete está escrito en JavaScript y no tiene dependencias.
- Archivos: extensión **`.tng`**, codificación UTF-8.
- Paquete npm: **`tangerine-lang`**. Comando de terminal: **`tangerine`**.
- Los mensajes de error están en **español**, con archivo, línea, columna (en errores de sintaxis), rastro de llamadas y sugerencias "¿Quisiste decir…?".
- Las palabras clave y las funciones incluidas están en **inglés** (`let`, `fn`, `println`, `len`…).

```bash
npm install -g tangerine-lang   # comando global `tangerine`
npm install tangerine-lang      # como librería en un proyecto
```

---

## 2. Reglas que más confunden (leer primero)

1. **Solo `nil` y `false` son falsos.** `0`, `""` y `[]` son verdaderos. Para listas o strings vacíos usa `.is_empty()`.
2. **Los strings con comillas dobles interpolan `{...}`.** `"Hola {nombre}"`. Para escribir una llave literal usa comillas simples `'{literal}'` o escápala `"\{"`. Un string `"..."` que contenga JSON con llaves se rompe: usa `'...'`.
3. **`/` siempre es división real:** `7 / 2` es `3.5`. Para división entera: `(7 / 2).floor()` o `.to_int()`.
4. **No hay `new`.** Se crea una instancia llamando a la clase: `Persona("Ana")`.
5. **La última expresión es el valor de retorno** de funciones, bloques `if` y `match`. `return` solo hace falta para salir antes, y su valor debe ir **en la misma línea**.
6. **`let` es constante y exige valor.** Usa `var` si vas a reasignar.
7. **`(` de una llamada y `[` de un índice deben ir en la misma línea** que lo que se llama o indexa. Una línea que empieza con `(`, `[`, `-` o `||` empieza una instrucción nueva.
8. **`{` al inicio de una expresión es un mapa**, no un bloque: `{ a: 1 }`. No existen bloques sueltos.
9. **Acceder a una clave que no existe en un mapa da `nil`**, no error. Si una clave se llama igual que un método del mapa (`keys`, `len`…), la clave gana.
10. **Los rangos son listas reales:** `0..5` es `[0, 1, 2, 3, 4]`, con un máximo de 1 000 000 elementos.
11. **Los índices negativos cuentan desde el final** (`lista[-1]`). Un índice fuera de rango da `nil`.
12. **`==` compara listas y mapas por contenido**; las instancias de clases, por identidad.
13. Los punto y coma son opcionales. Comentarios: `//` y `/* ... */`.
14. Las anotaciones de tipo (`x: Int`, `-> String`) se aceptan pero **no se comprueban**.
15. `push`, `insert`, `pop` y `remove` **modifican** la lista. `sorted`, `reversed`, `map`, `filter`… devuelven una lista **nueva**.

---

## 3. El lenguaje

### 3.1 Valores y tipos

| Tipo (`type_of`) | Ejemplos | Notas |
| --- | --- | --- |
| `Int` | `42`, `1_000_000`, `2.0` | Los números sin parte decimal son `Int`. |
| `Float` | `3.14`, `7 / 2` | Se muestran redondeados a 10 decimales: `0.1 + 0.2` imprime `0.3`. |
| `String` | `"hola {x}"`, `'sin interpolar'` | Escapes: `\n`, `\t`, `\r`, `\0`, `\\`, `\"`, `\'`, `\{`. |
| `Bool` | `true`, `false` | |
| `Nil` | `nil` | Ausencia de valor. |
| `List` | `[1, 2, 3]`, `(1, "dos")`, `0..5` | `(a, b)` con coma también crea una lista. |
| `Map` | `{ nombre: "Ana", edad: 30 }` | Claves siempre string. `{ nombre }` equivale a `{ nombre: nombre }`. |
| `Fn` | `fn f() {}`, `\|x\| x * 2` | |
| `Class` | `class Fruta {}` | |
| nombre de la clase | `Fruta()` | Las instancias tienen como tipo el nombre de su clase. |
| `Element` | nodos del DOM, eventos, objetos de JS | Valores externos que vienen de funciones nativas. |

### 3.2 Variables

```rust
let nombre = "Tangerine"      // constante
var cuenta: Int = 3           // variable (anotación opcional)
cuenta += 2                   // también -=, *=, /=
let (x, y) = (10, 20)         // desarmar una lista
var pendiente                 // var sin valor vale nil
```

### 3.3 Operadores (de menor a mayor precedencia)

| Operadores | Notas |
| --- | --- |
| `??` | `a ?? b`: `b` si `a` es `nil`. |
| `\|\|` | O lógico, devuelve el primer valor verdadero. |
| `&&` | Y lógico. |
| `==` `!=` | Comparación profunda para listas y mapas. |
| `<` `>` `<=` `>=` | Solo números con números o strings con strings. |
| `..` `..=` | Rango exclusivo o inclusivo (crea una lista). |
| `+` `-` | `+` también concatena strings (convierte el otro lado a texto) y listas. |
| `*` `/` `%` | `"ab" * 3` repite el string. Dividir o sacar resto entre 0 da error. |
| `**` | Potencia, asociativa a la derecha. |
| `-x` `!x` | Unarios. |
| `.` `?.` `()` `[]` | Miembro, miembro opcional (`nil?.x` da `nil`), llamada, índice. |

### 3.4 Strings con interpolación

```rust
let fruta = "mandarina"
println("Compré {2 + 1} kg de {fruta.upper()}")
println('Literal: {fruta}')
println("Llave literal: \{")
```

Dentro de `{...}` va cualquier expresión, incluso con strings: `"{x ?? "nada"}"`.

### 3.5 Control de flujo

```rust
// if es una expresión
let bebida = if temperatura > 25 { "limonada" } else if temperatura > 15 { "agua" } else { "té" }

// match: literales, rangos, alternativas, guardas, comodín y captura
let nota = match puntaje {
  90..=100 => "A",
  80..90 => "B",
  0 | 1 => "casi cero",
  n if n < 0 => "inválido {n}",
  _ => "F",
}
// Si ningún caso coincide, es un error: termina siempre con _ =>.
// Un caso puede tener un bloque: x => { println(x); x * 2 }
```

Patrones de `match`: números (también negativos), strings, `true`, `false`, `nil`, rangos `a..b` y `a..=b`, `_`, un nombre (captura el valor), varios unidos con `|` y una guarda `if condición`. **No** hay desarmado de listas ni mapas en los patrones.

### 3.6 Ciclos

```rust
for x in [1, 2, 3] { }
for i in 0..10 { }                          // 0 a 9
for (i, x) in lista.enumerate() { }
for (clave, valor) in { a: 1, b: 2 } { }     // un mapa da pares [clave, valor]
for letra in "hola" { }                     // un string da sus caracteres
while condicion { }
loop {
  if listo { break }
  continue
}
```

### 3.7 Funciones y closures

```rust
fn cuadrado(x: Int) -> Int {
  x * x                              // retorno implícito
}

fn saludar(nombre, saludo = "Hola", signo = "!") {   // parámetros por defecto
  "{saludo}, {nombre}{signo}"
}

fn primer_par(nums) {
  for n in nums {
    if n.is_even() { return n }      // return temprano
  }
  nil
}

let doble = |x| x * 2                // closure de una expresión
let suma = |a, b = 10| a + b         // closures con valor por defecto
let tarea = || { println("sin parámetros"); 42 }

fn contador() {
  var n = 0
  || { n += 1; n }                   // los closures recuerdan su entorno
}
```

- Si faltan argumentos, valen `nil` (o su valor por defecto). Los argumentos de más se ignoran.
- Un `nil` pasado explícitamente **no** activa el valor por defecto.
- Tras un parámetro con valor por defecto, todos los siguientes deben tenerlo.

### 3.8 Clases

```rust
class Fruta {
  var peso = 1                        // campo con valor inicial
  init(nombre) {                      // constructor (opcional)
    self.nombre = nombre
  }
  fn describir() {
    "{self.nombre} de {self.peso} kg"
  }
  fn pesar(kg) { self.peso = kg; self }   // devolver self permite encadenar
}

class Mandarina : Fruta {             // herencia
  fn describir() {
    "Mandarina: " + super.describir()
  }
}

let m = Mandarina("clementina").pesar(2)
println(m.describir(), type_of(m))    // Mandarina: clementina de 2 kg Mandarina
```

- `struct` es sinónimo de `class`.
- Se pueden agregar campos nuevos en cualquier momento: `m.color = "naranja"`.
- `obj["campo"]` también lee campos.
- Una clase sin `init` no acepta argumentos.
- Una instancia en un `for` recorre sus campos como pares.

### 3.9 Errores

```rust
do {
  let x = no_existe + 1
} catch e {                            // sin nombre se llama `error`
  println(e.message, e.line)
}

fn dividir(a, b) {
  if b == 0 { throw "No se puede dividir entre 0" }   // string, mapa con message o instancia
  a / b
}

assert(1 + 1 == 2, "la suma está rota")   // lanza un error si es falso
```

El valor atrapado es un mapa `{ message, line }`, o el mapa o instancia que lanzaste.

### 3.10 Módulos

```rust
// mate.tng
export let IVA = 0.19
export fn precio_final(p) { (p * (1 + IVA)).round() }
export class Canasta { var items = [] }
let privado = 1                       // sin export no se ve desde fuera

// main.tng
import { precio_final, Canasta as Cesta } from "./mate.tng"
import mate from "./mate"             // el módulo entero como mapa; .tng es opcional
import { NARANJA } from "colores"     // paquete instalado en node_modules
import paleta from "colores/paleta"   // archivo dentro de un paquete
```

- `import` y `export` solo van en el nivel superior del archivo.
- Las rutas con `./` o `../` son relativas al archivo que importa.
- Cada módulo se ejecuta una sola vez y tiene su propio ámbito.
- Las importaciones circulares dan error.

### 3.11 Palabras reservadas

`let var fn return if else while loop for in break continue match class struct self super do catch throw true false nil import export`

(`from` y `as` solo son especiales dentro de `import`.)

---

## 4. Funciones y métodos incluidos

### 4.1 Globales (siempre disponibles)

| Función | Qué hace |
| --- | --- |
| `println(...)` | Escribe los valores separados por espacio y termina la línea. |
| `print(...)` | Escribe sin terminar la línea. Se vacía en el próximo `println` o al terminar. |
| `type_of(x)` | Nombre del tipo: `"Int"`, `"List"`, `"Mandarina"`… |
| `assert(cond, mensaje?)` | Lanza un error si `cond` es falso. |
| `min(...)`, `max(...)` | De varios números o de una lista: `min(3, 1)`, `max([4, 9])`. |
| `random()` | Número entre 0 y 1. |
| `random_int(a, b)` | Entero entre `a` y `b`, ambos incluidos. |
| `to_json(x, sangria?)` | Valor a texto JSON. |
| `from_json(texto)` | Texto JSON a valor. Los objetos pasan a ser mapas. |
| `PI` | 3.14159… |

Todos los valores tienen `.to_string()`.

### 4.2 Listas

| Método | Qué hace |
| --- | --- |
| `len()`, `is_empty()` | Tamaño, ¿está vacía? |
| `first()`, `last()` | Primer y último elemento, o `nil`. |
| `push(x, ...)` | Agrega al final. **Modifica** y devuelve la lista. |
| `pop()` | Quita y devuelve el último. |
| `insert(i, x)` | Inserta en la posición `i`. Modifica. |
| `remove(i)` | Quita y devuelve el elemento de la posición `i`. |
| `map(f)`, `filter(f)` | `f(x, i)`. Devuelven una lista nueva. |
| `fold(inicial, f)` | `f(acumulado, x, i)`. |
| `reduce(f)` | Como `fold` usando el primer elemento como inicial. |
| `find(f)`, `position(f)` | Primer elemento (o índice) que cumple `f`, o `nil`. |
| `any(f)`, `all(f)` | ¿Alguno o todos cumplen? |
| `count(f?)` | Cuántos cumplen `f`, o el largo si no hay `f`. |
| `for_each(f)` | Ejecuta `f(x, i)` para cada uno. |
| `contains(x)`, `index_of(x)` | Búsqueda por igualdad profunda. |
| `join(sep?)` | Une como texto. |
| `slice(a, b?)`, `take(n)`, `skip(n)` | Sublistas. |
| `sorted()`, `reversed()` | Copias ordenada o invertida. |
| `sorted_by(f)` | `f(a, b)` devuelve un número negativo, 0 o positivo. |
| `sorted_by_key(f)` | Ordena por `f(x)`. |
| `enumerate()` | `[[0, x0], [1, x1], ...]`. |
| `zip(otra)` | `[[a0, b0], [a1, b1], ...]`. |
| `chunks(n)` | Grupos de `n`. |
| `unique()`, `flatten()` | Sin repetidos, aplanada un nivel. |
| `sum()`, `min()`, `max()` | Suma, mínimo, máximo. |

### 4.3 Strings

| Método | Qué hace |
| --- | --- |
| `len()`, `is_empty()` | Largo en caracteres (cuenta bien los emoji). |
| `upper()`, `lower()`, `capitalize()`, `trim()` | Transformaciones. |
| `split(sep?)` | Lista de partes. Sin `sep`, separa en caracteres. |
| `lines()`, `words()`, `chars()` | Líneas, palabras, caracteres. |
| `replace(a, b)` | Reemplaza **todas** las apariciones. |
| `contains(x)`, `starts_with(x)`, `ends_with(x)`, `index_of(x)` | Búsquedas. |
| `slice(a, b?)` | Subtexto por caracteres. |
| `repeat(n)`, `reversed()` | Repetido o invertido. |
| `pad_start(n, c?)`, `pad_end(n, c?)` | Rellena hasta `n` caracteres. |
| `parse()` | Texto a número (acepta `1_000`), o `nil` si no es número. |
| `s[i]` | Carácter `i` (acepta negativos), o `nil`. |

### 4.4 Números

`abs()`, `round(decimales?)`, `floor()`, `ceil()`, `sqrt()`, `pow(e)`, `clamp(min, max)`, `is_even()`, `is_odd()`, `to_int()` (trunca), `times(f)` (lista con `f(i)` para i de 0 a n-1).

Los literales negativos necesitan paréntesis para llamar métodos: `(-4).abs()`.

### 4.5 Mapas

`keys()`, `values()`, `entries()` (lista de pares), `has(k)`, `get(k, por_defecto?)`, `remove(k)`, `len()`, `is_empty()`. Acceso: `m.clave`, `m["clave"]`, `m.clave = v`, `m["clave"] = v`.

---

## 5. Funciones según dónde corre

### 5.1 Terminal (plugin `sistema`, solo en Node)

| Función | Qué hace |
| --- | --- |
| `read_file(ruta)` | Contenido de un archivo como texto. |
| `write_file(ruta, contenido)` | Escribe un archivo. |
| `file_exists(ruta)` | `true` o `false`. |
| `list_dir(ruta?)` | Nombres de los archivos de una carpeta. |
| `args()` | Argumentos pasados después del archivo: `tangerine main.tng a b` da `["a", "b"]`. |
| `env(nombre)` | Variable de entorno, o `nil`. |
| `exit(codigo?)` | Termina el programa. |
| `now()` | Milisegundos de alta precisión. |

### 5.2 Navegador (plugin `dom`)

| Función | Qué hace |
| --- | --- |
| `query(selector)`, `query_all(selector)` | Busca un elemento o una lista de elementos. |
| `el(etiqueta, clase?, texto?)` | Crea un elemento. Los `button` salen con `type="button"`. |
| `append(padre, hijo)` | Inserta el hijo y **devuelve el hijo**. |
| `remove(e)`, `clear(e)` | Quita un elemento o vacía su contenido. |
| `set_text(e, t)`, `add_text(e, t)` | Reemplaza o agrega texto. |
| `attr(e, nombre, valor)` | Pone un atributo; con `nil` lo quita. `get_attr(e, nombre)` lo lee. |
| `toggle_class(e, clase, on?)` | Pone o quita una clase. |
| `set_style(e, propiedad, valor)` | Estilo en línea, por ejemplo `set_style(e, "color", "red")`. |
| `set_visible(e, on)` | Muestra u oculta (`hidden`). |
| `value(e)`, `set_value(e, v)` | Valor de inputs. |
| `on(e, evento, f)` | Escucha un evento. Si `f` tiene un parámetro, recibe `{ type, key, value, target }`. |
| `on_shortcut(e, f)` | Ctrl/Cmd + Enter. |
| `after(ms, f)` | Ejecuta `f` más tarde. |
| `now()` | Milisegundos de alta precisión. |
| `save(clave, valor)`, `load(clave)` | `localStorage` (`load` da `nil` si no existe). |
| `copy(texto, boton?)` | Copia al portapapeles. |
| `on_route(f)` | Llama a `f(hash)` al cargar y cada vez que cambia `#hash`. |
| `go(destino)` | Cambia el `#hash`. |
| `scroll_top()`, `scroll_to(e)` | Desplaza la página. |
| `when_visible(e, f)` | Llama a `f` cuando `e` entra en pantalla. |
| `bind(campo, estado)` | Une un input/select/casilla con un `state` en los dos sentidos. |
| `render(contenedor, f)` | Vacía `contenedor` y vuelve a ejecutar `f` cada vez que cambia un estado que usa. `f` puede devolver un elemento o una lista. |

`el`, `set_text`, `attr`, `toggle_class`, `set_style`, `set_visible` y `set_value` aceptan un `state` o `computed` en lugar del valor y se actualizan solos.

### 5.4 Componentes (siempre disponibles)

```swift
@Component("mi-contador")          // opcional: lo registra como Web Component <mi-contador>
struct Contador {
  @Input var paso = 1               // atributo/propiedad; se convierte al tipo del valor inicial
  @Output var cambio                // cambio.emit(v) lanza CustomEvent "cambio" con detail = v
  @State var cuenta = 0             // al cambiar, el view se vuelve a dibujar
  fn sumar() { cuenta += paso; cambio.emit(cuenta) }   // campos y métodos sin self.
  view {
    div(.tarjeta, .grande, { "data-id": 1, on_click: |e| nil }) {
      p(.numero) { "{cuenta}" }     // cada línea con valor se agrega: VNode, texto o lista
      button("+") { sumar() }       // en button, el bloque es la acción del clic
      input($nombre)                // unión de dos sentidos con un campo
      if cuenta > 0 { span { "sí" } }
      for x in lista { li { x } }
      element("otra-etiqueta", { prop: valor })
    }
  }
}
mount("#app", Contador)             // navegador
render_html(Contador())             // HTML como texto (Node o navegador)
```

- Las etiquetas (`div`, `p`, `span`, `button`, `input`, `ul`, `li`, `a`, `h1`...`h6`, `section`, etc.) solo crean elementos dentro de `view { }` y cuando van seguidas de `(` o `{` en la misma línea. Fuera del view son nombres normales.
- `.nombre-con-guion` funciona como clase. En un mapa, `class: valor` agrega una clase si `valor` no es `nil`/`false`.
- `tangerine build --componentes` genera `dist/componentes.js` (intérprete + módulos + CSS de `styles`).
- `@Component("x")` exige una etiqueta en minúsculas con guion y un `view`.

### 5.3 Estado reactivo (siempre disponible)

| Función | Qué hace |
| --- | --- |
| `state(v)` | Estado con `.get()`, `.set(v)` y `.update(\|v\| ...)`. `type_of` da `"State"`; `show` e interpolación muestran su valor. |
| `computed(f)` | Estado de solo lectura (`.get()`) que se recalcula cuando cambian los estados que lee `f`. |
| `effect(f)` | Ejecuta `f` ahora y cada vez que cambia un estado que leyó. |
| `is_state(v)` | `true` si `v` es un `state` o `computed`. |

|L|a|s| |l|i|s|t|a|s| |y| |m|a|p|a|s| |a|v|i|s|a|n| |s|i|e|m|p|r|e| |e|n| |`|s|e|t|`|/|`|u|p|d|a|t|e|`|,| |a|u|n|q|u|e| |s|e|a|n| |e|l| |m|i|s|m|o| |o|b|j|e|t|o|:| |`|l|.|u|p|d|a|t|e|(|\|||x|\||| |{| |x|.|p|u|s|h|(|1|)|;| |x| |}|)|`| |f|u|n|c|i|o|n|a|.|

Ejemplo de página:

```rust
let app = query("#app")
let titulo = append(app, el("h1", nil, "Hola"))
let campo = append(app, el("input"))
attr(campo, "placeholder", "Tu nombre")
on(campo, "input", |e| set_text(titulo, "Hola, {e.value}"))
```

### 5.3 React (plugin `react`)

| Función | Qué hace |
| --- | --- |
| `h(tipo, props, ...hijos)` | `React.createElement`. `tipo` es un string (`"div"`) o una función de Tangerine (componente). |
| `fragment(...hijos)` | `React.Fragment`. |
| `use_state(inicial)` | Devuelve `[valor, set]`. `set(v)` o `set(\|anterior\| nuevo)`. |
| `use_effect(f, deps?)` | `f` puede devolver una función de limpieza. |
| `use_memo(f, deps?)`, `use_ref(inicial)` | `ref.current` lee y escribe. |
| `component(f)` | Convierte una función en componente explícitamente. |

Conversión de props: `class` pasa a `className`, `for` a `htmlFor` y `on_click` / `on_change` / `on_mouse_enter` a `onClick` / `onChange` / `onMouseEnter`. `style` acepta un mapa con `font_size` o `"font-size"`. Los eventos llegan como mapa `{ type, key, value, checked, target, prevent(), stop() }`. Las listas de hijos se aplanan y `nil` no dibuja nada.

```rust
export fn Contador(props) {
  let (n, set_n) = use_state(props.inicio ?? 0)
  use_effect(|| { println("va en {n}") }, [n])
  h("div", { class: "contador" },
    h("button", { on_click: || set_n(|x| x - 1) }, "−"),
    h("span", nil, n),
    h("button", { on_click: || set_n(|x| x + 1) }, "+"),
  )
}
```

---

## 6. CLI `tangerine`

### Programar
| Comando | Qué hace |
| --- | --- |
| `tangerine` o `tangerine repl` | REPL. Conserva variables; los bloques sin cerrar siguen en la línea siguiente. Comandos: `.ayuda`, `.limpiar`, `.salir`. |
| `tangerine archivo.tng [args...]` | Ejecuta un archivo (también `tangerine run archivo.tng`). Código de salida 1 si falla. |
| `--limite <n>` | Máximo de pasos (para cortar ciclos infinitos). Por defecto no hay límite. |
| `tangerine check <archivos...>` | Revisa la sintaxis sin ejecutar. |

### Proyectos
| Comando | Qué hace |
| --- | --- |
| `tangerine new <carpeta>` | Proyecto web 100% Tangerine. |
| `tangerine new <carpeta> --con <plantilla>` | Ver la tabla de plantillas. |
| `tangerine new --lista` | Lista las plantillas. |
| `tangerine dev [-p 3000]` | Construye, sirve y recarga al guardar (necesita `tangerine.json`). |
| `tangerine build [-o salida] [--entrada archivo] [--cdn]` | Genera un solo `index.html`. |
| `tangerine serve [carpeta] [-p 8000]` | Servidor estático. |

Plantillas de `--con`:

| Plantilla | Resultado |
| --- | --- |
| `web` | Web en Tangerine (por defecto). Usa `tangerine dev` y `tangerine build`. |
| `react` | React 18 + Vite con componentes `.tng`. Usa `npm run dev`. |
| `consola` | Programa de terminal. Usa `npm start -- archivo`. |
| `paquete` | Paquete de Tangerine para npm. Usa `npm test`. |
| `vue`, `svelte`, `vite` | CLI oficial de Vite más el plugin de Tangerine (`--sin-tangerine` lo omite). |
| `angular`, `next`, `astro`, `expo` | CLI oficial de cada uno. |
| `swift`, `flutter` | `swift package init` o `flutter create` (requieren tenerlos instalados). |

### Paquetes
| Comando | Qué hace |
| --- | --- |
| `tangerine add <paquete...> [--dev]` | `npm install`. Acepta un nombre de npm, `usuario/repo` (GitHub) o una carpeta local. |
| `tangerine remove <paquete...>` | Desinstala. |
| `tangerine buscar [texto]` | Busca en npm los paquetes con la palabra clave `tangerine-paquete`. |

### Herramientas
| Comando | Qué hace |
| --- | --- |
| `tangerine doctor` | Muestra las herramientas instaladas. |
| `tangerine install --lista` | Lista lo que puede instalar. |
| `tangerine install <nombre...> [--si] [--forzar]` | Instala con winget, Homebrew, apt o npm. Pregunta antes de ejecutar salvo con `--si`. Nombres: `node git swift python angular typescript pnpm yarn bun deno vscode flutter`. |
| `tangerine vscode` | Instala la extensión de VS Code (colores y fragmentos). |
| `tangerine --ayuda`, `tangerine --version` | Ayuda y versión. |

### `tangerine.json` (proyectos web)

```json
{
  "entry": "src/main.tng",
  "out": "dist/index.html",
  "title": "Mi app",
  "lang": "es",
  "styles": ["src/estilos.css"],
  "scripts": [],
  "head": "",
  "body": "<div id=\"app\"></div>",
  "runtime": "inline"
}
```

`runtime: "cdn"` no incluye el intérprete en el HTML; lo carga de jsDelivr. `scripts` sirve para incluir plugins de JavaScript propios.

---

## 7. Usarlo desde JavaScript

### 7.1 Básico

```js
import { Tangerine } from "tangerine-lang";      // ESM
// const { Tangerine } = require("tangerine-lang"); // CommonJS

const tng = new Tangerine({
  output: (linea) => console.log(linea),   // por defecto console.log
  stepLimit: 100_000,                      // 0 o ausente = sin límite
  natives: { doble: (x) => x * 2 },        // funciones de JS visibles en Tangerine
  modules: { "mate.tng": "export let IVA = 0.19" },
});

tng.run('import { IVA } from "./mate"\nprintln(doble(21), IVA)');   // escribe "42 0.19"
const valor = tng.run("let a = 20\na + 22");                         // 42

const r = tng.runCode("println(1 / 0)");   // nunca lanza
// r.output: [], r.error: "Línea 1: División entre cero", r.trace: []
```

### 7.2 Opciones de `new Tangerine(opciones)`

| Opción | Tipo | Qué hace |
| --- | --- | --- |
| `output` | `(linea) => void` | Recibe cada línea de `println`. |
| `stepLimit` | `number` | Máximo de pasos por ejecución. |
| `natives` | `{ nombre: valor }` | Globales extra. |
| `plugins` | `Plugin[]` | Plugins a instalar. |
| `modules` | `{ ruta: código }` | Módulos en memoria. |
| `imports` | `{ nombre: clave }` | Mapa de paquetes, como los import maps: `{ "colores": "node_modules/colores/index.tng", "colores/": "node_modules/colores/" }`. |
| `resolve` | `(spec, desde) => clave` | Resolución de imports propia. |
| `read` | `(clave) => código \| null` | Lee los módulos que no están en memoria. |
| `onError` | `(mensaje) => void` | Errores dentro de callbacks (`invoke`). Por defecto `console.error`. |
| `globalPlugins` | `boolean` | `false` ignora los plugins registrados con `Tangerine.registerPlugin`. |

### 7.3 Métodos de la instancia

| Método | Qué hace |
| --- | --- |
| `run(código, { file? })` | Ejecuta. Devuelve el valor de la última instrucción. Lanza `TngError`. |
| `runCode(código)` | Devuelve `{ output, error, trace }` y nunca lanza. |
| `runModule(ruta)` | Ejecuta un módulo registrado o legible con `read`. |
| `import(ruta)` | Carga un módulo (una vez) y devuelve sus exports como mapa. |
| `forget(ruta)` | Olvida un módulo cargado. |
| `addModule(ruta, código)` | Registra un módulo en memoria. |
| `define(nombre, valor)`, `defineAll(objeto)` | Agrega globales. |
| `use(plugin)` | Instala un plugin. |
| `session()` | `{ run(código), has(nombre) }` con variables persistentes (REPL). |
| `call(fn, args)` | Llama a una función de Tangerine. Lanza los errores. |
| `invoke(fn, args)` | Igual, pero los errores van a `onError` (para eventos). |
| `message(error)` | Mensaje en español con la ubicación. |
| `trace(error)` | Lista del rastro de llamadas. |
| `globals()` | Nombres de todos los globales disponibles. |
| `show(valor)`, `truthy(valor)` | Texto de un valor y su verdad según Tangerine. |
| `imports`, `modules` | Mapa de paquetes y módulos en memoria (se pueden modificar). |

Estáticos: `Tangerine.VERSION`, `Tangerine.runCode(código, opciones?)`, `Tangerine.registerPlugin(plugin)`, `Tangerine.lexer`, `Tangerine.parse`, `Tangerine.sx` (árbol como expresión S), `Tangerine.fromJS`, `Tangerine.toJS`, `Tangerine.KEYWORDS`, `Tangerine.TngError`.

### 7.4 Valores entre JS y Tangerine

| Tangerine | JavaScript |
| --- | --- |
| `Int`, `Float`, `String`, `Bool` | `number`, `string`, `boolean` |
| `nil` | `null` (y `undefined` se lee como `nil`) |
| `List` | `Array` |
| `Map` | Objeto **sin prototipo** (`Object.create(null)`). Un objeto normal de JS no funciona con `.clave` en Tangerine: conviértelo con `Tangerine.fromJS(obj)`. |
| `Fn` | Objeto interno: se llama con `tng.call(fn, args)`. |

`Tangerine.toJS(valor)` convierte mapas, listas e instancias en objetos normales de JS. Las funciones nativas pueden lanzar `Error`: se convierte en un error de Tangerine con la línea de la llamada.

### 7.5 Errores

```js
try {
  tng.run("println(nombr)", { file: "app.tng" });
} catch (e) {
  e.line, e.col, e.file;   // ubicación
  e.incomplete;            // true si al código le falta cerrar algo (útil en un REPL)
  tng.message(e);          // "app.tng, línea 1: No existe 'nombr' en este ámbito. ¿Quisiste decir 'nombre'?"
  tng.trace(e);            // ["en f(), llamada en app.tng, línea 3", ...]
}
```

### 7.6 Plugins

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
new Tangerine({ plugins: [reloj] });   // o tng.use(reloj), o Tangerine.registerPlugin(reloj)
```

Un plugin también puede ser una función `(tng) => {}`. Si tiene `name`, se instala una sola vez por instancia.

### 7.7 Entradas del paquete

| Import | Contenido |
| --- | --- |
| `tangerine-lang` | `Tangerine` y utilidades (ESM y CommonJS). |
| `tangerine-lang/node` | `createNodeTangerine({ args })`, `runFile(ruta, { args })`, `nodeResolve`, `nodeRead` y el plugin `sistema`. Lee los imports del disco y de `node_modules`. |
| `tangerine-lang/dom` | `dom()`, el plugin del navegador. |
| `tangerine-lang/react` | `react(React)` (plugin) y `wrapExport(tng, valor)`. |
| `tangerine-lang/vite` | `tangerine({ react?, dom?, stepLimit? })`, el plugin de Vite. |
| `tangerine-lang/navegador` | Bundle global para `<script>`. |

```js
import { runFile } from "tangerine-lang/node";
runFile("src/main.tng", { args: ["Ana"] });
```

---

## 8. En el navegador sin instalar nada

```html
<div id="app"></div>
<script src="https://cdn.jsdelivr.net/npm/tangerine-lang@3.1.0/dist/tangerine.global.min.js"></script>
<script type="text/tangerine">
  append(query("#app"), el("h1", nil, "Hola desde Tangerine"))
</script>
```

Al cargar la página se ejecutan todos los `<script type="text/tangerine">` en orden:

- `data-module="util.tng"` lo registra como módulo para importarlo;
- con además `data-main`, ese módulo se ejecuta;
- `src="main.tng"` descarga el archivo y sus imports (necesita un servidor, no funciona con `file://`);
- sin atributos se ejecuta tal cual.

Si algo falla, el error aparece en la página dentro de `#app` (o del `body`) y en la consola. Con `data-manual` en el script del intérprete no arranca solo: llama a `Tangerine.start(opciones)`. Global: `window.Tangerine`. `tng.load(url)` descarga y ejecuta un `.tng` con sus imports.

---

## 9. React y Vite

```js
// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tangerine from "tangerine-lang/vite";
export default defineConfig({ plugins: [tangerine(), react()] });
```

```jsx
// main.jsx
import { Contador } from "./Contador.tng";   // cada export de Tangerine es un export de JS
<Contador inicio={5} />
```

- Todos los `.tng` del proyecto comparten un intérprete.
- Si el proyecto tiene `react` instalado, el plugin de React se agrega solo.
- Las funciones exportadas se convierten en funciones de JS y los objetos de props se convierten en mapas.
- El export por defecto es el módulo entero.
- No se exportan con nombre los que chocan con palabras reservadas de JS (`new`, `default`…).

---

## 10. Paquetes de Tangerine

Estructura mínima:

```
mi-paquete/
  package.json    { "name": "mi-paquete", "tangerine": "index.tng", "keywords": ["tangerine-paquete"] }
  index.tng       export fn ...
```

- Entrada: el campo `"tangerine"`, o `"main"` si termina en `.tng`, o `index.tng`.
- Se usa con `import { ... } from "mi-paquete"` o `from "mi-paquete/archivo"`.
- Se publica con `npm publish`.
- `tangerine build` incluye los paquetes usados en el HTML final.

---

## 11. Receta: programa típico de terminal

```rust
// contar.tng   ->   tangerine contar.tng notas.txt
import { resumen } from "./texto.tng"

let archivo = args().first()
if archivo == nil {
  println("Uso: tangerine contar.tng <archivo>")
  exit(1)
}
if !file_exists(archivo) {
  println("No existe {archivo}")
  exit(1)
}

let r = resumen(read_file(archivo))
println("{archivo}: {r.lineas} líneas, {r.palabras} palabras")
```

```rust
// texto.tng
export fn resumen(texto) {
  {
    lineas: texto.lines().len(),
    palabras: texto.words().len(),
  }
}
```

## 12. Receta: web con estado

```rust
// src/main.tng  (tangerine new mi-app && tangerine dev)
let app = query("#app")
var tareas = from_json(load("tareas") ?? "[]")

let lista = append(app, el("ul"))
let campo = append(app, el("input"))
let boton = append(app, el("button", nil, "Agregar"))

fn pintar() {
  clear(lista)
  for (i, t) in tareas.enumerate() {
    let li = append(lista, el("li", nil, t))
    on(li, "click", || { tareas.remove(i); guardar() })
  }
}

fn guardar() {
  save("tareas", to_json(tareas))
  pintar()
}

on(boton, "click", || {
  let texto = value(campo).trim()
  if !texto.is_empty() {
    tareas.push(texto)
    set_value(campo, "")
    guardar()
  }
})

pintar()
```

---

## 13. Lo que Tangerine NO tiene (no lo inventes)

- No tiene `async` / `await`, promesas ni `fetch` desde Tangerine. Si hace falta, crea una función nativa en JS que use callbacks: `invoke(f, [resultado])`.
- No tiene `enum`, interfaces, genéricos ni comprobación de tipos.
- No tiene desarmado de mapas (`let { a } = m`) ni operador spread (`...`).
- No tiene `switch`, `try` (usa `do` / `catch`), `null` (usa `nil`) ni `else if` con otra sintaxis que no sea `else if`.
- No tiene `++` ni `--`: usa `+= 1`.
- No tiene operador ternario: usa `if c { a } else { b }`.
- No tiene métodos de JS: `length`, `push_back`, `toUpperCase`, `forEach`… El error sugiere el equivalente (`len`, `push`, `upper`, `for_each`).
- No tiene `input()` para leer del teclado en la terminal.
- Los objetos de JS normales no son mapas de Tangerine (ver 7.4).
