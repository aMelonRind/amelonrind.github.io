// modified, by aMelonRind
import { NBTData } from "./format.js";
import { Int8, Int16, Int32, Float32 } from "./primitive.js";
import { TAG, TAG_TYPE, isTagType } from "./tag.js";
import { decompress } from "./compression.js";

const listTagAttrCache = {}
/** @type {WeakMap<Uint8Array, Record<string, Uint8Array>>} */
const cachedDecompress = new WeakMap();
/**
 * Converts an NBT buffer into an NBT object. Accepts an endian type, compression format, and file headers to read the data with.
 *
 * If a format option isn't specified, the function will attempt reading the data using all options until it either throws or returns successfully.
*/
export async function read(data, options = {}) {
    if (data instanceof Blob) {
        data = await data.arrayBuffer();
    }
    if (!("byteOffset" in data)) {
        data = new Uint8Array(data);
    }
    if (!(data instanceof Uint8Array)) {
        data;
        throw new TypeError("First parameter must be a Uint8Array, ArrayBuffer, SharedArrayBuffer, or Blob");
    }
    const reader = new NBTReader(data, options.endian !== "big", options.endian === "little-varint");
    let { rootName, endian, compression, bedrockLevel, strict = true } = options;
    if (rootName !== undefined && typeof rootName !== "boolean" && typeof rootName !== "string" && rootName !== null) {
        rootName;
        throw new TypeError("Root Name option must be a boolean, string, or null");
    }
    if (endian !== undefined && endian !== "big" && endian !== "little" && endian !== "little-varint") {
        endian;
        throw new TypeError("Endian option must be a valid endian type");
    }
    if (compression !== undefined && compression !== "deflate" && compression !== "deflate-raw" && compression !== "gzip" && compression !== null) {
        compression;
        throw new TypeError("Compression option must be a valid compression type");
    }
    if (bedrockLevel !== undefined && typeof bedrockLevel !== "boolean" && typeof bedrockLevel !== "number" && bedrockLevel !== null) {
        bedrockLevel;
        throw new TypeError("Bedrock Level option must be a boolean, number, or null");
    }
    if (typeof strict !== "boolean") {
        strict;
        throw new TypeError("Strict option must be a boolean");
    }
    compression: if (compression === undefined) {
        switch (true) {
            case reader.hasGzipHeader():
                compression = "gzip";
                break compression;
            case reader.hasZlibHeader():
                compression = "deflate";
                break compression;
        }
        try {
            return await read(data, { ...options, compression: null });
        }
        catch (error) {
            try {
                return await read(data, { ...options, compression: "deflate-raw" });
            }
            catch {
                throw error;
            }
        }
    }
    compression;
    if (endian === undefined) {
        try {
            return await read(data, { ...options, endian: "big" });
        }
        catch (error) {
            try {
                return await read(data, { ...options, endian: "little" });
            }
            catch {
                try {
                    return await read(data, { ...options, endian: "little-varint" });
                }
                catch {
                    throw error;
                }
            }
        }
    }
    endian;
    if (rootName === undefined) {
        try {
            return await read(data, { ...options, rootName: true });
        }
        catch (error) {
            try {
                return await read(data, { ...options, rootName: false });
            }
            catch {
                throw error;
            }
        }
    }
    rootName;
    if (compression !== null) {
        await reader.tryDecompress(compression);
    }
    if (bedrockLevel === undefined) {
        bedrockLevel = reader.hasBedrockLevelHeader(endian);
    }
    const res = reader.readRoot({ rootName, endian, compression, bedrockLevel, strict });
    cachedDecompress.delete(data);
    return res;
}
class NBTReader {
    #byteOffset = 0;
    #rawdata;
    #data;
    #length = 0;
    #view;
    #littleEndian;
    #varint;
    constructor(data, littleEndian, varint) {
        this.#rawdata = data;
        this.#view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        this.#littleEndian = littleEndian;
        this.#varint = varint;
    }
    hasGzipHeader() {
        const header = this.#view.getUint16(0, false);
        return header === 0x1F8B;
    }
    hasZlibHeader() {
        const header = this.#view.getUint8(0);
        return header === 0x78;
    }
    hasBedrockLevelHeader(endian) {
        if (endian !== "little" || this.#data.byteLength < 8)
            return false;
        const byteLength = this.#view.getUint32(4, true);
        return byteLength === this.#data.byteLength - 8;
    }
    #allocate(byteLength) {
        if (this.#byteOffset + byteLength > this.#length) {
            throw new Error("Ran out of bytes to read, unexpectedly reached the end of the buffer");
        }
    }
    async tryDecompress(compression) {
        const ent = cachedDecompress.get(this.#rawdata) ?? {};
        const cached = ent[compression];
        if (cached) {
            this.#data = cached;
            return cached;
        }
        const res = await decompress(this.#rawdata, compression);
        this.#data = res;
        ent[compression] = res;
        cachedDecompress.set(this.#rawdata, ent);
    }
    async readRoot({ rootName, endian, compression, bedrockLevel, strict }) {
        this.#data = this.#rawdata;
        if (compression !== null) {
            await this.tryDecompress(compression);
            this.#view = new DataView(this.#data.buffer);
        }
        this.#length = this.#data.byteLength;
        if (bedrockLevel) {
            // const version =
            this.#readUnsignedInt();
            this.#readUnsignedInt();
        }
        const type = this.#readTagType();
        if (type !== TAG.LIST && type !== TAG.COMPOUND) {
            throw new Error(`Expected an opening List or Compound tag at the start of the buffer, encountered tag type '${type}'`);
        }
        const rootNameV = typeof rootName === "string" || rootName ? this.#readString() : null;
        const root = this.#readTag(type);
        if (strict && this.#data.byteLength > this.#byteOffset) {
            const remaining = this.#data.byteLength - this.#byteOffset;
            throw new Error(`Encountered unexpected End tag at byte offset ${this.#byteOffset}, ${remaining} unread bytes remaining`);
        }
        return new NBTData(root, { rootName: rootNameV, endian, compression, bedrockLevel });
    }
    #readTag(type) {
        switch (type) {
            case TAG.END: {
                const remaining = this.#data.byteLength - this.#byteOffset;
                throw new Error(`Encountered unexpected End tag at byte offset ${this.#byteOffset}, ${remaining} unread bytes remaining`);
            }
            case TAG.BYTE: return this.#readByte();
            case TAG.SHORT: return this.#readShort();
            case TAG.INT: return this.#readInt();
            case TAG.LONG: return this.#readLong();
            case TAG.FLOAT: return this.#readFloat();
            case TAG.DOUBLE: return this.#readDouble();
            case TAG.BYTE_ARRAY: return this.#readByteArray();
            case TAG.STRING: return this.#readString();
            case TAG.LIST: return this.#readList();
            case TAG.COMPOUND: return this.#readCompound();
            case TAG.INT_ARRAY: return this.#readIntArray();
            case TAG.LONG_ARRAY: return this.#readLongArray();
            default: throw new Error(`Encountered unsupported tag type '${type}' at byte offset ${this.#byteOffset}`);
        }
    }
    #readTagType() {
        const type = this.#readUnsignedByte();
        if (!isTagType(type)) {
            throw new Error(`Encountered unsupported tag type '${type}' at byte offset ${this.#byteOffset}`);
        }
        return type;
    }
    #readUnsignedByte() {
        this.#allocate(1);
        const value = this.#view.getUint8(this.#byteOffset);
        this.#byteOffset += 1;
        return value;
    }
    #readByte(valueOf = false) {
        this.#allocate(1);
        const value = this.#view.getInt8(this.#byteOffset);
        this.#byteOffset += 1;
        return (valueOf) ? value : new Int8(value);
    }
    #readUnsignedShort() {
        this.#allocate(2);
        const value = this.#view.getUint16(this.#byteOffset, this.#littleEndian);
        this.#byteOffset += 2;
        return value;
    }
    #readShort(valueOf = false) {
        this.#allocate(2);
        const value = this.#view.getInt16(this.#byteOffset, this.#littleEndian);
        this.#byteOffset += 2;
        return (valueOf) ? value : new Int16(value);
    }
    #readUnsignedInt() {
        this.#allocate(4);
        const value = this.#view.getUint32(this.#byteOffset, this.#littleEndian);
        this.#byteOffset += 4;
        return value;
    }
    #readInt(valueOf = false) {
        if (this.#varint) {
            return this.#readVarIntZigZag();
        }
        this.#allocate(4);
        const value = this.#view.getInt32(this.#byteOffset, this.#littleEndian);
        this.#byteOffset += 4;
        return (valueOf) ? value : new Int32(value);
    }
    #readVarInt() {
        let value = 0;
        let shift = 0;
        let byte;
        while (true) {
            byte = this.#readByte(true);
            value |= (byte & 0x7F) << shift;
            if ((byte & 0x80) === 0)
                break;
            shift += 7;
        }
        return value;
    }
    #readVarIntZigZag(valueOf = false) {
        let result = 0;
        let shift = 0;
        while (true) {
            this.#allocate(1);
            const byte = this.#readByte(true);
            result |= ((byte & 0x7F) << shift);
            if (!(byte & 0x80))
                break;
            shift += 7;
            if (shift > 63) {
                throw new Error(`VarInt size '${shift}' at byte offset ${this.#byteOffset} is too large`);
            }
        }
        const zigzag = ((((result << 63) >> 63) ^ result) >> 1) ^ (result & (1 << 63));
        return valueOf ? zigzag : new Int32(zigzag);
    }
    #readLong() {
        if (this.#varint) {
            return this.#readVarLongZigZag();
        }
        this.#allocate(8);
        const value = this.#view.getBigInt64(this.#byteOffset, this.#littleEndian);
        this.#byteOffset += 8;
        return value;
    }
    #readVarLongZigZag() {
        let result = 0n;
        let shift = 0n;
        while (true) {
            this.#allocate(1);
            const byte = this.#readByte(true);
            result |= (BigInt(byte) & 0x7fn) << shift;
            if (!(byte & 0x80))
                break;
            shift += 7n;
            if (shift > 63n) {
                throw new Error(`VarLong size '${shift}' at byte offset ${this.#byteOffset} is too large`);
            }
        }
        const zigzag = (result >> 1n) ^ -(result & 1n);
        return zigzag;
    }
    #readFloat(valueOf = false) {
        this.#allocate(4);
        const value = this.#view.getFloat32(this.#byteOffset, this.#littleEndian);
        this.#byteOffset += 4;
        return (valueOf) ? value : new Float32(value);
    }
    #readDouble() {
        this.#allocate(8);
        const value = this.#view.getFloat64(this.#byteOffset, this.#littleEndian);
        this.#byteOffset += 8;
        return value;
    }
    #readByteArray() {
        const length = this.#readInt(true);
        this.#allocate(length);
        const value = new Int8Array(this.#data.subarray(this.#byteOffset, this.#byteOffset + length));
        this.#byteOffset += length;
        return value;
    }
    #readString() {
        const length = this.#varint ? this.#readVarInt() : this.#readUnsignedShort();
        this.#allocate(length);
        const value = decodeMutf8(this.#data, this.#byteOffset, length);
        this.#byteOffset += length;
        return value;
    }
    #readList() {
        const type = this.#readTagType();
        const length = this.#varint ? this.#readVarIntZigZag(true) : this.#readInt(true);
        const value = new Array(length < 0 ? 0 : length);
        // low optimization part, unnecessary data
        // Object.defineProperty(value, TAG_TYPE, listTagAttrCache[type] ??= {
        //     configurable: true,
        //     enumerable: false,
        //     writable: true,
        //     value: type
        // });
        for (let i = 0; i < length; i++) {
            value[i] = this.#readTag(type);
        }
        return value;
    }
    #readCompound() {
        const value = {};
        while (true) {
            const type = this.#readTagType();
            if (type === TAG.END)
                break;
            const name = this.#readString();
            const entry = this.#readTag(type);
            value[name] = entry;
        }
        return value;
    }
    #readIntArray() {
        const length = this.#readInt(true);
        if (this.#varint) {
            const value = new Int32Array(length);
            for (const i in value) {
                const entry = this.#readInt(true);
                value[i] = entry;
            }
            return value;
        }
        const byteLen = length * 4;
        this.#allocate(byteLen);
        const byteOffset = this.#byteOffset;
        this.#byteOffset += byteLen;
        if (this.#littleEndian) {
            return new Int32Array(this.#view.buffer, byteOffset, length);
        } else {
            const u8a = new Uint8Array(this.#view.buffer, byteOffset, byteLen).slice().reverse();
            return new Int32Array(u8a.buffer, u8a.byteOffset, length).reverse();
        }
    }
    #readLongArray() {
        const length = this.#readInt(true);
        const value = new BigInt64Array(length);
        if (this.#varint) {
            for (const i in value) {
                const entry = this.#readLong();
                value[i] = entry;
            }
            return value;
        }
        const byteLen = length * 8;
        this.#allocate(byteLen);
        const byteOffset = this.#byteOffset;
        this.#byteOffset += byteLen;
        if (this.#littleEndian) {
            return new BigInt64Array(this.#view.buffer, byteOffset, length);
        } else {
            const u8a = new Uint8Array(this.#view.buffer, byteOffset, byteLen).slice().reverse();
            return new BigInt64Array(u8a.buffer, u8a.byteOffset, length).reverse();
        }
    }
}


/**
 * The following content are copied and modified from mutf-8 package, by aMelonRind.
 * @ module mutf-8
 * @copyright 2020 sciencesakura
 * @license MIT
 */
/**
 * Decodes the specified bytes.
 *
 * @param {Uint8Array} input - The bytes to be decoded.
 * @param {number} start 
 * @param {number} length 
 * @returns The resultant string.
 */
function decodeMutf8(input, start, length) {
    const buf = input;
    let p = start;
    const end = start + length
    if (length <= 5) {
        // vowels are placed last for efficiency
        if (length === 5) {
            if (buf[p + 0] === 115 &&
                buf[p + 1] === 116 &&
                buf[p + 3] === 116 &&
                buf[p + 2] === 97 &&
                buf[p + 4] === 101
            ) return "state"
        } else if (length === 3) {
            if (buf[p + 0] === 112 &&
                buf[p + 2] === 115 &&
                buf[p + 1] === 111
            ) return "pos"
        } else if (length === 4) {
            if (buf[p + 0] === 78 &&
                buf[p + 2] === 109 &&
                buf[p + 1] === 97 &&
                buf[p + 3] === 101
            ) return "Name"
        } else if (length === 1) {
            const b = buf[p]
            if (!(b & 0x80) && b !== 0) {
                return String.fromCharCode(b)
            }
        }
    }
    const result = [];
    if (length >= 12) {
        if (buf[p + 9] === 58 &&
            buf[p + 8] === 116 &&
            buf[p + 0] === 109 &&
            buf[p + 1] === 105 &&
            buf[p + 2] === 110 &&
            buf[p + 3] === 101 &&
            buf[p + 4] === 99 &&
            buf[p + 5] === 114 &&
            buf[p + 6] === 97 &&
            buf[p + 7] === 102
        ) {
            result.push("minecraft:")
            p += 10
        }
    }
    while (p < end) {
        const b1 = buf[p++];
        if (!(b1 & 0x80) && b1 !== 0) {
            // U+0001-007F
            result.push(String.fromCharCode(b1));
        } else if (b1 >>> 5 === 0b110) {
            // U+0000, U+0080-07FF
            if (end <= p) {
                result.push("\ufffd");
                continue;
            }
            const b2 = buf[p++];
            if (b2 >>> 6 !== 0b10) {
                result.push("\ufffd");
                continue;
            }
            result.push(String.fromCharCode(((b1 & 0x1f) << 6) | (b2 & 0x3f)));
        } else if (b1 >>> 4 === 0b1110) {
            // U+0800-
            if (end <= p + 1) {
                result.push("\ufffd");
                continue;
            }
            const b2 = buf[p++];
            const b3 = buf[p++];
            if (b2 >>> 6 !== 0b10 || b3 >>> 6 !== 0b10) {
                result.push("\ufffd");
                continue;
            }
            if (b1 === 0xef && b2 === 0xbb && b3 === 0xbf && p == start + 3) {
                // slip a BOM `EF BB BF`
                continue;
            }
            result.push(String.fromCharCode(((b1 & 0x0f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f)));
        } else {
            result.push("\ufffd");
        }
    }
    return result.join("");
}
