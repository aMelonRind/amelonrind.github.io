
export namespace leb128 {

  export function u32(value: number): Uint8Array {
    if (value < 0 || value > 0xFFFFFFFF) {
      throw new Error(`value out of range (${value})`)
    }
    return u64(value)
  }

  export function u64(value: number | bigint): Uint8Array {
    value = BigInt(value);
    if (value < 0n || value > 0xFFFFFFFF_FFFFFFFFn) {
      throw new Error(`value out of range (${value})`)
    }
    if (value < 0) {
      throw new Error('Received negative number')
    }
    if (value < 64n && value >= 0n) {
      return Uint8Array.of(Number(value))
    }
    const result: number[] = [];
    while (true) {
      const byte_ = Number(value & 0x7fn);
      value >>= 7n;
      if (value === 0n) {
        result.push(byte_);
        return Uint8Array.from(result);
      }
      result.push(byte_ | 0x80);
    }
  }

  export function s32(value: number): Uint8Array {
    if (value < -0x80000000 || value > 0x7FFFFFFF) {
      throw new Error(`value out of range (${value})`)
    }
    return s64(BigInt(value))
  }

  // https://en.wikipedia.org/wiki/LEB128#JavaScript_code
  export function s64(value: number | bigint): Uint8Array {
    value = BigInt(value);
    if (value < -0x80000000_00000000n || value > 0x7FFFFFFF_FFFFFFFFn) {
      throw new Error(`value out of range (${value})`)
    }
    if (value < 64n && value >= 0n) {
      return Uint8Array.of(Number(value))
    }
    const result: number[] = [];
    while (true) {
      const byte_ = Number(value & 0x7fn);
      value >>= 7n;
      if (
        (value === 0n && (byte_ & 0x40) === 0) ||
        (value === -1n && (byte_ & 0x40) !== 0)
      ) {
        result.push(byte_);
        return Uint8Array.from(result);
      }
      result.push(byte_ | 0x80);
    }
  }

  export function decodeU32(bytes: ArrayLike<number>, byteLengthConsumer: (length: number) => void = () => {}): number {
    const big = leb128.decodeU64(bytes, byteLengthConsumer)
    if (big >> 32n) {
      throw new Error('leb128 decode failed: trying to convert number larger than 32-bit to 32-bit.')
    }
    return Number(big)
  }

  export function decodeU64(input: ArrayLike<number>, byteLengthConsumer: (length: number) => void = () => {}): bigint {
    let result = 0n;
    let shift = 0n;
    let len = 0;
    while (true) {
      if (len >= input.length) {
        throw new Error('Unexpected end of LEB128')
      }
      const byte = input[len];
      len++
      result |= BigInt(byte & 0x7f) << shift;
      shift += 7n;
      if ((byte & 0x80) === 0) {
        byteLengthConsumer(len)
        return result;
      }
    }
  }

  export function decodeS32(bytes: ArrayLike<number>, byteLengthConsumer: (length: number) => void = () => {}): number {
    const big = leb128.decodeS64(bytes, byteLengthConsumer)
    if (big >= 0 ? (big >> 32n) : (~big >> 32n)) {
      throw new Error('leb128 decode failed: trying to convert number larger than 32-bit to 32-bit.')
    }
    return Number(big)
  }

  // https://en.wikipedia.org/wiki/LEB128#JavaScript_code
  // note that shl part is incorrect due to 32-bit operation on number that supposed to be 64-bit.
  export function decodeS64(input: ArrayLike<number>, byteLengthConsumer: (length: number) => void = () => {}): bigint {
    let result = 0n;
    let shift = 0n;
    let len = 0;
    while (true) {
      if (len >= input.length) {
        throw new Error('Unexpected end of LEB128')
      }
      const byte = input[len];
      len++
      result |= BigInt(byte & 0x7f) << shift;
      shift += 7n;
      if ((byte & 0x80) === 0) {
        // "sign-extending" does not apply to bigint because it has no fixed size
        // instead, we work by handling it as a two's complement of "shift" bits long,
        // which is provided by BigInt.asIntN
        byteLengthConsumer(len)
        return BigInt.asIntN(Number(shift), result);
      }
    }
  }
}
