import { Int8, Int16, Int32, Float32 } from "./primitive.js";
import { TAG, getTagType } from "./tag.js";
const UNQUOTED_STRING_PATTERN = /^[0-9A-Za-z.+_-]+$/;
/**
 * Converts an SNBT string into an NBT object.
*/
export function parse(data) {
    if (typeof data !== "string") {
        data;
        throw new TypeError("First parameter must be a string");
    }
    return parseRoot(data, 0, { index: 0 });
}
function peek(data, index, byteOffset = index) {
    const value = data[byteOffset];
    if (value === undefined) {
        throw unexpectedEnd();
    }
    return value;
}
function unexpectedEnd() {
    return new Error("Unexpected end");
}
function unexpectedChar(data, index, i) {
    if (i == null) {
        i = index;
    }
    return new Error(`Unexpected character ${peek(data, index)} at position ${index}`);
}
function skipWhitespace(data, index) {
    while (index.index < data.length) {
        if (!/ |\t|\r/.test(peek(data, index.index)) && peek(data, index.index) != "\n")
            return;
        index.index += 1;
    }
}
function parseRoot(data, i, index) {
    skipWhitespace(data, index);
    i = index.index;
    switch (peek(data, index.index)) {
        case "{": {
            index.index++;
            return parseCompound(data, i, index);
        }
        case "[": {
            index.index++;
            const list = parseList(data, "[root]", i, index);
            const type = getTagType(list);
            if (type !== TAG.LIST)
                break;
            return list;
        }
    }
    throw new Error("Encountered unexpected Root tag type, must be either a List or Compound tag");
}
function parseTag(data, key, i, index) {
    skipWhitespace(data, index);
    i = index.index;
    switch (peek(data, index.index)) {
        case "{": {
            index.index++;
            return parseCompound(data, i, index);
        }
        case "[": return (index.index++, parseList(data, key, i, index));
        case '"':
        case "'": return parseQuotedString(data, index);
        default: {
            if (/^(true)$/.test(data.slice(i, index.index + 4)) ||
                /^(false)$/.test(data.slice(i, index.index + 5))) {
                return (parseUnquotedString(data, i, index) === "true");
            }
            const value = parseNumber(data, i, index);
            if (value != null && (index.index == data.length || !UNQUOTED_STRING_PATTERN.test(peek(data, index.index)))) {
                return value;
            }
            return (data.slice(i, index.index) + parseUnquotedString(data, i, index));
        }
    }
}
function parseNumber(data, i, index) {
    if (!"-0123456789".includes(peek(data, index.index)))
        return null;
    i = index.index++;
    let hasFloatingPoint = false;
    while (index.index < data.length) {
        const char = peek(data, index.index);
        index.index++;
        if ("0123456789e-+".includes(char))
            continue;
        switch (char.toLowerCase()) {
            case ".": {
                if (hasFloatingPoint) {
                    index.index--;
                    return null;
                }
                hasFloatingPoint = true;
                break;
            }
            case "f": return new Float32(+data.slice(i, index.index - 1));
            case "d": return +data.slice(i, index.index - 1);
            case "b": return new Int8(+data.slice(i, index.index - 1));
            case "s": return new Int16(+data.slice(i, index.index - 1));
            case "l": return BigInt(data.slice(i, index.index - 1));
            default: {
                if (hasFloatingPoint) {
                    return +data.slice(i, --index.index);
                }
                else {
                    return new Int32(+data.slice(i, --index.index));
                }
            }
        }
    }
    if (hasFloatingPoint) {
        return +data.slice(i, index.index);
    }
    else {
        return new Int32(+data.slice(i, index.index));
    }
}
function parseString(data, i, index) {
    if (peek(data, index.index) == '"' || peek(data, index.index) == "'") {
        return parseQuotedString(data, index);
    }
    else {
        return parseUnquotedString(data, i, index);
    }
}
function parseUnquotedString(data, i, index) {
    i = index.index;
    while (index.index < data.length) {
        if (!UNQUOTED_STRING_PATTERN.test(peek(data, index.index)))
            break;
        index.index++;
    }
    if (index.index - i == 0) {
        if (index.index == data.length) {
            throw unexpectedEnd();
        }
        else {
            throw unexpectedChar(data, index.index);
        }
    }
    return data.slice(i, index.index);
}
function parseQuotedString(data, index) {
    const quoteChar = peek(data, index.index);
    // i = 
    ++index.index;
    let string = "";
    while (index.index < data.length) {
        let char = peek(data, index.index++);
        if (char === "\\") {
            char = `\\${peek(data, index.index++)}`;
        }
        if (char === quoteChar) {
            return string;
        }
        string += unescapeString(char);
    }
    throw unexpectedEnd();
}
function unescapeString(value) {
    return value
        .replaceAll("\\\\", "\\")
        .replaceAll("\\\"", "\"")
        .replaceAll("\\'", "'")
        .replaceAll("\\b", "\b")
        .replaceAll("\\f", "\f")
        .replaceAll("\\n", "\n")
        .replaceAll("\\r", "\r")
        .replaceAll("\\t", "\t");
}
function skipCommas(data, isFirst, end, index) {
    skipWhitespace(data, index);
    if (peek(data, index.index) == ",") {
        if (isFirst) {
            throw unexpectedChar(data, index.index);
        }
        else {
            index.index++;
            skipWhitespace(data, index);
        }
    }
    else if (!isFirst && peek(data, index.index) != end) {
        throw unexpectedChar(data, index.index);
    }
}
function parseArray(data, type, i, index) {
    const array = [];
    while (index.index < data.length) {
        skipCommas(data, array.length == 0, "]", index);
        if (peek(data, index.index) == "]") {
            index.index++;
            switch (type) {
                case "B": return Int8Array.from(array.map(v => +v));
                case "I": return Int32Array.from(array.map(v => +v));
                case "L": return BigInt64Array.from(array.map(v => BigInt(v)));
            }
        }
        i = index.index;
        if (peek(data, index.index) == "-") {
            index.index++;
        }
        while (index.index < data.length) {
            if (!"0123456789".includes(peek(data, index.index)))
                break;
            index.index++;
        }
        const prefix = (type === "B") ? "b" : (type === "L") ? "l" : "";
        if (peek(data, index.index) == prefix) {
            index.index++;
        }
        if (index.index - i == 0) {
            throw unexpectedChar(data, index.index);
        }
        if (UNQUOTED_STRING_PATTERN.test(peek(data, index.index))) {
            throw unexpectedChar(data, index.index);
        }
        array.push(data.slice(i, index.index - ((type !== "I") ? 1 : 0)));
    }
    throw unexpectedEnd();
}
function parseList(data, key, i, index) {
    if ("BILbil".includes(peek(data, index.index)) && data[index.index + 1] == ";") {
        return parseArray(data, peek(data, (index.index += 2) - 2).toUpperCase(), i, index);
    }
    const array = [];
    let type;
    while (index.index < data.length) {
        skipWhitespace(data, index);
        if (peek(data, index.index) == ",") {
            if (array.length == 0) {
                throw unexpectedChar(data, index.index);
            }
            else {
                index.index++;
                skipWhitespace(data, index);
            }
        }
        else if (array.length > 0 && peek(data, index.index) != "]") {
            throw unexpectedChar(data, index.index - 1);
        }
        if (peek(data, index.index) == "]") {
            index.index++;
            return array;
        }
        const entry = parseTag(data, key, i, index);
        if (type === undefined) {
            type = getTagType(entry);
        }
        if (getTagType(entry) !== type) {
            throw new TypeError(`Encountered unexpected item type '${getTagType(entry)}' in List '${key}' at index ${array.length}, expected item type '${type}'. All tags in a List tag must be of the same type`);
        }
        array.push(entry);
    }
    throw unexpectedEnd();
}
function parseCompound(data, i, index) {
    const entries = [];
    let first = true;
    while (true) {
        skipCommas(data, first, "}", index);
        first = false;
        if (peek(data, index.index) == "}") {
            index.index++;
            return entries.reduce((obj, [k, v]) => (obj[k] = v, obj), {});
        }
        const key = parseString(data, i, index);
        skipWhitespace(data, index);
        if (data[index.index++] != ":") {
            throw unexpectedChar(data, index.index);
        }
        entries.push([key, parseTag(data, key, i, index)]);
    }
}
