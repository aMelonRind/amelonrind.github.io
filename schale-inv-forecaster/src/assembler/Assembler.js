//@ts-check

import { results } from "../CounterHandler.js"
import { buildCounterModule } from "./assembler_test.js"

// 4x1: 48
// 3x1: 62
// 2x1: 76

export async function assemblerTest() {
  const module = await WebAssembly.compileStreaming(fetch('./src/assembler/test.wasm'))
  const instance = await WebAssembly.instantiate(module)
  /** @type {WebAssembly.Memory} *///@ts-ignore
  const memory = instance.exports.memory
  const view = new DataView(memory.buffer)
  new Uint8Array(memory.buffer).fill(0)
  const a = getPlacements(4, 1)
  const b = getPlacements(3, 1)
  const c = getPlacements(2, 1)
  if (a.length !== 48 || b.length !== 62 || c.length !== 76) throw 'length error'
  for (let i = 0; i < 48; i++) {
    view.setBigUint64(0 + i * 12, a[i], true)
    view.setUint32(0 + i * 12 + 8, 6000 + i * 8, true)
  }
  for (let i = 0; i < 62; i++) {
    view.setBigUint64(1000 + i * 12, b[i], true)
    view.setUint32(1000 + i * 12 + 8, 13000 + i * 8, true)
  }
  for (let i = 0; i < 76; i++) {
    view.setBigUint64(2000 + i * 12, c[i], true)
    view.setUint32(2000 + i * 12 + 8, 16000 + i * 8, true)
  }
  const start = performance.now()
  /** @type {bigint} *///@ts-ignore
  const total = instance.exports.main(0n)
  const time = `test wasm time: ${(performance.now() - start).toFixed(1)}ms`
  const countA = new BigUint64Array(45)
  const countB = new BigUint64Array(45)
  const countC = new BigUint64Array(45)
  for (let i = 0; i < 48; i++) {
    const count = view.getBigUint64(6000 + i * 8, true)
    if (count) {
      for (let bi = 0; bi < 45; bi++) {
        if (a[i] & (1n << BigInt(bi))) {
          countA[bi] += count
        }
      }
    }
  }
  for (let i = 0; i < 62; i++) {
    const count = view.getBigUint64(13000 + i * 8, true)
    if (count) {
      for (let bi = 0; bi < 45; bi++) {
        if (b[i] & (1n << BigInt(bi))) {
          countB[bi] += count
        }
      }
    }
  }
  for (let i = 0; i < 76; i++) {
    const count = view.getBigUint64(16000 + i * 8, true)
    if (count) {
      for (let bi = 0; bi < 45; bi++) {
        if (c[i] & (1n << BigInt(bi))) {
          countC[bi] += count
        }
      }
    }
  }
  results.set('0,4,1,2,3,1,3,2,1,2', { total, count: [countA, countB, countC], time })
  console.log(time)
}

/**
 * @param {number} w 
 * @param {number} h 
 * @returns {BigUint64Array}
 */
export function getPlacements(w, h) {
  const doRotate = h <= 9 && w !== h
  const count = (10 - w) * (6 - h) + (doRotate ? (10 - h) * (6 - w) : 0)
  const arr = new BigUint64Array(count)
  let index = 0

  const mask = (1n << BigInt(w)) - 1n
  let plac = 0n
  for (let i = 0; i < h; i++) {
    plac = (plac << 9n) | mask
  }
  for (let y = 0n; y <= 5 - h; y++) {
    const yof = y * 9n
    for (let x = 0n; x <= 9 - w; x++) {
      arr[index++] = plac << yof + x
    }
  }
  if (doRotate) {
    const mask = (1n << BigInt(h)) - 1n
    let plac = 0n
    for (let i = 0; i < w; i++) {
      plac = (plac << 9n) | mask
    }
    for (let y = 0n; y <= 5 - w; y++) {
      const yof = y * 9n
      for (let x = 0n; x <= 9 - h; x++) {
        arr[index++] = plac << yof + x
      }
    }
  }
  if (index !== count) {
    throw `assertion error (${index}/${count})`
  }
  return arr
}
