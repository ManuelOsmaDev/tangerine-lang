import { Tangerine, TangerineOptions, Plugin, TngValue } from "./index";

export function nodeResolve(spec: string, from: string | null): string;
export function nodeRead(file: string): string | null;
/** Plugin con read_file, write_file, file_exists, list_dir, args, env, exit y now. */
export function sistema(options?: { args?: string[] }): Plugin;
export function createNodeTangerine(options?: TangerineOptions & { args?: string[] }): Tangerine;
export function runFile(file: string, options?: TangerineOptions & { args?: string[] }): TngValue;
export { Tangerine };
export default Tangerine;
