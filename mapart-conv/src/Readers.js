//@ts-check
/// <reference path = "../index.d.ts"/>

class Readers {

  static async load() {
    await Promise.allSettled([BlockImageBuilder.load(), BlockImage.load(), BlockPalette.load()])
  }

  /**
   * @param {DataTransferItemList | null | undefined} items 
   * @param {ITask} task 
   * @returns {Promise<BaseImage?>}
   */
  static async readItems(items, task) {
    if (!items) return null
    for (const item of items) {
      if (item.type === 'text/plain') { // urls
        return new Promise(res => {
          item.getAsString(async str => res(str.startsWith('https://rebane2001.com/mapartcraft/?preset=') ? null : await ImageReaders.readURL(str)))
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
          case 'nbt':
            return this.readStructure(() => NBT.read(file), task, file.name)
          case 'schematic':
            return this.readSchematic(() => NBT.read(file), task, file.name)
          case 'dat':
            return this.readMapDat(() => NBT.read(file), task, file.name)
          case 'litematic':
            return this.readLitematic(() => NBT.read(file), task, file.name)
          case 'zip': {
            return this.readZip(file, task)
          }
        }
      }
    }
    return null
  }

  /**
   * @param {() => Promise<NBT.NBTData>} reader 
   * @param {ITask} task 
   * @param {string?} filename 
   * @returns {Promise<BlockImage>}
   */
  static async readStructure(reader, task = ITask.DUMMY, filename = null) {
    await task.push('Reading as structure', 3)
    await task.force().swap('Reading nbt')
    /** @type {StructureNbt} *///@ts-ignore
    const root = await reader()
    const palette = BlockImageBuilder.readMcPalette(root.data.palette)
    const builder = new BlockImageBuilder(root.data.size[0].valueOf(), root.data.size[2].valueOf())
    await task.push('Reading blocks', root.data.blocks.length)
    for (const [i, b] of root.data.blocks.entries()) {
      await task.progress256(i)
      builder.putPos(b.pos[0].valueOf(), b.pos[1].valueOf(), b.pos[2].valueOf(), palette[b.state.valueOf()])
    }
    task.pop()
    await task.force().swap('Building image')
    const img = await builder.build()
    await task.force().swap('Reading metadata')
    if (filename) {
      img.description = `From ${filename}`
      img.filename = filename.slice(0, -'.nbt'.length)
    }
    if (root.data.author) {
      img.author = `${root.data.author}`
    }
    task.pop()
    return img
  }

  /**
   * @param {() => Promise<NBT.NBTData>} reader 
   * @param {ITask} task 
   * @param {string?} filename 
   * @returns {Promise<BlockImage>}
   */
  static async readSchematic(reader, task = ITask.DUMMY, filename = null) {
    await task.push('Reading as schematic', 3)
    await task.force().swap('Reading nbt')
    /** @type {SchematicNbt} *///@ts-ignore
    const root = await reader()
    const w = root.data.Width.valueOf()
    const h = root.data.Height.valueOf()
    const l = root.data.Length.valueOf()
    if (w * h * l !== root.data.Data.length) throw `size doesn't match (${w}, ${h}, ${l}, ${w * h * l}, ${root.data.Data.length})`
    const data = BlockImageBuilder.readSchematicIndexes(root.data.Blocks, root.data.Data)
    const builder = new BlockImageBuilder(root.data.Width.valueOf(), root.data.Length.valueOf())
    const area = w * l
    await task.push('Reading blocks', h)
    for (let y = 0; y < h; y++) {
      await task.progress(y)
      data.subarray(y * area, y * area + area).forEach((c, i) => builder.putIndex(i, y, c))
    }
    task.pop()
    await task.force().swap('Building image')
    const img = await builder.build()
    await task.force().swap('Reading metadata')
    if (filename) {
      img.description = `From ${filename}`
      img.filename = filename.slice(0, -'.schematic'.length)
    }
    task.pop()
    return img
  }

  /**
   * @param {() => Promise<NBT.NBTData>} reader 
   * @param {ITask} task 
   * @param {string?} filename 
   * @returns {Promise<BlockImage>}
   */
  static async readMapDat(reader, task = ITask.DUMMY, filename = null) {
    await task.push('Reading as dat', 2)
    await task.force().swap('Reading nbt')
    /** @type {MapDatNbt} *///@ts-ignore
    const root = await reader()
    const data = new Uint8Array(16384)
    await task.force().swap('Reading colors')
    data.set(root.data.data.colors)
    const img = new BlockImage(128, 128, data)
    await task.force().swap('Reading metadata')
    if (filename) {
      img.description = `From ${filename}`
      img.filename = filename.slice(0, -'.dat'.length)
    }
    task.pop()
    return img
  }

  /**
   * @param {() => Promise<NBT.NBTData>} reader 
   * @param {ITask} task 
   * @param {string?} filename 
   * @returns {Promise<BlockImage>}
   */
  static async readLitematic(reader, task = ITask.DUMMY, filename = null) {
    await task.push('Reading as litematic', 4)
    await task.force().swap('Reading nbt')
    /** @type {LitematicNbt} *///@ts-ignore
    const root = await reader()
    const regions = Object.values(root.data.Regions)
    if (regions.length === 0) throw `no regions`
    await task.force().push('Reading region sizes', regions.length)
    
    let minx = Infinity
    let miny = Infinity
    let minz = Infinity
    let maxx = -Infinity
    let maxy = -Infinity
    let maxz = -Infinity
    for (const region of regions) {
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
      await task.progress()
    }
    task.pop()
    const size = {
      x: maxx - minx,
      y: maxy - miny,
      z: maxz - minz,
    }
    if (size.x <= 0 || size.y <= 0 || size.z <= 0) throw `invalid size (${size.x}, ${size.y}, ${size.z})`

    await task.force().push('Reading regions', regions.length)
    const builder = new BlockImageBuilder(size.x, size.z)
    for (const region of regions) {
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
      await task.push('Reading layers', abssy)
      outer:
      for (let y = 0; y < abssy; y++) {
        let absy = dy + y
        for (let z = 0; z < abssz; z++) {
          let toIndex = (dz + z) * size.x + dx
          for (let x = 0; x < abssx; x++) {
            if (bufs < bits) {
              if (i < states.length) {
                buf |= states[i++] << bufs
              } else if (buf === 0n) {
                break outer
              }
              bufs += 64n
            }
            if (buf !== 0n) {
              const pi = buf & bitmask
              if (pi !== 0n) {
                builder.putIndex(toIndex + x, absy, palette[Number(pi)])
              }
              buf >>= bits
            } else {
              while (states[i] === 0n) {
                i++
                bufs += 64n
              }
              const skips = bufs / bits - 1n
              if (skips > 0n) {
                x += Number(skips)
                bufs -= skips * bits
                if (x >= abssx) {
                  z += Math.floor(x / abssx)
                  if (z >= abssz) {
                    y += Math.floor(z / abssz)
                    if (y >= abssy) break outer
                    absy = dy + y
                    z %= abssz
                  }
                  toIndex = (dz + z) * size.x + dx
                  x %= abssx
                }
              }
            }
            bufs -= bits
          }
        }
        await task.progress(y + 1)
      }
      task.pop()
    }
    task.pop()
    await task.force().swap('Building image')
    const img = await builder.build()
    await task.force().swap('Reading metadata')
    if (filename) {
      img.description = `From ${filename}`
      img.filename = filename.slice(0, -'.litematic'.length)
    }
    const meta = root.data.Metadata
    if (meta) {
      if (meta.Name) {
        img.name = `${meta.Name}`
      }
      if (meta.Author) {
        img.author = `${meta.Author}`
      }
      if (meta.Description) {
        img.description = `${meta.Description}`
      }
      if (meta.TimeCreated) {
        /** @type {*} */
        const time = meta.TimeCreated
        if (typeof time === 'bigint') {
          img.timeCreated = time
        } else if (typeof time === 'number') {
          img.timeCreated = BigInt(time < 1e10 ? time * 1000 : time)
        }
      }
    }
    task.pop()
    return img
  }

  /**
   * @param {File} file 
   * @param {ITask} task 
   * @returns {Promise<BlockImage>}
   */
  static async readZip(file, task = ITask.DUMMY) {
    await task.push('Reading zip file', 4)
    await task.force().swap('Deserializing')
    const zip = await JSZip.loadAsync(file)
    await task.force().swap('Determining file type')
    console.log('zip:', zip)
    /** @type {string[][]} */
    const matches = []
    for (const [name, file] of Object.entries(zip.files)) {
      if (file.dir) continue
      const match = name.match(/^(.*\D)?(\d+|x|row)[^A-Za-z0-9](\d+)\.(nbt|schematic|dat|litematic)$/)
      if (match) {
        if (match[2] === 'row') match[2] = 'x'
        matches.push(match)
      }
    }
    if (matches.length === 0) {
      /** @type {number[]} */
      const dats = []
      let max = 0
      for (const [name, file] of Object.entries(zip.files)) {
        if (file.dir) continue
        const match = name.match(/^map_(\d+)\.dat$/)
        if (match) {
          const id = parseInt(match[1])
          dats.push(id)
          if (id > max) max = id
        }
      }
      if (dats.length > 0) {
        if (max > 999 && dats.length * 3 < max) {
          dats.sort((a, b) => a - b)
          const width = Math.min(dats.length, 1 << Math.max(4, Math.ceil(Math.log2(Math.sqrt(dats.length)))))
          for (const [index, id] of dats.entries()) {
            matches.push([`map_${id}.dat`, 'map_', `${index % width}`, `${Math.floor(index / width)}`, 'dat'])
          }
        } else {
          const width = Math.min(dats.length, 1 << Math.max(4, Math.ceil(Math.log2(Math.sqrt(max)))))
          for (const id of dats) {
            matches.push([`map_${id}.dat`, 'map_', `${id % width}`, `${Math.floor(id / width)}`, 'dat'])
          }
        }
      }
    }
    console.log('matches:', matches)
    if (matches.length === 0) {
      throw new Error('no match result')
    }
    /** @type {{ [prefix: string]: number }} */
    const counts = {}
    for (const [, pref] of matches) {
      counts[pref] = (counts[pref] ?? 0) + 1
    }
    console.log('counts:', counts)
    const max = Object.entries(counts).sort((a, b) => a[1] - b[1]).at(-1)?.[0] ?? null
    console.log('max:', max)
    if (max == null) {
      throw new Error('no mapart found in zip')
    }

    await task.push('Reading files', matches.filter(m => m[1] === max).length)

    /** @type {{ [name: string]: BlockImage }} */
    const data = {}
    const promises = []
    let minX = Infinity
    let minY = 0
    let maxX = 0
    let maxY = 0
    let maxWildRowWidth = 128
    /** @type {Set<number>} */
    const Ws = new Set()
    /** @type {Set<number>} */
    const Hs = new Set()
    for (const [name, pref, x, y, type] of matches) {
      if (pref !== max) continue
      if (x !== 'x') {
        const nx = parseInt(x)
        if (nx < minX) minX = nx
        if (nx > maxX) maxX = nx
      }
      const ny = parseInt(y)
      if (ny < minY) minY = ny
      if (ny > maxY) maxY = ny
      promises.push(new Promise(async (res, rej) => {
        const reader = () => zip.files[name].async('arraybuffer').then(buf => NBT.read(buf))
        switch (type) {
          case 'nbt':
            res(this.readStructure(reader))
            break
          case 'schematic':
            res(this.readSchematic(reader))
            break
          case 'dat':
            res(this.readMapDat(reader))
            break
          case 'litematic':
            res(this.readLitematic(reader))
            break
          default:
            rej()
        }
      }).then((/** @type {BlockImage} */ res) => {
        data[`${x},${y}`] = res
        if (x !== 'x') {
          Ws.add(res.width)
        } else {
          if (res.width > maxWildRowWidth) maxWildRowWidth = res.width
        }
        Hs.add(res.height)
        return task.progress()
      }))
    }
    await Promise.allSettled(promises)
    task.pop()
    console.log('data:', data)
    const size = Object.values(data).length
    if (size === 0) {
      throw new Error('no data loaded')
    }
    await task.force().push('Combining data', size)
    if (minX > maxX) minX = maxX
    let unitW = 128
    let unitH = 128
    if (Ws.size === 1) {
      unitW = firstValue(Ws)
    }
    if (Hs.size === 1) {
      unitH = firstValue(Hs)
    }
    const width = Math.max((maxX - minX + 1) * unitW, maxWildRowWidth)
    const height = (maxY - minY + 1) * unitH
    const res = new Uint8Array(width * height)
    for (const [pos, { width: iw, height: ih, data: idat }] of Object.entries(data)) {
      const h = Math.min(unitH, ih)
      const w = Math.min(pos.startsWith('x,') ? width : unitW, iw)
      const sp = pos.split(',')
      const x = sp[0] === 'x' ? 0 : parseInt(sp[0])
      const y = parseInt(sp[1])
      const orig = y * unitH * width + x * unitW
      for (let y = 0; y < h; y++) {
        const i = y * iw
        res.set(idat.subarray(i, i + w), orig + y * width)
      }
      await task.progress()
    }
    task.pop()
    const img = new BlockImage(width, height, res)
    await task.force().swap('Reading metadata')
    const main = data[`${minX},${minY}`] ?? data[`x,${minY}`] ?? Object.values(data)[0]
    img.filename = (/[^A-Za-z]$/.test(max) ? max.slice(0, -1) : max) || img.filename
    img.name = main.name || Object.values(data).find(img => img.name)?.name || null
    img.author = main.author || Object.values(data).find(img => img.author)?.author || img.author
    img.description = main.description?.trim() || Object.values(data).find(img => img.description?.trim())?.description?.trim() || null
    img.timeCreated = Object.values(data).map(img => img.timeCreated).reduce((p, v) => p < v ? p : v, img.timeCreated)
    task.pop()
    return img
  }

}

class ImageReaders {
  /**
   * @param {File} file 
   * @returns {Promise<RGBAImage>}
   */
  static readFile(file) {
    return new Promise((res, rej) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          this.readURL(reader.result, file.name.replace(/\.\w+$/, '')).then(res, rej)
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
   * @returns {Promise<RGBAImage>}
   */
  static readURL(str, name = str.startsWith('data:') ? null : str.match(/(?<=[\\/])[^\\/]+?(?:\.\w+)?$/)?.[1] ?? null) {
    return new Promise((res, rej) => {
      const img = new Image()
      img.crossOrigin = 'anonymous' // Allow cross-origin access if needed
      img.onload = () => res(RGBAImage.from(img, name))
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
  #hasTransparent = false

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
    if (!color) {
      this.#hasTransparent = true
      return // transparent (not air)
    }
    if (x < 0 || x >= this.width || z < 0 || z >= this.height) return
    this.#putInternal(z * this.width + x, y, color)
  }

  /**
   * @param {number} index 
   * @param {number} y 
   * @param {number} color 
   */
  putIndex(index, y, color) {
    if (!color) {
      this.#hasTransparent = true
      return // transparent (not air)
    }
    if (index < 0 || index > this.blocks.length) return
    this.#putInternal(index, y, color)
  }

  /**
   * @param {number} index 
   * @param {number} y 
   * @param {number} color 
   */
  #putInternal(index, y, color) {
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
   * @returns {Promise<BlockImage>}
   */
  async build() {
    const heightSet = new Set(this.heights)
    const isFlat = heightSet.size === 1
    const topY = isFlat ? firstValue(heightSet) : -32000
    const getSlope = index => Math.sign(this.heights[index] - (this.heights[index - this.width] ?? topY)) + 1
    let res = this.blocks.map((v, i) => v * 4 + getSlope(i))

    const hasTopRow = (this.width % 128 === 0 && this.height % 128 === 1) || this.heights.slice(0, this.width).every(v => v < -640)
    const waterSet = new Set(hasTopRow ? this.waters.subarray(this.width) : this.waters)
    waterSet.delete(0)
    if (waterSet.size) {
      const isStair = (() => {
        // staircase won't have multiple depths
        if (waterSet.size !== 1) return false

        // staircase won't have depths more than two (single and double mode)
        if (firstValue(waterSet) > 2) return false

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

        // technically i can also check if the source of water has block near it, but too lazy.
        // if the depth mode generator decides to put non-transparent block at the bottom of water,
        // we might actually need to check for all neighbors.
        // don't try to detect the block under it, because the staircase mode generator might also place it.

        return !this.#hasTransparent
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

/**
 * @template T
 * @param {Iterable<T>} iterable 
 * @returns {T}
 */
function firstValue(iterable) {
  return iterable[Symbol.iterator]().next().value
}
