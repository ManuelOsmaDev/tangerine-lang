# {{nombre}}

Proyecto web hecho con [Tangerine](https://www.npmjs.com/package/tangerine-lang).

```bash
npm install
npm run dev     # http://localhost:3000, se recarga al guardar
npm run build   # genera dist/index.html, un solo archivo listo para publicar
```

El código está en `src/`. `src/main.tng` es la entrada. Usa `state(valor)` para guardar datos: lo que los muestra en la página se actualiza solo cuando cambian. Puedes separar el código en otros archivos con `import { ... } from "./archivo.tng"`.
