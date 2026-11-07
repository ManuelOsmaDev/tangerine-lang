import { Plugin, Tangerine } from "./index";

/** Plugin con h, fragment, use_state, use_effect, use_memo, use_ref y component. Recibe el módulo de React. */
export function react(React: any): Plugin;
/** Convierte un export de Tangerine en un valor de JS (las funciones pasan a ser funciones o componentes). */
export function wrapExport(tng: Tangerine, value: any): any;
export default react;
