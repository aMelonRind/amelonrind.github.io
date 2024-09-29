//@ts-check

class BlockImage {
  /** @readonly @type {Uint8Array} */ static colors = new Uint8Array(64 * 4 * 3) // 64 colors -> 4 brightness -> rgb
  /** @readonly @type {number} */ width 
  /** @readonly @type {number} */ height 
  /** @readonly @type {Uint8Array} */ data // same as MapDatNbt.data.colors but unsigned and unlimited length
  /** @type {string} the name of this image */
  name = 'unnamed_mapart'
  /** @type {string?} the part of this image, should be in `${number | 'row'}_${number}` format. null if this is the whole image. */
  part = null
  author = 'Mapart Converter'
  description = 'converted on https://amelonrind.github.io/mapart-conv'
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

  sliceRows() {
    //
  }

  slice1x1() {}

}

// TODO:
// .litematic
// .nbt
// .dat / zip of .dat
// .litematic with separated materials
