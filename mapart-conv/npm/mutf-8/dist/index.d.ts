/**
 * @module mutf-8
 * @copyright 2020 sciencesakura
 * @license MIT
 */
/**
 * The options for decoder.
 */
export interface TextDecoderOptions {
    /** `true` to stop processing when an error occurs, `false` otherwise. */
    fatal?: boolean;
    /** Whther to ignore the BOM or not. */
    ignoreBOM?: boolean;
}
/**
 * The options for decoding.
 */
export interface TextDecodeOptions {
    stream?: boolean;
}
/**
 * The result of encoding.
 */
export interface TextEncoderEncodeIntoResult {
    /** The number of converted code units of source. */
    read: number;
    /** The number of bytes modified in destination. */
    written: number;
}
/**
 * The type of buffer source that can be used in the decoder.
 */
export type AllowSharedBufferSource = ArrayBuffer | SharedArrayBuffer | ArrayBufferView;
/**
 * The decoder for Modified UTF-8.
 *
 * @example
 * ```ts
 * const src = new Uint8Array([
 *   0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x20, 0xe4, 0xb8,
 *   0x96, 0xe7, 0x95, 0x8c, 0x21,
 * ]);
 * const decoder = new MUtf8Decoder();
 * const text = decoder.decode(src);
 * // Hello 世界!
 * ```
 *
 * @see {@link https://encoding.spec.whatwg.org/}
 */
export declare class MUtf8Decoder {
    #private;
    /**
     * @returns Always `"mutf-8"`.
     */
    get encoding(): string;
    /**
     * @returns `true` if error mode is fatal, otherwise `false`.
     */
    get fatal(): boolean;
    /**
     * @returns Whether to ignore the BOM or not.
     */
    get ignoreBOM(): boolean;
    /**
     * @param label   - The label of the encoder. Must be `"mutf-8"` or `"mutf8"`.
     * @param options - The options.
     * @throws {RangeError} If the `label` is invalid value.
     */
    constructor(label?: string, options?: TextDecoderOptions);
    /**
     * Decodes the specified bytes.
     *
     * @param input   - The bytes to be decoded.
     * @param options - The options. This parameter is ignored.
     * @returns The resultant string.
     * @throws {TypeError} If {@link fatal} is `true` and the `input` is invalid bytes.
     */
    decode(input: AllowSharedBufferSource, options?: TextDecodeOptions): string;
}
/**
 * The encoder for Modified UTF-8 (MUTF-8).
 *
 * @example
 * ```ts
 * const encoder = new MUtf8Encoder();
 * const code = encoder.encode("Hello 世界!");
 * // Uint8Array [
 * //   0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x20, 0xe4, 0xb8,
 * //   0x96, 0xe7, 0x95, 0x8c, 0x21,
 * // ]
 * ```
 *
 * @see {@link https://encoding.spec.whatwg.org/}
 */
export declare class MUtf8Encoder {
    /**
     * @returns Always `"mutf-8"`.
     */
    get encoding(): string;
    /**
     * Encodes the specified string in MUTF-8.
     *
     * @param input - The string to be encoded.
     * @returns The resultant bytes.
     */
    encode(input?: string): Uint8Array;
    /**
     * Encodes the specified string in MUTF-8 and stores the result to the specified array.
     *
     * @param source      - The string to be encoded.
     * @param destination - The bytes to be stored the result.
     * @returns The progress.
     */
    encodeInto(source: string, destination: Uint8Array): TextEncoderEncodeIntoResult;
}
