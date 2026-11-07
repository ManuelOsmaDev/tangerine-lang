# {{nombre}}

Componentes hechos con [Tangerine](https://www.npmjs.com/package/tangerine-lang) que funcionan en cualquier proyecto: HTML, Angular, React, Vue o Svelte.

```bash
npm install
npm run dev     # http://localhost:3000, para probarlos
npm run build   # genera dist/componentes.js
```

Copia `dist/componentes.js` a tu proyecto y cárgalo una vez. Después usa la etiqueta.

## HTML

```html
<script src="componentes.js"></script>
<mi-contador paso="2" titulo="Puntos"></mi-contador>
<script>
  document.querySelector("mi-contador").addEventListener("cambio", (e) => console.log(e.detail));
</script>
```

## Angular

En `angular.json`, agrega `"src/assets/componentes.js"` a `scripts`. En el componente donde lo uses:

```ts
import { Component, CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";

@Component({
  selector: "app-root",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<mi-contador [paso]="2" titulo="Puntos" (cambio)="total = $event.detail"></mi-contador>`,
})
export class AppComponent { total = 0; }
```

## React

Carga el archivo una vez, por ejemplo con `import "./componentes.js"` en `main.jsx`:

```jsx
export default function App() {
  return <mi-contador paso="2" titulo="Puntos" oncambio={(e) => console.log(e.detail)} />;
}
```

React 19 conecta `oncambio` solo. En React 18, escucha el evento con un `ref` y `addEventListener("cambio", ...)`.
