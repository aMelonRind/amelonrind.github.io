/**
 * @module mutf-8
 * @copyright 2020 sciencesakura
 * @license MIT
 */
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var _MUtf8Decoder_instances, _MUtf8Decoder_fatal, _MUtf8Decoder_ignoreBOM, _MUtf8Decoder_handleError;
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
export class MUtf8Decoder {
    /**
     * @returns Always `"mutf-8"`.
     */
    get encoding() {
        return "mutf-8";
    }
    /**
     * @returns `true` if error mode is fatal, otherwise `false`.
     */
    get fatal() {
        return __classPrivateFieldGet(this, _MUtf8Decoder_fatal, "f");
    }
    /**
     * @returns Whether to ignore the BOM or not.
     */
    get ignoreBOM() {
        return __classPrivateFieldGet(this, _MUtf8Decoder_ignoreBOM, "f");
    }
    /**
     * @param label   - The label of the encoder. Must be `"mutf-8"` or `"mutf8"`.
     * @param options - The options.
     * @throws {RangeError} If the `label` is invalid value.
     */
    constructor(label = "mutf-8", options = {}) {
        var _a, _b;
        _MUtf8Decoder_instances.add(this);
        _MUtf8Decoder_fatal.set(this, void 0);
        _MUtf8Decoder_ignoreBOM.set(this, void 0);
        const normalizedLabel = label.toLowerCase();
        if (normalizedLabel !== "mutf-8" && normalizedLabel !== "mutf8") {
            throw new RangeError(`MUtf8Decoder.constructor: '${label}' is not supported.`);
        }
        __classPrivateFieldSet(this, _MUtf8Decoder_fatal, (_a = options.fatal) !== null && _a !== void 0 ? _a : false, "f");
        __classPrivateFieldSet(this, _MUtf8Decoder_ignoreBOM, (_b = options.ignoreBOM) !== null && _b !== void 0 ? _b : false, "f");
    }
    /**
     * Decodes the specified bytes.
     *
     * @param input   - The bytes to be decoded.
     * @param options - The options. This parameter is ignored.
     * @returns The resultant string.
     * @throws {TypeError} If {@link fatal} is `true` and the `input` is invalid bytes.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    decode(input, options = {}) {
        const buf = input instanceof Uint8Array ? input : new Uint8Array("buffer" in input ? input.buffer : input);
        const length = buf.length;
        const result = [];
        let p = 0;
        while (p < length) {
            const b1 = buf[p++];
            if (!(b1 & 0x80) && b1 !== 0) {
                // U+0001-007F
                result.push(String.fromCharCode(b1));
            }
            else if (b1 >>> 5 === 0b110) {
                // U+0000, U+0080-07FF
                if (length <= p) {
                    __classPrivateFieldGet(this, _MUtf8Decoder_instances, "m", _MUtf8Decoder_handleError).call(this, result);
                    continue;
                }
                const b2 = buf[p++];
                if (b2 >>> 6 !== 0b10) {
                    __classPrivateFieldGet(this, _MUtf8Decoder_instances, "m", _MUtf8Decoder_handleError).call(this, result);
                    continue;
                }
                result.push(String.fromCharCode(((b1 & 0x1f) << 6) | (b2 & 0x3f)));
            }
            else if (b1 >>> 4 === 0b1110) {
                // U+0800-
                if (length <= p + 1) {
                    __classPrivateFieldGet(this, _MUtf8Decoder_instances, "m", _MUtf8Decoder_handleError).call(this, result);
                    continue;
                }
                const b2 = buf[p++];
                const b3 = buf[p++];
                if (b2 >>> 6 !== 0b10 || b3 >>> 6 !== 0b10) {
                    __classPrivateFieldGet(this, _MUtf8Decoder_instances, "m", _MUtf8Decoder_handleError).call(this, result);
                    continue;
                }
                if (b1 === 0xef && b2 === 0xbb && b3 === 0xbf && p == 3 && !this.ignoreBOM) {
                    // slip a BOM `EF BB BF`
                    continue;
                }
                result.push(String.fromCharCode(((b1 & 0x0f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f)));
            }
            else {
                __classPrivateFieldGet(this, _MUtf8Decoder_instances, "m", _MUtf8Decoder_handleError).call(this, result);
            }
        }
        return result.join("");
    }
}
_MUtf8Decoder_fatal = new WeakMap(), _MUtf8Decoder_ignoreBOM = new WeakMap(), _MUtf8Decoder_instances = new WeakSet(), _MUtf8Decoder_handleError = function _MUtf8Decoder_handleError(result) {
    if (this.fatal) {
        throw new TypeError("MUtf8Decoder.decode: Decoding failed.");
    }
    result.push("\ufffd");
};
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
export class MUtf8Encoder {
    /**
     * @returns Always `"mutf-8"`.
     */
    get encoding() {
        return "mutf-8";
    }
    /**
     * Encodes the specified string in MUTF-8.
     *
     * @param input - The string to be encoded.
     * @returns The resultant bytes.
     */
    encode(input = "") {
        const bin = [];
        for (const c of input) {
            const code = c.codePointAt(0);
            if (0x0001 <= code && code <= 0x007f) {
                bin.push(code);
            }
            else if (code <= 0x07ff) {
                bin.push(0xc0 | (code >>> 6));
                bin.push(0x80 | (0x3f & code));
            }
            else if (code <= 0xffff) {
                bin.push(0xe0 | (code >>> 12));
                bin.push(0x80 | (0x3f & (code >>> 6)));
                bin.push(0x80 | (0x3f & code));
            }
            else {
                bin.push(0xed);
                bin.push(0xa0 | ((code >>> 16) - 1));
                bin.push(0x80 | (0x3f & (code >>> 10)));
                bin.push(0xed);
                bin.push(0xb0 | (0x0f & (code >>> 6)));
                bin.push(0x80 | (0x3f & code));
            }
        }
        return new Uint8Array(bin);
    }
    /**
     * Encodes the specified string in MUTF-8 and stores the result to the specified array.
     *
     * @param source      - The string to be encoded.
     * @param destination - The bytes to be stored the result.
     * @returns The progress.
     */
    encodeInto(source, destination) {
        const destLen = destination.length;
        let i = 0;
        let read = 0;
        for (const c of source) {
            const code = c.codePointAt(0);
            if (0x0001 <= code && code <= 0x007f) {
                if (destLen <= i)
                    break;
                destination[i++] = code;
            }
            else if (code <= 0x07ff) {
                if (destLen <= i + 1)
                    break;
                destination[i++] = 0xc0 | (code >>> 6);
                destination[i++] = 0x80 | (0x3f & code);
            }
            else if (code <= 0xffff) {
                if (destLen <= i + 2)
                    break;
                destination[i++] = 0xe0 | (code >>> 12);
                destination[i++] = 0x80 | (0x3f & (code >>> 6));
                destination[i++] = 0x80 | (0x3f & code);
            }
            else {
                if (destLen <= i + 5)
                    break;
                destination[i++] = 0xed;
                destination[i++] = 0xa0 | ((code >>> 16) - 1);
                destination[i++] = 0x80 | (0x3f & (code >>> 10));
                destination[i++] = 0xed;
                destination[i++] = 0xb0 | (0x0f & (code >>> 6));
                destination[i++] = 0x80 | (0x3f & code);
                read++;
            }
            read++;
        }
        return { read, written: i };
    }
}
