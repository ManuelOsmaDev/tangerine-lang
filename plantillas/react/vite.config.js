import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tangerine from "tangerine-lang/vite";

// tangerine() permite importar archivos .tng; los componentes escritos en Tangerine funcionan con React.
export default defineConfig({
  plugins: [tangerine(), react()],
});
