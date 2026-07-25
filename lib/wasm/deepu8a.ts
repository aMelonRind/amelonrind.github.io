
export type DeepU8Arr = readonly (number | Uint8Array | DeepU8Arr | false | null | undefined | void)[];
export type WritableDeepU8Arr = (number | Uint8Array | DeepU8Arr | false | null | undefined | void)[];

/**
 * Flatten nested byte arrays into single one.
 */
export function flatU8A(arr: DeepU8Arr): Uint8Array<ArrayBuffer> {
  const res = new Uint8Array(lenDeepU8A(arr))
  let index = 0
  for (const elem of iterateDeepU8A(arr)) {
    if (typeof elem === 'number') {
      res[index++] = elem
    } else {
      // res.set(elem, index) // this is slower than for loop, somehow
      for (let i = 0; i < elem.length; i++) {
        res[index + i] = elem[i]
      }
      index += elem.length
    }
  }
  return res
}

function lenDeepU8A(arr: DeepU8Arr): number {
  let len = 0
  for (const elem of iterateDeepU8A(arr)) {
    len += typeof elem === 'number' ? 1 : elem.length
  }
  return len
}

function* iterateDeepU8A(arr: DeepU8Arr): Generator<number | Uint8Array> {
  const appeared = new Set()
  yield* recursive(arr)

  function* recursive(arr: DeepU8Arr): Generator<number | Uint8Array> {
    if (appeared.has(arr)) {
      throw new Error('Encuntered recursive DeepU8Arr')
    }
    appeared.add(arr)

    for (const elem of arr) {
      if ((Array.isArray as (arg: any) => arg is readonly any[])(elem)) {
        yield* recursive(elem)
      } else if (elem != null && elem !== false) {
        yield elem
      }
    }

    appeared.delete(arr)
  }
}
