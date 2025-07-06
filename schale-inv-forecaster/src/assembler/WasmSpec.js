// only partial required spec are implemented, not for general purpose.
const textEncoder = new TextEncoder()

const exportTypes = {
  func: 0x00,
  table: 0x01,
  mem: 0x02,
  global: 0x03
}

export const section = {
  /** @readonly */
  header: Uint8Array.of(0x00, 0x61, 0x73, 0x6D, 0x01, 0x00, 0x00, 0x00),
  /** @type {(type: number, content: Uint8Array) => Uint8Array} */
  _raw: (type, content) => flatU8A([type, leb128(content.length), content]),
  /** @type {(types: [params: Uint8Array, result: Uint8Array][]) => Uint8Array} */
  types: types => section._raw(0x01, flatU8A([
    leb128(types.length),
    types.map(f => [0x60, leb128(f[0].length), f[0], leb128(f[1].length), f[1]])
  ])),
  /** @type {(types: number[]) => Uint8Array} */
  func: types => section._raw(0x03, flatU8A([leb128(types.length), mapLeb128(types)])),
  /** @type {(size: number) => Uint8Array} */
  memory: size => section._raw(0x05, flatU8A([0x01, 0x00, leb128(size)])), // single min memory, partial impl
  /** @type {(exports: { [name: string]: [type: 'func' | 'table' | 'mem' | 'global', idx: number] }) => Uint8Array} */
  export: exports => section._raw(0x07, flatU8A([
    leb128(Object.keys(exports).length),
    Object.entries(exports).map(e => [encodeStr(e[0]), exportTypes[e[1][0]], leb128(e[1][1])])
  ])),
  /** @type {(funcs: [locals: Uint8Array, body: Uint8Array][]) => Uint8Array} */
  code: funcs => {
    const mappedFuncs = funcs.map(([locals, body]) => {
      if (locals.length === 0) {
        return flatU8A([leb128(1 + body.length), 0x00, body])
      }
      const loc = new Uint8Array(locals.reduce((p, v, i, a) => v !== a[i - 1] ? p + 1 : p, 0) * 2)
      let index = 0
      loc[1] = locals[0]
      for (const type of locals) {
        if (type !== loc[index + 1]) {
          index += 2
          loc[index + 1] = type
        }
        loc[index]++
      }
      const loclen = leb128(loc.length / 2)
      return flatU8A([leb128(loclen.length + loc.length + body.length), loclen, loc, body])
    })
    return section._raw(0x0A, flatU8A([leb128(mappedFuncs.length), mappedFuncs]))
  },
  /** @type {(names: (string | null)[][]) => Uint8Array} */
  names: names => section._raw(0x00, flatU8A([encodeStr('name'), 0x02, lengthed(flatU8A([
    leb128(names.reduce((p, v) => v.length ? p + 1 : p, 0)),
    names.map((f, i) => !f.length ? [] : [
      leb128(i),
      leb128(f.reduce((p, v) => v ? p + 1 : p, 0)),
      f.map((n, i) => n ? [leb128(i), encodeStr(n)] : [])
    ])
  ]))]))
}

/** @satisfies {WasmNamespace} */
export const cf = {
  /** @type {(content: Uint8Array, type?: number) => Uint8Array} */
  block: (content, type = 0x40) => flatU8A([0x02, type || 0x40, content, cf.end]),
  /** @type {(label: number) => Uint8Array} */
  br_if: (label) => flatU8A([0x0D, leb128(label)]),
  /** @type {(labels: number[]) => Uint8Array} */
  br_table: labels => flatU8A([0x0E, leb128(labels.length - 1), mapLeb128(labels)]),
  /** @type {(func: number) => Uint8Array} */
  call: func => flatU8A([0x10, leb128(func)]),
  /** @readonly */
  end: 0x0B,
  /** @type {(then: Uint8Array, els?: Uint8Array | undefined, type?: number) => Uint8Array} */
  if: (then, els = undefined, type = 0x40) => flatU8A([0x04, type || 0x40, then, (els ? [0x05, els] : []), cf.end]),
  /** @type {(content: Uint8Array) => Uint8Array} */
  loop: content => flatU8A([0x03, 0x40, content, cf.end]),
  /** @readonly */
  return: 0x0F
}

/** @satisfies {WasmNamespace} */
export const i32 = {
  /** @readonly */ type: 0x7F,
  /** @readonly */ size: 4,
  /** @readonly */ add: 0x6A,
  /** @readonly */ and: 0x71,
  /** @readonly */ eqz: 0x45,
  /**
   * divides by 3. the input must be a multiply of 3 or else it'll be undefined behavior.  
   * [i32] -> [i32]
   * @readonly
   */
  div3: flatU8A([0x41, leb128(0xAAAAAAAB), 0x6C]),
  /** @readonly */ or: 0x72,
  const: (n = 0) => flatU8A([0x41, leb128(n)]),
  /** @readonly */ ge_u: 0x4F,
  /** @readonly */ gt_u: 0x4B,
  load: (offset = 0, align = 4) => flatU8A([0x28, leb128(Math.log2(align)), leb128(offset)]),
  /** @readonly */ mul: 0x6C,
  /** @readonly */ shr_u: 0x76,
  store: (offset = 0, align = 4) => flatU8A([0x36, leb128(Math.log2(align)), leb128(offset)]),
  /** @readonly */ sub: 0x6B,
  /** @readonly */ wrap_i64: 0xA7,
}

/** @satisfies {WasmNamespace} */
export const i64 = {
  /** @readonly */ type: 0x7E,
  /** @readonly */ size: 8,
  /** @readonly */ add: 0x7C,
  /** @readonly */ and: 0x83,
  const: (n = 0n) => flatU8A([0x42, leb128(n)]),
  /** @readonly */ ctz: 0x7A,
  /** @readonly */ popcnt: 0x7B,
  /** @readonly */ eqz: 0x50,
  /** @readonly */ extend_i32_u: 0xAD,
  load: (offset = 0, align = 8) => flatU8A([0x29, leb128(Math.log2(align)), leb128(offset)]),
  /** @readonly */ ne: 0x52,
  /** @readonly */ or: 0x84,
  /** @readonly */ shl: 0x86,
  /** @readonly */ sub: 0x7D,
  store: (offset = 0, align = 8) => flatU8A([0x37, leb128(Math.log2(align)), leb128(offset)]),
  /** @readonly */ xor: 0x85
}

/** @satisfies {WasmNamespace} */
export const local = {
  /** @type {(idx: number) => Uint8Array} */
  get: idx => flatU8A([0x20, leb128(idx)]),
  /** @type {(idx: number) => Uint8Array} */
  set: idx => flatU8A([0x21, leb128(idx)]),
  /** @type {(idx: number) => Uint8Array} */
  tee: idx => flatU8A([0x22, leb128(idx)]),
}

/**
 * @param {string} str 
 * @returns {Uint8Array}
 */
function encodeStr(str) {
  const enc = textEncoder.encode(str)
  return flatU8A([leb128(enc.length), enc])
}

/**
 * @param {number | bigint} n 
 * @returns {Uint8Array}
 */
function leb128(n) {
  if (n < 64 && n >= 0) {
    return Uint8Array.of(Number(n))
  }
  if (typeof n === 'number') {
    const length = Math.ceil((32 - Math.clz32(Math.abs(n >> 0)) + 1) / 7) || 1
    //@ts-ignore
    return Uint8Array.from({ length }, (_, i) => ((n >> (7 * i)) & 0b1111111) | (i !== length - 1 ? 0b10000000 : 0))
  } else {
    n = BigInt64Array.of(n)[0]
    const bitlen = (n < 0 ? -n : n).toString(2).length + 1
    const length = Math.ceil(bitlen / 7) || 1
    //@ts-ignore
    return Uint8Array.from({ length }, (_, i) => Number((n >> (7n * BigInt(i))) & 0b1111111n) | (i !== length - 1 ? 0b10000000 : 0))
  }
}

/**
 * @param {number[]} arr 
 * @returns {Uint8Array}
 */
function mapLeb128(arr) {
  if (arr.every(v => v < 128 && v >= 0)) {
    return Uint8Array.from(arr)
  }
  const res = new Uint8Array(arr.map(v => Math.ceil((32 - Math.clz32(Math.abs(v >> 0)) + 1) / 7) || 1).reduce((p, v) => p + v))
  let index = 0
  for (const num of arr) {
    const len = Math.ceil((32 - Math.clz32(Math.abs(num >> 0)) + 1) / 7) || 1
    for (let i = 0; i < len; i++) {
      res[index++] = ((num >> (7 * i)) & 0b1111111) | (i !== len - 1 ? 0b10000000 : 0)
    }
  }
  if (index !== res.length) {
    throw `leb128 array convertion failed: expected ${res.length}, converted ${index}. (${arr.length > 512 ? `number[${arr.length}]` : arr.join(', ')})`
  }
  return res
}

/**
 * @param {Uint8Array} arr 
 * @returns {[Uint8Array, Uint8Array]}
 */
function lengthed(arr) {
  return [leb128(arr.length), arr]
}

/**
 * @param {DeepU8Arr} arr 
 * @returns {Uint8Array}
 */
export function flatU8A(arr) {
  const res = new Uint8Array(lenDeepU8A(arr))
  let index = 0
  for (const elem of iterateDeepU8A(arr)) {
    if (typeof elem === 'number') {
      res[index++] = elem
    } else {
      res.set(elem, index)
      index += elem.length
    }
  }
  return res
}

/**
 * @param {DeepU8Arr} arr 
 * @returns {number}
 */
function lenDeepU8A(arr) {
  let len = 0
  for (const elem of iterateDeepU8A(arr)) {
    len += typeof elem === 'number' ? 1 : elem.length
  }
  return len
}

/**
 * @param {DeepU8Arr} arr 
 * @returns {Generator<number | Uint8Array>}
 */
function* iterateDeepU8A(arr, _appeared = new Set()) {
  if (_appeared.has(arr)) {
    throw new Error('Encuntered recursive DeepU8Arr')
  }
  _appeared.add(arr)
  for (const elem of arr) {
    if (Array.isArray(elem)) {
      yield* iterateDeepU8A(elem, _appeared)
    } else {
      yield elem
    }
  }
  _appeared.delete(arr)
}

/**
 * @typedef {(number | Uint8Array | DeepU8Arr)[]} DeepU8Arr 
 * @typedef {Record<string, number | Uint8Array | ((...args: any[]) => Uint8Array)>} WasmNamespace 
 */
