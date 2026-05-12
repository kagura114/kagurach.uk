/* tslint:disable */
/* eslint-disable */

export function decode_tokens(ids: Uint32Array): string;

export function encode(text: string): Uint32Array;

/**
 * Encode text and return JSON with token spans for visualization:
 * [{"id":123,"bytes":[72,101],"text":"He","start":0,"end":2}, ...]
 */
export function encode_with_spans(text: string): string;

/**
 * Get the raw bytes of a token as a JSON array
 */
export function get_token_bytes_json(id: number): string;

/**
 * Returns JSON array: [{"id":0,"bytes":[72,101,...],"text":"Hello"}, ...]
 */
export function get_vocab_json(): string;

export function load_model(data: string): void;

export function vocab_size(): number;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly load_model: (a: number, b: number) => [number, number];
    readonly vocab_size: () => number;
    readonly encode: (a: number, b: number) => [number, number];
    readonly decode_tokens: (a: number, b: number) => [number, number];
    readonly get_vocab_json: () => [number, number];
    readonly get_token_bytes_json: (a: number) => [number, number];
    readonly encode_with_spans: (a: number, b: number) => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
