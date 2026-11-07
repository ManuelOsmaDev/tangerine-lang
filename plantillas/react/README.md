# {{nombre}}

React + Vite con componentes escritos en [Tangerine](https://www.npmjs.com/package/tangerine-lang).

```bash
npm install
npm run dev
```

- `src/App.tng` y `src/Contador.tng` son componentes de React escritos en Tangerine.
- Desde JavaScript se importan como cualquier módulo: `import { App } from "./App.tng"`.
- En Tangerine tienes `h`, `fragment`, `use_state`, `use_effect`, `use_memo` y `use_ref`.
- Los eventos van en props `on_click`, `on_change`, `on_submit`… y reciben un mapa con `value`, `key`, `checked`, `prevent()`.
