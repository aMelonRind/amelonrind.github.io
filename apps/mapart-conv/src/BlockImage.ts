import * as NBT from "../../../lib/nbtify/src/index.js";
import rawcolors from "./data/colors.json";
import rawpalette from "./data/palette.json";
import { paletteUrlInput } from "../app.jsx";
import BaseImage from "./BaseImage.ts";
import Form, { FormOptions, FormQuery, t } from "./Form.tsx";
import { BlockImageBuilder } from "./Readers.ts";
import TaskManager, { ITask } from "./TaskManager.ts";
import { around, downloadBlob, requireNonNull } from "../../../lib/util.ts";
import { ColorProfile, LongArrBuilder, memory, WasmU16Counter } from "./wasm_loader.ts";
import { NbtDataResult, PaletteNbt } from "../../types.ts";

export default class BlockImage extends BaseImage {
  static readonly colorProfile = ColorProfile.new(Uint32Array.from(rawcolors))
  /** 64 colors -> 4 brightness -> rgb */ static readonly colors: Uint8Array =
    new Uint8Array(memory.buffer, this.colorProfile.palette(), 64 * 4 * 3).slice()
  readonly width: number 
  readonly height: number 
  /** same as MapDatNbt.data.colors but unsigned and unlimited length */ readonly data: Uint8Array

  constructor(width: number, height: number, data: Uint8Array) {
    super()
    if (width * height !== data.length) throw `invalid length (${width}, ${height}, ${width * height}, ${data.length})`
    this.width = width
    this.height = height
    this.data = data
  }

  getImageData() {
    const res = new Uint8ClampedArray(BlockImage.colorProfile.paint(this.data))
    return new ImageData(res, this.width, this.height)
  }

  async download() {
    const u8a = BlockImage.colorProfile.create_indexed_png(this.width, this.height, this.data, 9)
    downloadBlob(`${this.filename ?? 'unnamed'}.png`, new Blob([Uint8Array.from(u8a)], { type: 'image/png' }))
  }

  getWidth() {
    return this.width
  }

  getHeight() {
    return this.height
  }

  isBlock(): this is BlockImage {
    return true
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
   */
  splitRows(): BlockImage[] {
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
   */
  split1x1(): BlockImage[] {
    if (this.width === 128 && this.height === 128) return [this]
    const res = []
    for (let y = 0; y < this.height; y += 128) {
      for (let x = 0; x < this.width; x += 128) {
        const orig = y * this.width + x
        const w = Math.min(128, this.width - x)
        const h = Math.min(128, this.height - y)
        const sub = new Uint8Array(16384)
        for (let iy = 0; iy < h; iy++) {
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

  /** @see MapDatNbt */
  async toDat(): Promise<NbtDataResult> {
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
      data: await NBT.write(nbt, { endian: 'big', compression: 'gzip' })
    }
  }

  async #buildPalettedBlocks(palette: BlockPalette, task = ITask.DUMMY): Promise<Uint16Array[]> {
    const mask = ~3
    await task.force().push('Building Paletted Blocks', 8)

    const len = this.data.length
    const data = new Uint8Array(len)
    data.set(this.data)
    const blockColors = new Set(data)

    await task.force().swap('Sanitizing transparents')
    for (let i = 0; i < len; i++) {
      if ((data[i] & mask) === 0 && data[i]) {
        data[i] = 0
      }
    }

    await task.force().swap('Checking for invalid 4th color')
    for (const v of blockColors) {
      if ((v & 3) === 3) {
        await ConfirmCache.send('buildPalettedBlocks.invalid4thcolor', {}, {
          title: () => t('form.invalid_4th_color.title'),
          description: () => t('form.invalid_4th_color.description')
        }).catch(() => {
          throw 'task cancelled'
        })
        for (let i = 0; i < len; i++) {
          if ((data[i] & 3) === 3) {
            data[i] &= mask
          }
        }
        for (const v of blockColors) {
          if ((v & 3) === 3) {
            blockColors.add(v & mask)
            blockColors.delete(v)
          }
        }
        break
      }
    }

    await task.force().swap('Checking color under transparents')
    for (let i = this.width; i < len; i++) {
      // not empty && north is empty && varient is not light && is not water
      if (data[i] && !data[i - this.width] && (data[i] & 3) < 2 && (data[i] >> 2) !== 12) {
        const { replace } = await ConfirmCache.send('buildPalettedBlocks.invalidDarkAtTop', {
          replace: {
            type: 'boolean',
            storeLast: true,
            label: () => t('form.invalid_dark_top.checkbox.label'),
            default: true,
            tooltip: () => t('form.invalid_dark_top.checkbox.tooltip')
          }
        }, {
          title: () => t('form.invalid_dark_top.title'),
          description: () => t('form.invalid_dark_top.description')
        }).catch(() => {
          throw 'task cancelled'
        })
        if (replace) {
          for (; i < len; i++) {
            if (data[i] && !data[i - this.width] && (data[i] & 3) < 2 && (data[i] >> 2) !== 12) {
              data[i] = data[i] & mask | 2
            }
          }
        }
        break
      }
    }

    await task.force().swap('Separating data')
    // extract the lightness for convenience
    const dys = new Uint8Array(len)
    // separate water data for convenience
    const waterData = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      dys[i] = data[i] & 3
      if (data[i] >> 2 === 12) {
        waterData[i] = data[i]
        data[i] = 0
      }
    }
    const waterHeights: readonly number[] = [10, 5, 1]

    // const blockTypes = new Set(Uint8Array.from(blockColors, v => v >>> 2))
    const heights = new Uint16Array(len)
    let maxY = 0

    await task.force().push('Converting stairs by columns', this.width)
    await task.swap('column')
    for (let col = 0; col < this.width; col++) {
      await task.progress(col)
      // let's assume a valley look like this
      // ....z positive -->....
      // ...■■■................
      // .■■...■.........■■■■..
      // ■......■■....■■■....■■
      // .........■■■■.........
      for (let z = col; z < len; z += this.width) {
        // finds the lowest point of a valley
        // ......................
        // ...■■■.....here......or here if this is the tail (south is transparent or water)
        // .■■...■.....V...■■■■.V
        // ■......■■...V■■■....■■
        // .........■■■■.........
        if (data[z] && (dys[z + this.width] === 2 || !data[z + this.width])) {
          for (let i = z - this.width, south = z;; south = i, i -= this.width) { // trace backwards
            // preserve space for support block
            if (heights[south] === 0 && data[south] && BlockPalette._needSupportBlock.has(BlockState.getId(palette.source[data[south] >> 2]))) {
              heights[south] = 1
              for (let j = south + this.width; dys[j] === 1 && data[j]; j += this.width) {
                heights[j] = 1
              }
            }
            // breaks on transparent or lower block
            // .here.................
            // ..V■■■................
            // .■■...■.........■■■■..
            // ■......■■....■■■....■■
            // .........■■■■.........
            if (!data[i] || dys[south] === 2) {
              // if there's water, we might need to move the whole thing up or make the water high up.
              // ...VVV if the water is too high that it touches the ground,
              // ...■■■................  we need to move these three blocks up to make space for water.
              // .■w...■.........■■■■..  because the lightness on blocks depends on the relative height of the north.
              // ■.w....■■....■■■....■■  unless the lightness of the south one is dark, in that case, water might needs to be moved up.
              // ..water..■■■■.........
              if (waterData[i]) {
                data[i] = waterData[i]
                waterData[i] = 0
                const southIsBright = dys[south] === 2
                const wh = waterHeights[dys[i]] // the least height needed for this water
                heights[i] = southIsBright ? wh : Math.max(wh, heights[south] + 1 - (data[south] & 1))

                const southDy = dys[south]
                // fix the blocks at the south, as mentioned of the three blocks in the comment above
                let fixY = 0
                if (southDy === 1 && heights[south] !== heights[i]) {
                  fixY = heights[i]
                } else if (southDy === 2 && heights[south] <= heights[i]) {
                  fixY = heights[i] + 1
                }
                if (fixY) {
                  heights[south] = fixY
                  for (let j = south + this.width; dys[j] === 1 && data[j]; j += this.width) {
                    heights[j] = fixY
                  }
                }
              }
              maxY = Math.max(maxY, heights[i] ?? (dys[south] === 0 ? heights[south] + 1 : 0), heights[south])
              break
            }
            heights[i] = Math.max(heights[i], heights[south] + 1 - dys[south])
          }
          for (let i = z + this.width, north = z;; north = i, i += this.width) { // trace forwards
            // break on transparent or lower block (dark)
            // ...................here
            // ...■■■..............V.
            // .■■...■.........■■■■V.
            // ■......■■....■■■....■■
            // .........■■■■.........
            if (!dys[i] || !data[i]) {
              // "why don't we process water here?" you might ask.
              // nope, water doesn't care about relative height. it only cares about itself (depth).
              if (heights[north] > maxY) maxY = heights[north]
              z = north
              break
            }
            heights[i] = heights[north] - 1 + dys[i]
          }
        }
      }
    }
    task.pop()

    await task.force().swap('Combining data')
    // put the water data back
    for (let i = 0; i < len; i++) {
      if (!waterData[i]) continue
      data[i] = waterData[i]
      heights[i] = waterHeights[dys[i]]
      if (heights[i] > maxY) maxY = heights[i]
    }

    await task.force().swap('Constructing layers')
    const Constants = BlockPalette.CONSTANTS
    const layerSize = this.width * (this.height + 1)
    const layers = Array.from({ length: maxY + 1 }, () => new Uint16Array(layerSize))
    
    for (let i = 0; i < this.width; i++) {
      if (data[i] && (data[i] >> 2) !== 12 && dys[i] < 2) {
        layers[heights[i] + 1 - dys[i]][i] = palette.getOrAssignIndex(Constants.STONE)
      }
    }
    const cropped = layers.map(arr => arr.subarray(this.width))
    function putTransparentAround(layer: Uint16Array, width: number, i: number, gen = around) {
      for (const n of gen(layer.length, width, i)) {
        layer[n] ||= palette.getOrAssignIndex(Constants.TRANSPARENT_BLOCK)
      }
    }
    const nsbCache: Record<number, boolean> = {}
    const epCache: Record<number, boolean> = {}
    for (let i = 0; i < len; i++) {
      if (data[i]) {
        const id = data[i] >> 2
        if (id !== 12) {
          const h = heights[i]
          cropped[h][i] = palette.getOrAssignIndexByColor(id)
          if (nsbCache[id] ??= BlockPalette._needSupportBlock.has(BlockState.getId(palette.source[id]))) {
            cropped[h - 1][i] = palette.getOrAssignIndex(Constants.STONE)
          }
          if (epCache[id] ??= BlockPalette._endermanPickables.has(BlockState.getId(palette.source[id]))) {
            putTransparentAround(layers[h], this.width, i + this.width)
          }
        } else { // water
          let h = heights[i]
          const mh = Math.max(0, h - waterHeights[dys[i]]) + 1
          cropped[h][i] = palette.getOrAssignIndex(Constants.WATER)
          putTransparentAround(layers[h], this.width, i + this.width)
          while (h > mh) {
            cropped[--h][i] = palette.getOrAssignIndex(Constants.FALLING_WATER)
          }
          putTransparentAround(layers[h], this.width, i + this.width)
          cropped[h - 1][i] = palette.getOrAssignIndex(Constants.TRANSPARENT_BLOCK)
        }
      } else { // detect south, scaffolding
        const s = i + this.width
        if (data[s] && dys[s] < 2 && (data[s] >> 2) !== 12) {
          cropped[heights[s] + 1 - dys[s]][i] = palette.getOrAssignIndex(Constants.SCAFFOLDING)
        }
      }
    }
    await palette.performBlockUpdates(layers, this.width, task)
    palette.flush()
    task.pop()
    return layers
  }

  /** @see StructureNbt */
  async toStructure(task = ITask.DUMMY): Promise<NbtDataResult> {
    const palette = BlockPalette.fromRebaneUrlInput()
    await task.force().push('Converting to structure', 3)
    const layers = await this.#buildPalettedBlocks(palette, task)
    const { nbt: paletteNbt, map } = palette.optimize(layers)
    const blocks: NBT.ListTag<{ pos: NBT.Vec3iTuple; state: NBT.Int32} > = []
    await task.push('Building by layers', layers.length)
    await task.force().swap('layers')
    for (const [y, layer] of layers.entries()) {
      await task.progress(y)
      layer.forEach((v, i) => {
        if (map[v]) {
          blocks.push({
            pos: [new NBT.Int32(i % this.width), new NBT.Int32(y), new NBT.Int32(Math.floor(i / this.width))],
            state: new NBT.Int32(map[v] - 1)
          })
        }
      })
    }
    task.pop()
    const nbt = new NBT.NBTData({
      blocks,
      entities: [],
      palette: paletteNbt.slice(1),
      size: [new NBT.Int32(this.width), new NBT.Int32(layers.length), new NBT.Int32(this.height + 1)],
      author: this.author,
      DataVersion: new NBT.Int32(3464)
    })
    await task.force().swap('Writing nbt')
    const data = await NBT.write(nbt, { endian: 'big', compression: 'gzip' })
    task.pop()
    return { name: this.part ? `${this.filename}_${this.part}.nbt` : `${this.filename}.nbt`, data }
  }

  /**
   * see WidgetSchematicBrowser.java#L295
   * basically, ARGB array with squared size.
   * optimally, size should not exceed 156x156. (not 256, it's not a typo)
   */
  #generateLitematicaPreview() {
    let imageData = this.getImageData()
    let long = Math.max(imageData.width, imageData.height)
    if (long > 156) {
      const w = Math.round(imageData.width / long * 156)
      const h = Math.round(imageData.height / long * 156)
      const orig = new OffscreenCanvas(imageData.width, imageData.height)
      requireNonNull(orig.getContext('2d')).putImageData(imageData, 0, 0)
      const ctx = requireNonNull(new OffscreenCanvas(w, h).getContext('2d'))
      ctx.drawImage(orig, 0, 0, w, h)
      imageData = ctx.getImageData(0, 0, w, h)
      long = 156
    }
    const preview = new Int32Array(imageData.width * imageData.height)
    preview.forEach((_, i) => {
      preview[i] = (imageData.data[i * 4 + 3] << 24)
      | (imageData.data[i * 4] << 16)
      | (imageData.data[i * 4 + 1] << 8)
      | imageData.data[i * 4 + 2]
    })
    if (imageData.width !== imageData.height) {
      const squared = new Int32Array(long * long)
      if (long > imageData.height) {
        squared.set(preview, Math.floor((long - imageData.height) / 2) * long)
      } else {
        const x = Math.floor((long - imageData.width) / 2)
        for (let y = 0; y < long; y++) {
          squared.set(preview.subarray(y * imageData.width, y * imageData.width + imageData.width), y * long + x)
        }
      }
      return squared
    }
    return preview
  }

  /** @see LitematicNbt */
  async toLitematic(task = ITask.DUMMY): Promise<NbtDataResult> {
    const palette = BlockPalette.fromRebaneUrlInput()
    await task.force().push('Converting to litematic', 3)
    const layers = await this.#buildPalettedBlocks(palette, task)
    const { nbt: paletteNbt, map } = palette.optimize(layers)

    await task.push('Building by layers', layers.length)
    const volume = this.width * layers.length * (this.height + 1)
    // generate longArray and count totalBlocks
    await task.force().swap('layers')
    const wasmBuilder = LongArrBuilder.new(paletteNbt.length, map, BigInt(volume))
    for (const [i, layer] of layers.entries()) {
      await task.progress(i)
      wasmBuilder.push(layer)
    }
    wasmBuilder.finalize()
    const longArr = new BigUint64Array(memory.buffer, wasmBuilder.longarr(), wasmBuilder.len())
    const totalBlocks = wasmBuilder.total()
    task.pop()

    const size: NBT.Vec3i = { x: new NBT.Int32(this.width), y: new NBT.Int32(layers.length), z: new NBT.Int32(this.height + 1)}
    const nbt = new NBT.NBTData({
      Version: new NBT.Int32(6),
      SubVersion: new NBT.Int32(1),
      MinecraftDataVersion: new NBT.Int32(3700), // 1.21
      Metadata: {
        Name: this.name ?? 'unnamed',
        Author: this.author,
        Description: this.description ?? 'Converted on https://amelonrind.github.io/mapart-conv',
        RegionCount: new NBT.Int32(1),
        TotalVolume: new NBT.Int32(volume),
        TotalBlocks: new NBT.Int32(totalBlocks),
        TimeCreated: this.timeCreated,
        TimeModified: BigInt(Date.now()),
        EnclosingSize: size,
        PreviewImageData: this.#generateLitematicaPreview()
      },
      Regions: { [this.name ?? 'Main']: {
        Position: { x: new NBT.Int32(0), y: new NBT.Int32(0), z: new NBT.Int32(0)},
        Size: size,
        TileEntities: [],
        Entities: [],
        PendingBlockTicks: [],
        PendingFluidTicks: [],
        BlockStatePalette: paletteNbt,
        BlockStates: longArr
      }}
    })
    await task.force().swap('Writing nbt')
    const data = await NBT.write(nbt, { endian: 'big', compression: 'gzip' })
    task.pop()
    return { name: this.part ? `${this.filename}_${this.part}.litematic` : `${this.filename}.litematic`, data }
  }

}

export class BlockState {
  id: string
  state: { [key: string]: string }

  static is(str: string, blockId: string) {
    return str === blockId || str.startsWith(blockId + '[')
  }

  static getId(str: string) {
    const index = str.indexOf('[')
    return index === -1 ? str : str.slice(0, index)
  }

  static from(str: string) {
    const obj = new BlockState()
    const [id, states] = str.split('[')
    obj.id = id
    if (states?.endsWith(']')) {
      for (const state of states.slice(0, -1).split(',')) {
        const [key, value] = state.split('=')
        if (!value) continue
        obj.state[key] = value
      }
    }
    return obj
  }

  static sanitize(str: string) {
    str = str.replaceAll(' ', '')
    if (str.startsWith('minecraft:')) {
      str = str.slice('minecraft:'.length)
    }
    if (!/^[0-9a-z_:/.-]+(?:\[\w+=\w+(?:,\w+=\w+)*\])?$/.test(str)) {
      throw new SyntaxError(`string ${JSON.stringify(str)} doesn't match block state regex`)
    }
    return BlockState.from(str).toString()
  }

  constructor (id: string = 'air', state: { [property: string]: string } = {}) {
    this.id = id
    this.state = state
  }

  /** modifies self */
  to(id: string): this {
    this.id = id
    return this
  }

  /** modifies self */
  with(stateId: string, value: string): this {
    this.state[stateId] = value
    return this
  }

  copy() {
    return new BlockState(this.id, Object.assign({}, this.state))
  }

  toString() {
    for (const _ in this.state) {
      return `${this.id}[${Object.entries(this.state).map(([k, v]) => `${k}=${v}`).sort().join(',')}]`
    }
    return this.id
  }

  toNbt(): {
    Name: string // block id
    Properties?: { [property: string]: string }
  } {
    for (const _ in this.state) {
      return { Name: `minecraft:${this.id}`, Properties: this.state }
    }
    return { Name: `minecraft:${this.id}` }
  }

}

type NSUDefinition = {
  blocks: Set<string>,
  affects: Set<string>,
  action: (palette: BlockPalette, layer: Uint16Array, width: number, index: number, affected: Set<number>) => void
}

export class BlockPalette {
  // 0Q1X2R3R4R5Q6Q7Q8S9QaQbScVdQeQfQgQhQiQjQkQlQmQnQoQpQqQrQsQtQuUvQwQxSyQzT1
  // 0Q11Q12Q13Q14Q15Q16Q17Q18Q19Q1aQ1bQ1cQ1dQ1eQ1fQ1gT1hQ1iQ1jT1kQ1lQ1mQ1nQ1oR
  static readonly _default: readonly string[] = Object.freeze(rawpalette.defaultPalette.map(BlockState.sanitize))
  static readonly _rebane: (string | null)[][] =
    rawpalette.rebane.map(arr => arr.map(v => v === null ? null : BlockState.sanitize(v)))
  static readonly _unusualIndexDict: { [index: string]: number } = rawpalette.unusualIndexDict
  static readonly _needSupportBlock: Set<string> = new Set(rawpalette.needSupportBlock)

  static readonly CONSTANTS = {
    STONE: BlockState.sanitize('stone'),
    TRANSPARENT_BLOCK: BlockState.sanitize('glass'),
    WATER: BlockState.sanitize('water[level=0]'),
    FALLING_WATER: BlockState.sanitize('water[level=8]'),
    SCAFFOLDING: BlockState.sanitize('scaffoldng[bottom=false,distance=0]'),
  } as const

  static readonly _endermanPickables: Set<string> = new Set([
    'dirt', 'grass_block', 'podzol', 'coarse_dirt', 'mycelium', 'rooted_dirt', 'moss_block',
    'mud', 'muddy_mangrove_roots', 'sand', 'red_sand', 'gravel', 'tnt', 'clay', 'pumpkin',
    'carved_pumpkin', 'melon', 'crimson_nylium', 'warped_nylium'
  ])
  static readonly _needStateUpdate: NSUDefinition[] = []

  static { // postLoad
    const colors = [
      'black', 'blue', 'brown', 'cyan', 'gray', 'green', 'light_blue', 'light_gray',
      'lime', 'magenta', 'orange', 'pink', 'purple', 'red', 'white', 'yellow'
    ]
    this._needStateUpdate.length = 0
    this._needStateUpdate.push({
      blocks: new Set(['redstone_block']),
      affects: new Set(['iron_trapdoor']),
      action(palette, layer, width, index, affected) {
        for (const n of around(layer.length, width, index)) {
          if (affected.has(layer[n])) {
            layer[n] = (palette.cacheOf('nsu:redstone_power')[layer[n]] ??=
              palette.getOrAssignIndex(BlockState.from(palette.base[layer[n]]).with('powered', 'true').with('open', 'true').toString())
            )
          }
        }
      }
    }, {
      blocks: new Set(['sponge']),
      affects: new Set(['water']),
      action(palette, layer, width, index, affected) {
        for (const n of around(layer.length, width, index)) {
          if (affected.has(layer[n])) {
            layer[index] = (palette._cache['nsu:wet_sponge'] ??= palette.getOrAssignIndex(BlockState.sanitize('wet_sponge')))
          }
        }
      }
    }, {
      blocks: new Set(['mushroom_stem', 'brown_mushroom_block', 'red_mushroom_block']),
      get affects() { return this.blocks },
      action(palette, layer, width, index, affected) {
        let state = null
        let modified = false
        for (const n of around(layer.length, width, index)) {
          if (affected.has(layer[n])) {
            state ??= BlockState.from(palette.base[layer[index]])
            if (BlockState.getId(palette.base[layer[n]]) !== state.id) continue
            const dir = Math.abs(n - index) > 1 || width === 1 ? (n < index ? 'north' : 'south') : (n < index ? 'west' : 'east')
            state.with(dir, 'false')
            modified = true
          }
        }
        if (modified && state) {
          affected.add(layer[index] = palette.getOrAssignIndex(state.toString()))
        }
      }
    }, {
      blocks: new Set(colors.map(color => `${color}_concrete_powder`)),
      affects: new Set(['water']),
      action(palette, layer, width, index, affected) {
        for (const n of around(layer.length, width, index)) {
          if (affected.has(layer[n])) {
            layer[index] = (palette.cacheOf('nsu:concrete')[layer[n]] ??=
              palette.getOrAssignIndex(palette.base[layer[n]].replace('_concrete_powder', '_concrete'))
            )
          }
        }
      }
    })
    const logs: NSUDefinition = {
      blocks: new Set(),
      affects: new Set(['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'azalea', 'cherry'].map(v => v + '_leaves')),
      action(palette, layer, width, index, affected) {
        updateNearbyLeaves(palette, layer, width, index, affected)
      }
    }
    function updateNearbyLeaves(
      palette: BlockPalette,
      layer: Uint16Array,
      width: number,
      index: number,
      affected: Set<number>,
      distance: number = 0
    ) {
      if (++distance >= 7) return
      for (const n of around(layer.length, width, index)) {
        if (affected.has(layer[n])) {
          const state = BlockState.from(palette.base[layer[n]])
          if (parseInt(state.state.distance ?? '7') <= distance) continue
          affected.add(layer[n] = palette.getOrAssignIndex(state.with('distance', `${distance}`).toString()))
          updateNearbyLeaves(palette, layer, width, n, affected, distance)
        }
      }
    }
    this._needStateUpdate.push(logs)
    const burnableWoodTypes = ['dark_oak', 'pale_oak', 'oak', 'acacia', 'birch', 'jungle', 'spruce', 'cherry', 'mangrove']
    const netherWoodTypes = ['crimson', 'warped']
    const possibleNewBurnableLogs = new Set(Object.keys(BlockImageBuilder.map)
      .filter(id => id.endsWith('_wood'))
      .map(v => v.slice(0, -'_wood'.length).replace(/^stripped_(?=\w)/, '')))
    const possibleNewNetherLogs = new Set(Object.keys(BlockImageBuilder.map)
      .filter(id => id.endsWith('_hyphae'))
      .map(v => v.slice(0, -'_hyphae'.length).replace(/^stripped_(?=\w)/, '')))
    for (const type of burnableWoodTypes) {
      logs.blocks.add(`${type}_log`)
      logs.blocks.add(`${type}_wood`)
      logs.blocks.add(`stripped_${type}_log`)
      logs.blocks.add(`stripped_${type}_wood`)
      possibleNewBurnableLogs.delete(type)
    }
    for (const type of netherWoodTypes) {
      logs.blocks.add(`${type}_stem`)
      logs.blocks.add(`${type}_hyphae`)
      logs.blocks.add(`stripped_${type}_stem`)
      logs.blocks.add(`stripped_${type}_hyphae`)
      possibleNewNetherLogs.delete(type)
    }
    if (possibleNewBurnableLogs.size > 0) {
      console.log(`found possible new burnable log: ${[...possibleNewBurnableLogs].join(', ')}`)
    }
    if (possibleNewNetherLogs.size > 0) {
      console.log(`found possible new nether log: ${[...possibleNewNetherLogs].join(', ')}`)
    }
  }

  static default() {
    return new this(this._default)
  }

  static parseRebaneUrl(url: string, fillDefault: false): (string | null)[];
  static parseRebaneUrl(url: string, fillDefault: true): string[];
  static parseRebaneUrl(url: string, fillDefault: boolean = false) {
    const encoded = (() => {
      try {
        const u = new URL(url)
        const preset = u.searchParams.get('preset')
        if (preset && /^(?:[0-9a-z]+[A-Z]+)+$/.test(preset)) return preset
      } catch {}
      const match = url.match(/(?<=^|=)((?:[0-9a-z]+[A-Z]+)+)(?=$|&)/)
      if (match) return match[1]
      return null
    })()
    const palette: (string | null)[] = this._default.slice()
    if (!fillDefault) {
      palette.fill(null)
      palette[0] = 'air'
    }
    if (!encoded) {
      console.log('rebane palette not parsed')
      return palette
    }
    for (const [full, kstr, istr] of encoded.matchAll(/([0-9a-z]+)([A-Z]+)/g)) {
      const key = parseInt(kstr, 36)
      const id = parseInt(istr.replace(/[Q-Z]/g, sub => `${'QRSTUVWXYZ'.indexOf(sub)}`), 26)
      if (isNaN(key) || isNaN(id)) {
        console.warn(`parsed NaN in palette entry`, full)
        continue
      }
      if (key >= this._rebane.length) {
        console.warn(`unknown key for rebane definition. outdated?`, key, this._rebane.length)
        continue
      }
      const block = this._rebane[key][id]
      if (!block) {
        console.warn(`null block for ${key}:${id}. unsupported version or outdated?`)
      }
      palette[this._unusualIndexDict[key] ?? (key + 1)] = block
    }
    return palette
  }

  static fromRebaneUrl(url: string) {
    const source = this.parseRebaneUrl(url, true)
    return new this(source)
  }

  static fromRebaneUrlInput() {
    return this.fromRebaneUrl(paletteUrlInput.value)
  }

  readonly source: readonly string[]
  _cache: Record<string, number> = {}
  base: string[] = ['air']
  _color2Index: (number | undefined)[] = []
  _state2IndexCache: { [state: string]: number } = {}

  constructor(source: readonly string[]) {
    this.source = source
  }

  getIndex(state: string) {
    const cache = this._state2IndexCache[state]
    if (cache !== undefined) return cache
    const index = this.base.indexOf(state)
    return index === -1 ? null : (this._state2IndexCache[state] = index)
  }

  getOrAssignIndex(state: string) {
    return this.getIndex(state) ?? (this._state2IndexCache[state] = this.base.push(state) - 1)
  }

  getOrAssignIndexByColor(colorId: number) {
    return this._color2Index[colorId] ??= this.getOrAssignIndex(this.source[colorId] ?? 'air')
  }

  async performBlockUpdates(layers: Uint16Array[], width: number, task = ITask.DUMMY) {
    const idArr = this.base.map(BlockState.getId)
    await task.push('Performing block updates', BlockPalette._needStateUpdate.length)
    await task.force().progress(-1, 'update types')
    /** lazy load because it's expensive */
    let stateSets: Set<number>[]
    for (const nsu of BlockPalette._needStateUpdate) {
      const blocksSet: Set<number> = new Set()
      idArr.forEach((id, i) => {
        if (nsu.blocks.has(id)) {
          blocksSet.add(i)
        }
      })
      if (blocksSet.size === 0) {
        await task.progress()
        continue
      }

      const affected: Set<number> = new Set()
      idArr.forEach((id, i) => {
        if (nsu.affects.has(id)) {
          affected.add(i)
        }
      })
      if (affected.size === 0) {
        await task.progress()
        continue
      }

      await task.push(undefined, layers.length)
      await task.force().swap('generating sets')
      stateSets ??= layers.map(layer => new Set(layer))
      const blocksArr = [...blocksSet]
      await task.force().progress(0, 'layers')
      for (const [i, layer] of layers.entries()) {
        await task.progress(i)
        const set = stateSets[i]
        if (!blocksArr.some(v => set.has(v)) || ![...affected].some(v => set.has(v))) continue
        layer.forEach((v, i) => {
          if (blocksSet.has(v)) {
            nsu.action(this, layer, width, i, affected)
          }
        })
      }
      task.pop()
    }
    task.pop()
    await TaskManager.render(true)
  }

  optimize(layers: Uint16Array[]): { nbt: PaletteNbt; map: Uint16Array } {
    const counter = WasmU16Counter.new(this.base.length)
    for (const layer of layers) {
      counter.count(layer)
    }
    const wasmArr = new Uint32Array(memory.buffer, counter.ptr(), counter.len())
    const newBase = ['air', ...this.base.filter((state, i) => wasmArr[i] && state !== 'air').sort()]
    const map = Uint16Array.from(this.base, state => ((newBase.indexOf(state) + 1) || 1) - 1)
    return { nbt: newBase.map(state => BlockState.from(state).toNbt()), map }
  }

  cacheOf(key: string): { [key: string | number]: number } { //@ts-ignore
    return this._cache[key] ??= {}
  }

  flush() {
    this._cache = {}
    this._state2IndexCache = {}
    this._color2Index.length = 0
  }

}

export class ConfirmCache {
  static #cache: Record<string, boolean> = {}
  static #formCache: Record<string, any> = {}
  static #formPromise: Record<string, Promise<any> | null> = {}

  /**
   * @deprecated
   */
  static confirm(msg: string) {
    return this.#cache[msg] ??= confirm(msg)
  }

  static async send<Q extends FormQuery>(id: string, query: Q, args: FormOptions<Q>) {
    while (this.#formPromise[id]) {
      await this.#formPromise[id]
    }
    if (id in this.#formCache) {
      return this.#formCache[id]
    }
    const pro = Form.send(id, query, args)
    this.#formPromise[id] = pro
      .then(res => this.#formCache[id] = res)
      .finally(() => this.#formPromise[id] = null)
    return pro
  }

  static clear() {
    this.#cache = {}
    this.#formCache = {}
  }

}
