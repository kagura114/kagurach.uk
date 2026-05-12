/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export const load_model: (a: number, b: number) => [number, number];
export const vocab_size: () => number;
export const encode: (a: number, b: number) => [number, number];
export const decode_tokens: (a: number, b: number) => [number, number];
export const get_vocab_json: () => [number, number];
export const get_token_bytes_json: (a: number) => [number, number];
export const encode_with_spans: (a: number, b: number) => [number, number];
export const __wbindgen_externrefs: WebAssembly.Table;
export const __wbindgen_malloc: (a: number, b: number) => number;
export const __wbindgen_free: (a: number, b: number, c: number) => void;
export const __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
export const __externref_table_dealloc: (a: number) => void;
export const __wbindgen_start: () => void;
