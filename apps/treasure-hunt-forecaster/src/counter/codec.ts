import { Item } from "../../../../data/ba/inventories"

export namespace codec {
  export namespace item {
    const index: number[] = []
    for (let w = 1; w <= 5; w++) {
      for (let h = 1; h <= w; h++) {
        index.push((w << 4) | h)
      }
    }
    if (index.length !== 15) {
      throw new Error(`Item codec index length assertion failed (${index.length})`)
    }

    /**
     * Encodes an item's settings into a byte
     */
    export function encode(width: number, height: number, amount: number): number {
      if (!(width > 0 && width <= 5) || !(height > 0 && height <= 5) || !(amount >= 0 && amount < 16)) {
        throw new Error(`Item encode assertion failed (${width}, ${height}, ${amount})`)
      }
      if (height > width) {
        [width, height] = [height, width]
      }
      return (index.indexOf((width << 4) | height) << 4) | amount
    }

    /**
     * Decodes a byte into an item's settings
     */
    export function decode(byte: number): Item {
      const amount = byte & 15
      const wh = index[(byte >> 4) & 15]
      if (wh === undefined) {
        throw new Error(`Item decode failed (${byte})`)
      }
      return [wh >> 4, wh & 15, amount]
    }
  }
}
