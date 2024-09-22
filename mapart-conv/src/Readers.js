//@ts-check
/// <reference path = "../index.d.ts"/>

class Readers {

  static async load() {
    await Promise.allSettled([BlockImageBuilder.load(), BlockImage.load()])
  }

  /**
   * @param {DataTransferItemList | null | undefined} items 
   * @returns {Promise<HTMLImageElement | BlockImage | null>}
   */
  static async readItems(items) {
    if (!items) return null
    for (const item of items) {
      if (item.type === 'text/plain') { // urls
        return new Promise(res => {
          item.getAsString(async str => res(await ImageReaders.readURL(str)))
        })
      } else if (item.type.startsWith('image/')) { // image/*
        const file = item.getAsFile()
        if (!file) continue
        return await ImageReaders.readFile(file)
      } else if (item.kind === 'file') { // .zip, .nbt, .schematic, .dat, .litematica
        const file = item.getAsFile()
        if (!file) continue
        const name = file.name
        console.log(`reading ${name}`)
        const lastDotIndex = name.lastIndexOf('.')
        const ext = (lastDotIndex !== -1 && lastDotIndex < name.length - 1) ? name.slice(lastDotIndex + 1) : ''
        switch (ext) {
          case 'nbt': //@ts-ignore
            return this.readStructure(await NBT.read(file))
          case 'schematic': //@ts-ignore
            return this.readSchematic(await NBT.read(file))
          case 'dat': //@ts-ignore
            return this.readMapDat(await NBT.read(file))
          case 'litematic': //@ts-ignore
            return this.readLitematic(await NBT.read(file))
          case 'zip': {
            return this.readZip(file)
            break
          }
        }
      }
    }
    return null
  }

  /**
   * @param {StructureNbt} root 
   * @returns {BlockImage}
   */
  static readStructure(root) {
    const palette = BlockImageBuilder.readMcPalette(root.data.palette)
    const builder = new BlockImageBuilder(root.data.size[0].valueOf(), root.data.size[2].valueOf())
    root.data.blocks.forEach(b => {
      builder.putPos(b.pos[0].valueOf(), b.pos[1].valueOf(), b.pos[2].valueOf(), palette[b.state.valueOf()])
    })
    return builder.build()
  }

  /**
   * @param {SchematicNbt} root 
   * @returns {BlockImage}
   */
  static readSchematic(root) {
    const w = root.data.Width.valueOf()
    const h = root.data.Height.valueOf()
    const l = root.data.Length.valueOf()
    if (w * h * l !== root.data.Data.length) throw `size doesn't match (${w}, ${h}, ${l}, ${w * h * l}, ${root.data.Data.length})`
    const data = BlockImageBuilder.readSchematicIndexes(root.data.Blocks, root.data.Data)
    const builder = new BlockImageBuilder(root.data.Width.valueOf(), root.data.Length.valueOf())
    const area = w * l
    for (let y = 0; y < h; y++) {
      data.subarray(y * area, y * area + area).forEach((c, i) => builder.putIndex(i, y, c))
    }
    return builder.build()
  }

  /**
   * @param {MapDatNbt} root 
   * @returns {BlockImage}
   */
  static readMapDat(root) {
    return new BlockImage(128, 128, Uint8Array.from(root.data.data.colors))
  }

  /**
   * @param {LitematicNbt} root 
   * @returns {BlockImage}
   */
  static readLitematic(root) {
    const regions = Object.values(root.data.Regions)
    if (regions.length === 0) throw `no regions`
    
    let minx = Infinity
    let miny = Infinity
    let minz = Infinity
    let maxx = -Infinity
    let maxy = -Infinity
    let maxz = -Infinity
    regions.forEach(region => {
      const x1 = region.Position.x.valueOf()
      const y1 = region.Position.y.valueOf()
      const z1 = region.Position.z.valueOf()
      const x2 = x1 + region.Size.x.valueOf()
      const y2 = y1 + region.Size.y.valueOf()
      const z2 = z1 + region.Size.z.valueOf()
      minx = Math.min(minx, x1, x2)
      miny = Math.min(miny, y1, y2)
      minz = Math.min(minz, z1, z2)
      maxx = Math.max(maxx, x1, x2)
      maxy = Math.max(maxy, y1, y2)
      maxz = Math.max(maxz, z1, z2)
    })
    const size = {
      x: maxx - minx,
      y: maxy - miny,
      z: maxz - minz,
    }
    if (size.x <= 0 || size.y <= 0 || size.z <= 0) throw `invalid size (${size.x}, ${size.y}, ${size.z})`

    const builder = new BlockImageBuilder(size.x, size.z)
    regions.forEach(region => {
      const px = region.Position.x.valueOf()
      const py = region.Position.y.valueOf()
      const pz = region.Position.z.valueOf()
      const sx = region.Size.x.valueOf()
      const sy = region.Size.y.valueOf()
      const sz = region.Size.z.valueOf()
      const dx = Math.min(px, px + sx) - minx
      const dy = Math.min(py, py + sy) - miny
      const dz = Math.min(pz, pz + sz) - minz
      const abssx = Math.abs(sx)
      const abssy = Math.abs(sy)
      const abssz = Math.abs(sz)
      let palette = BlockImageBuilder.readMcPalette(region.BlockStatePalette)
      if (palette[0] !== 0) {
        const fix = new Uint8Array(palette.length + 1)
        fix.set(palette, 1)
        palette = fix
      }
      const bits = BigInt(Math.max(2, 32 - Math.clz32(palette.length - 1)))
      const bitmask = (1n << bits) - 1n
      const states = BigUint64Array.from(region.BlockStates)
      let buf = 0n
      let bufs = 0n
      let i = 0
      outer:
      for (let y = 0; y < abssy; y++) {
        const absy = dy + y
        for (let z = 0; z < abssz; z++) {
          const toIndex = (dz + z) * size.x + dx
          for (let x = 0; x < abssx; x++) {
            if (bufs < bits) {
              if (i < states.length) {
                buf |= states[i++] << bufs
              } else if (buf === 0n) {
                break outer
              }
              bufs += 64n
            }
            if (buf) {
              builder.putIndex(toIndex + x, absy, palette[Number(buf & bitmask)])
              buf >>= bits
            } else {
              const skips = Math.min(abssx - x, Number(bufs / bits)) - 1
              if (skips > 0) {
                x += skips
                bufs -= BigInt(skips) * bits
              }
            }
            bufs -= bits
          }
        }
      }
    })
    return builder.build()
  }

  /**
   * @param {File} file 
   * @returns {BlockImage | HTMLImageElement}
   */
  static readZip(file) {
    throw 'not implemented'
  }

}

class ImageReaders {
  /**
   * @param {File} file 
   * @returns {Promise<HTMLImageElement>}
   */
  static readFile(file) {
    return new Promise((res, rej) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          this.readURL(reader.result).then(res, rej)
        } else {
          rej('file did not resolve to string')
        }
      }
      reader.onerror = () => rej('Failed to read file.')
      reader.readAsDataURL(file)
    })
  }

  /**
   * @param {string} str 
   * @returns {Promise<HTMLImageElement>}
   */
  static readURL(str) {
    return new Promise((res, rej) => {
      const img = new Image()
      img.crossOrigin = 'anonymous' // Allow cross-origin access if needed
      img.onload = () => res(img)
      img.onerror = () => rej('Failed to load image from URL.')
      img.src = str
    })
  }

}

class BlockImageBuilder {
  /** @readonly */ static WATER_MASK = (1 << 10) - 1 // deepest water color
  /** @type {Record<string, number | { if: string, is: string, then: number, else: number }>} */ static map
  /** @type {{ [key: number]: number }} */ static pre13map // index = data_id << 8 | block_id
  /** @readonly @type {Uint8Array} */ blocks
  /** @readonly @type {Int16Array} */ heights
  /** @readonly @type {Int16Array} */ waters // bitfield map, 1 for top, 2 for second top, 4 for third...
  /** @readonly @type {number} */ width
  /** @readonly @type {number} */ height

  static async load() {
    const block2color = fetch('src/block2color.json').then(res => res.json())
    const pre13map = fetch('src/pre13color.json').then(res => res.json())
    this.map = await block2color
    this.pre13map = await pre13map
  }

  /**
   * @param {PaletteNbt} palette 
   * @returns {Uint8Array}
   */
  static readMcPalette(palette) {
    return Uint8Array.from(palette, b => {
      if (!b.Name?.startsWith('minecraft:')) return 0
      const r = this.map[b.Name.slice(10)]
      if (!r) return 0
      return typeof r === 'number' ? r : (b.Properties?.[r.if] == r.is ? r.then : r.else)
    })
  }

  /**
   * @param {Int8Array} blockIds 
   * @param {Int8Array} dataIds 
   * @returns {Uint8Array}
   */
  static readSchematicIndexes(blockIds, dataIds) {
    if (blockIds.length !== dataIds.length) throw `length doesn't match (${blockIds.length}, ${dataIds.length})`
    const datas = Uint8Array.from(dataIds)
    return Uint8Array.from(blockIds).map((v, i) => this.pre13map[datas[i] << 8 | v] || 0)
  }

  /**
   * @param {number} width 
   * @param {number} height 
   */
  constructor(width, height) {
    this.width = width
    this.height = height
    const size = width * height
    this.blocks = new Uint8Array(size)
    this.heights = new Int16Array(size).fill(-32000)
    this.waters = new Int16Array(size)
  }

  /**
   * @param {number} x 
   * @param {number} y 
   * @param {number} z 
   * @param {number} color 
   */
  putPos(x, y, z, color) {
    if (!color) return // transparent
    if (x < 0 || x >= this.width || z < 0 || z >= this.height) return
    this.putIndex(z * this.width + x, y, color)
  }

  /**
   * @param {number} index 
   * @param {number} y 
   * @param {number} color 
   */
  putIndex(index, y, color) {
    if (!color) return // transparent
    if (index < 0 || index > this.blocks.length) return
    if (color !== 12) {
      if (this.heights[index] < y) {
        this.blocks[index] = color
        this.heights[index] = y
        this.waters[index] = 0
      }
    } else { // water
      const dy = this.heights[index] - y
      if (dy < 0) {
        this.heights[index] = y
        this.blocks[index] = 0
        if (-dy > 10) {
          this.waters[index] = 1
        } else {
          const w = this.waters[index]
          if (w) {
            this.waters[index] = (w << -dy) & BlockImageBuilder.WATER_MASK | 1
          } else {
            this.waters[index] = 1
          }
        }
      } else if (dy < 10 && this.waters[index] && !this.blocks[index]) {
        this.waters[index] |= 1 << dy
      }
    }
  }

  /**
   * @returns {BlockImage}
   */
  build() {
    const heightSet = new Set(this.heights)
    const isFlat = heightSet.size === 1
    const topY = isFlat ? heightSet[Symbol.iterator]().next().value : -32000
    const getSlope = index => Math.sign(this.heights[index] - (this.heights[index - this.width] ?? topY)) + 1
    let res = this.blocks.map((v, i) => v * 4 + getSlope(i))

    const hasTopRow = this.width % 128 === 0 && this.height % 128 === 1
    const waterSet = new Set(hasTopRow ? this.waters.subarray(this.width) : this.waters)
    waterSet.delete(0)
    if (waterSet.size) {
      const isStair = (() => {
        // staircase won't have multiple depths
        if (waterSet.size !== 1) return false

        // staircase won't have depths more than two (single and double mode)
        if (waterSet[Symbol.iterator]().next().value > 2) return false

        // slope detection
        if (!isFlat && this.waters.some((v, i) => {
          if (!v) return false
          const h = this.heights[i]
          const ni = i - this.width
          const hn = this.heights[ni]
          if (hn > h) { // north is higher
            if (this.waters[ni]) return true // unnecessary in depth mode
            if (this.heights[ni - this.width] > hn) return true // north north is higher than north, unnecessary in depth mode
          } else {
            if (h > hn && this.waters[i + this.width]) return true // water down slope, unnecessary in depth mode
          }
        })) return true

        // technically i can also check if the source of water has block near it, but too lazy

        // ask user for help
        return confirm(`
          The application is unsure that if this blueprint's water should be treated as staircase or depth.
          Choose OK for staircase, cancel for depth.
          The waters generated from rebane2001/mapcraft are staircase.
          This website generates depth, which is the correct way for minecraft to render.
        `.trim().replace(/^\s*/gm, '  '))
      })()

      console.log(`building water color in ${isStair ? 'staircase' : 'depth'} mode.`)
      if (isStair) {
        this.waters.forEach(isFlat ? (v, i) => {
          if (v && !this.blocks[i]) {
            res[i] = 49
          }
        } : (v, i) => {
          if (v && !this.blocks[i]) {
            res[i] = 48 + getSlope(i)
          }
        })
      } else {
        const WATER_DEPTH_2 = (1 <<  3) - 1 // LIGHT / MID
        const WATER_DEPTH_3 = (1 <<  5) - 1 // MID
        const WATER_DEPTH_4 = (1 <<  7) - 1 // MID / DARK
        const WATER_DEPTH_5 = (1 << 10) - 1 // DARK
        const rcpWidth = 1 / this.width
        /** @type {(i: number) => boolean | number} */
        const isShallow = hasTopRow
        ? ((this.width & 1) ? (i =>   i & 1 ) : (i =>   (i + i * rcpWidth) & 1 ))
        : ((this.width & 1) ? (i => !(i & 1)) : (i => !((i + i * rcpWidth) & 1)))
        this.waters.forEach((v, i) => {
          if (v && !this.blocks[i]) {
            if (isShallow(i)) {
              if ((v & WATER_DEPTH_5) === WATER_DEPTH_5) {
                res[i] = 48
              } else if ((v & WATER_DEPTH_3) === WATER_DEPTH_3) {
                res[i] = 49
              } else {
                res[i] = 50
              }
            } else {
              if ((v & WATER_DEPTH_4) === WATER_DEPTH_4) {
                res[i] = 48
              } else if ((v & WATER_DEPTH_2) === WATER_DEPTH_2) {
                res[i] = 49
              } else {
                res[i] = 50
              }
            }
          }
        })
      }
    }

    if (hasTopRow) {
      res = res.subarray(this.width)
    }
    return new BlockImage(this.width, hasTopRow ? this.height - 1 : this.height, res)
  }

}

class BlockImage {
  /** @readonly @type {Uint8Array} */ static colors = new Uint8Array(64 * 4 * 3) // 64 colors -> 4 brightness -> rgb
  /** @readonly @type {number} */ width 
  /** @readonly @type {number} */ height 
  /** @readonly @type {Uint8Array} */ data // same as MapDatNbt.data.colors but unsigned and unlimited length

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

}
