import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tng";
import "./estilos.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App titulo="Hola desde Tangerine + React" />
  </StrictMode>,
);
