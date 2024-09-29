//@ts-check

class BlockImage {
  /** @readonly @type {Uint8Array} */ static colors = new Uint8Array(64 * 4 * 3) // 64 colors -> 4 brightness -> rgb
  /** @readonly @type {number} */ width 
  /** @readonly @type {number} */ height 
  /** @readonly @type {Uint8Array} */ data // same as MapDatNbt.data.colors but unsigned and unlimited length
  /** @type {string?} the part of this image, should be in `${number | 'row'}_${number}` format. null if this is the whole image. */
  part = null
  filename = 'unnamed_mapart'
  /** @type {string?} */ name = null
  author = 'Mapart Converter'
  /** @type {string?} */ description = null
  timeCreated = BigInt(Date.now())

  static async load() {
    const colors = fetch('src/colors.json').then(res => res.json())
    /** @type {number[]} */
    const rawcolors = await colors
    const Brightness = Float32Array.from([ 180, 220, 255, 135 ], v => v / 255) // LOW, NORMAL, HIGH, LOWEST
    rawcolors.forEach((v, i) => {
      const rgb = Uint8Array.of(0xFF & (v >> 16), 0xFF & (v >> 8), 0xFF & v)
      const index = i * 4 * 3
      this.colors.set(rgb.map(v => v * Brightness[0]), index)
      this.colors.set(rgb.map(v => v * Brightness[1]), index + 3)
      this.colors.set(rgb.map(v => v * Brightness[2]), index + 6)
      this.colors.set(rgb.map(v => v * Brightness[3]), index + 9)
    })
  }

  /**
   * @param {number} width 
   * @param {number} height 
   * @param {Uint8Array} data 
   */
  constructor(width, height, data) {
    if (width * height !== data.length) throw `invalid length (${width}, ${height}, ${width * height}, ${data.length})`
    this.width = width
    this.height = height
    this.data = data
  }

  /**
   * @returns {ImageData}
   */
  toImageData() {
    const res = new Uint8ClampedArray(this.data.length * 4)
    this.data.forEach((v, i) => {
      if (v < 4) return
      res.set(BlockImage.colors.subarray(v * 3, v * 3 + 3), i * 4)
      res[i * 4 + 3] = 255
    })
    return new ImageData(res, this.width, this.height)
  }

  isTransparent() {
    const mask = ~0b11 // 4 kinds of transparent for edge cases
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i] & mask) return false
    }
    return true
  }

  /**
   * split image into rows, transparent sub-images are ignored.
   * @returns {BlockImage[]}
   */
  splitRows() {
    const res = []
    const chunk = 128 * this.width
    for (let y = 0; y * 128 < this.height; y++) {
      const sub = this.data.subarray(y * chunk, y * chunk + chunk)
      const img = new BlockImage(this.width, sub.length / this.width, sub)
      if (img.isTransparent()) continue
      img.filename = this.filename
      img.name = this.name
      img.author = this.author
      img.description = this.description
      img.timeCreated = this.timeCreated
      img.part = `row_${y}`
      res.push(img)
    }
    return res
  }

  /**
   * split image into 1x1 maps (128x128 blocks), transparent sub-images are ignored.
   * @returns {BlockImage[]}
   */
  split1x1() {
    const res = []
    for (let y = 0; y < this.height; y += 128) {
      for (let x = 0; x < this.width; x += 128) {
        const orig = y * this.width + x
        const w = Math.min(128, this.width - x)
        const my = Math.min(128, this.height - y)
        const sub = new Uint8Array(16384)
        for (let iy = 0; iy < my; iy++) {
          const i = orig + iy * this.width
          sub.set(this.data.subarray(i, i + w), iy * 128)
        }
        const img = new BlockImage(128, 128, sub)
        if (img.isTransparent()) continue
        img.filename = this.filename
        img.name = this.name
        img.author = this.author
        img.description = this.description
        img.timeCreated = this.timeCreated
        img.part = `${x >> 7}_${y >> 7}`
        res.push(img)
      }
    }
    return res
  }

  /**
   * @typedef {Promise<{ name: string, data: Uint8Array }>} NbtDataResult
   */

  /**
   * @returns {NbtDataResult}
   */
  async toDat() {
    if (this.width !== 128 || this.height !== 128 || this.data.length !== 16384) {
      throw new RangeError(`size is incorrect for dat file! (${this.width}, ${this.height}, ${this.data.length})`)
    }
    const nbt = new NBT.NBTData({
      DataVersion: new NBT.Int32(2975),
      data: {
        banners: [],
        colors: Int8Array.from(this.data),
        dimension: 'minecraft:overworld',
        frames: [],
        locked: new NBT.Int8(1),
        scale: new NBT.Int8(0),
        trackingPosition: new NBT.Int8(0),
        unlimitedTracking: new NBT.Int8(0),
        xCenter: new NBT.Int32(0),
        zCenter: new NBT.Int32(0)
      }
    })
    return {
      name: this.part ? `${this.filename}_${this.part}.dat` : `${this.filename}.dat`,
      data: await NBT.write(nbt)
    }
  }

  #buildHeights() {}

  async toStructure() {}

  // litematica description code
  // desc = desc.trim()
  // if (!desc.includes('amelonrind.github.io/mapart-conv')) {
  //   desc += '\n\nConverted on https://amelonrind.github.io/mapart-conv'
  // }
  // this.description = desc.trim()
  async toLitematic() {}

  async toLitematicSeparated() {}

}

// TODO:
// .litematic
// .nbt
// .dat / zip of .dat
// .litematic with separated materials
