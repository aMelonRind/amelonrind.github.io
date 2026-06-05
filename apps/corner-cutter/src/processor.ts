import * as NBT from "../../../lib/nbtify/src/index.js";
import suffocatable from "./suffocatable.json";
import fallable from "./fallable.json";
import { downloadBlob } from "../../../lib/util.js";
import { LitematicNbt } from "../../types.js";
import { tw } from "../i18n.js";
import {
  AppState,
  ResultType,
  setAliveCells,
  setAppState,
  setDownloadCb,
  setRecursiveRuns,
  setRedstoneDetected,
  setResultType,
  setSaves
} from "../app.jsx";

export type ProcessOptions = {
  outsides: Record<'up' | 'down' | 'north' | 'south' | 'west' | 'east', boolean>,
  insideMarker: string | null, // block id
  outsideMarker: string | null, // block id
  extraSolidBlocks: string[],
  recursive: boolean
};

// this mask represents solid sides indexed by bits defined by the comment below.
// they are always viewed from the same side, from higher coords to lower coords.
// for example up side is viewed from up to down, down side are also viewed from up to down.
// that way i can easily use bitwise to check if two adjacent blocks allows sight to pass.
// 6 sides in order: west, east, north, south, down, up
// aka -x, +x, -z, +z, -y, +y
// these values represents the solid part of sides, see the comment below.
const sides3DMasks = [
  // for example this is the (0, 0, 0) slice.
  // It got one solid slice on west, none on east, one on north, none on south, one on down, none on up.
  0b0001_0000_0010_0000_1000_0000,
  0b0000_0001_0001_0000_0100_0000,
  0b0010_0000_0000_0010_0010_0000,
  0b0000_0010_0000_0001_0001_0000,
  0b0100_0000_1000_0000_0000_1000,
  0b0000_0100_0100_0000_0000_0100,
  0b1000_0000_0000_1000_0000_0010,
  0b0000_1000_0000_0100_0000_0001
]
// imagine the block is sliced into 2x2x2 slices
// the bits here represents whether a slice is solid
// arranged by yzx:
// (x, y, z): (0, 0, 0), (1, 0, 0), (0, 0, 1), (1, 0, 1), (0, 1, 0), (1, 1, 0), (0, 1, 1), (1, 1, 1)
function holesFrom3D(solidBits: number) {
  let full = 0
  let index = 7
  while (solidBits && index >= 0) {
    if (solidBits & 1) {
      full |= sides3DMasks[index]
    }
    solidBits >>>= 1
    index--
  }
  // return Uint8Array.from({ length: 6 }, (_, i) => ((full >> (i * 4)) & 0b1111) ^ 0b1111).reverse()
  return full ^ ((1 << 24) - 1)
}

enum Shape {
  AIR = 0,
  OPAQUE = 1,
  // other 2 to 253
  // simple count from 2 up
  SIMPLE = 2,
  // complex count from 253 down
  COMPLEX = 253,
  OUTSIDE = 254,
  INSIDE = 255
}

function fromSimpleState(
  half: 'top' | 'bottom' | 'double' | undefined,
  facing?: 'north' | 'south' | 'west' | 'east' | undefined,
  shape?: 'straight' | 'inner_left' | 'inner_right' | 'outer_left' | 'outer_right' | undefined
) {
  if (half === 'double') {
    return holesFrom3D(0b11111111)
  }

  let base = 0

  if (facing) {
    const facings = ['north', 'west', 'south', 'east'] as const
    const facingValues = [0b1100, 0b1010, 0b0011, 0b0101] as const
    const facingIndex = facings.indexOf(facing)
    base = facingValues[facingIndex]
    if (shape && /^(?:inner|outer)_(?:left|right)$/.test(shape)) {
      const [type, direction] = shape.split('_')
      const offset = direction === 'left' ? 1 : 3
      const mask = facingValues[(facingIndex + offset) % 4]
      base = type === 'inner' ? (base | mask) : (base & mask)
    }
    base |= base << 4
  }

  if (half === 'top') {
    base |= 0b00001111
  } else if (half === 'bottom') {
    base |= 0b11110000
  }

  return holesFrom3D(base)
}

export async function process(root: LitematicNbt, filename: string, options: ProcessOptions) {
  const regions = Object.entries(root.data.Regions)
  if (regions.length === 0) {
    throw tw('error.no_region')
  }
  if (regions.length > 1) {
    throw tw('error.multiple_region')
  }
  // init data
  setAppState(AppState.INITIALIZING)
  await awaitRender(true)
  const [ regionName, region ] = regions[0]
  const sx = Math.abs(region.Size.x.valueOf())
  const sy = Math.abs(region.Size.y.valueOf())
  const sz = Math.abs(region.Size.z.valueOf())
  const layerSize = sx * sz
  const offsets = [-1, 1, -sx, sx, -layerSize, layerSize] as const

  function* iterateSides(index: number) {
    if (index % sx > 0) yield 0 // left
    if (index % sx < sx - 1) yield 1 // right
    if (index % layerSize >= sx) yield 2 // front
    if (index % layerSize < layerSize - sx) yield 3 // back
    if (index >= layerSize) yield 4 // down
    if (index < layerSize * (sy - 1)) yield 5 // up
  }

  const blockHoles = [
    holesFrom3D(0b00000000),
    holesFrom3D(0b11111111),
  ]
  const complexShapes: ComplexShape[] = []

  const rawpalette = region.BlockStatePalette
  const getIndex = (holes: number) => {
    let index = blockHoles.indexOf(holes)
    if (index === -1) {
      index = blockHoles.length
      blockHoles.push(holes)
    }
    return index
  }
  const solids = new Set(suffocatable).union(new Set(options.extraSolidBlocks))
  const palette = Uint8Array.from(rawpalette, ent => {
    const name = ent.Name
    if (name === options.insideMarker) return Shape.INSIDE
    if (name === options.outsideMarker) return Shape.OUTSIDE
    if (solids.has(name)) {
      return 1
    }
    if (name.endsWith('_stairs')) {
      return getIndex(fromSimpleState(
        ent.Properties?.half as any,
        ent.Properties?.facing as any,
        ent.Properties?.shape as any
      ))
    }
    if (name.endsWith('_slab')) {
      return getIndex(fromSimpleState(ent.Properties?.type as any))
    }
    if (name.endsWith('_wall')) {
      return ComplexShape.fromStoneWall(ent.Properties).register(getIndex, complexShapes)
    }
    return 0
  })
  /**
   * [24 bits exposed][3 bits fromDirection][1 bit touched][4 bits result]  
   * from direction 0: unset, (1-6): direction, 7: special  
   * old:
   * ```
   *  00000000
   *        00 - none
   *        01 - air
   *        10 - wall - scannable like stairs and slabs and walls
   *        11 - wall
   *       1 - is exposed stairs or slabs or walls
   *      1 - marked as block to clear
   *     1 - (reserved) replace to stone to avoid lighting issue
   *  111 - from direction 0: unset, (1-6): direction, 7: special
   * ```
   */
  const data = new Uint32Array(sy * layerSize)
  const forceAlive = new Uint8Array(data.length)
  const alive = new Uint8Array(data.length)
  const rawstates = BigUint64Array.from(region.BlockStates)
  const origStates = new Uint8Array(data.length)
  const bits = BigInt(Math.max(2, 32 - Math.clz32(rawpalette.length - 1)))
  const mask = (1n << bits) - 1n
  let buf = 0n
  let bufs = 0n
  let index = 0
  let dataIndex = 0
  while (true) {
    if (bufs < bits) {
      if (dataIndex >= rawstates.length) {
        break
      } else {
        buf |= rawstates[dataIndex++] << bufs
        bufs += 64n
      }
    }
    origStates[index] = palette[Number(buf & mask)]
    if (origStates[index] === Shape.OUTSIDE) {
      forceAlive[index] = 1
      origStates[index] = 0
    }
    buf >>= bits
    bufs -= bits
    index++
  }
  if (bufs && buf) {
    origStates[index] = palette[Number(buf)]
    if (origStates[index] === Shape.OUTSIDE) {
      forceAlive[index] = 1
      origStates[index] = 0
    }
  }
  // scan
  setAppState(AppState.SCANNING)
  await awaitRender(true)
  // const debugOrig = [-4102, 16, 357]
  // const debugPos = [-3812, 54, 500]
  // const debugIndex = (debugPos[1] - debugOrig[1]) * layerSize + (debugPos[2] - debugOrig[2]) * sx + (debugPos[0] - debugOrig[0])
  const jigsaws = new Set<number>()
  const patched = new Uint8Array(options.recursive ? data.length : 0)
  let gen = 0
  while (true) {
    jigsaws.clear()
    data.fill(0)
    alive.set(forceAlive)
    let aliveCount = alive.filter(v => v).length
    // init alive from sides
    if (options.outsides.west) {
      for (let i = 0; i < data.length; i += sx) {
        breath(i, 0, 0b1111)
        data[i] |= 0b11100000
      }
    }
    if (options.outsides.east) {
      for (let i = sx - 1; i < data.length; i += sx) {
        breath(i, 1, 0b1111)
        data[i] |= 0b11100000
      }
    }
    if (options.outsides.north) {
      for (let l = 0; l < data.length; l += layerSize) {
        for (let x = 0; x < sx; x++) {
          breath(l + x, 2, 0b1111)
          data[l + x] |= 0b11100000
        }
      }
    }
    if (options.outsides.south) {
      for (let l = layerSize - sx; l < data.length; l += layerSize) {
        for (let x = 0; x < sx; x++) {
          breath(l + x, 3, 0b1111)
          data[l + x] |= 0b11100000
        }
      }
    }
    if (options.outsides.down) {
      for (let i = 0; i < layerSize; i++) {
        breath(i, 4, 0b1111)
        data[i] |= 0b11100000
      }
    }
    if (options.outsides.up) {
      for (let i = data.length - layerSize; i < data.length; i++) {
        breath(i, 5, 0b1111)
        data[i] |= 0b11100000
      }
    }
    // iterate
    index = 0
    while (true) {
      index = alive.indexOf(1, index)
      if (index === -1) {
        setAliveCells(aliveCount)
        await awaitRender()
        if (!aliveCount) break
        index = 0
        continue
      }

      alive[index] = 0
      aliveCount--
      const holes = data[index] >>> 8
      for (const side of iterateSides(index)) {
        const holeOnSide = (holes >> (20 - (side << 2))) & 0b1111
        if (holeOnSide) {
          breath(index + offsets[side], side ^ 1, holeOnSide)
        }
      }
    }
    // recursive
    if (options.recursive && jigsaws.size) {
      let added = false
      for (let i of jigsaws) {
        i += offsets[((data[i] >>> 5) & 0b111) - 1]
        i += offsets[((data[i] >>> 5) & 0b111) - 1]
        if (isNaN(i)) continue
        let added2 = false
        let j = i
        const visited = new Set<number>()
        // try add blocks at paths that's close to other block
        while (!isNaN(j) && !visited.has(j)) {
          visited.add(j)
          for (const k of [j, ...iterateSides(j).map(side => j + offsets[side])]) {
            if (origStates[k] && origStates[k] <= Shape.COMPLEX || patched[k] && !visited.has(k)) {
              patched[j] = 1
              added2 = true
              break
            }
          }
          j += offsets[((data[j] >>> 5) & 0b111) - 1]
        }
        // if nothing is added, make the whole path solid
        if (!added2) {
          j = i
          j += offsets[((data[j] >>> 5) & 0b111) - 1]
          j += offsets[((data[j] >>> 5) & 0b111) - 1]
          visited.clear()
          while (!isNaN(j) && !visited.has(j)) {
            visited.add(j)
            patched[j] = 1
            added2 = true
            j += offsets[((data[j] >>> 5) & 0b111) - 1]
          }
        }
        added ||= added2
      }
      if (added) {
        gen++
        setRecursiveRuns(gen)
        await awaitRender()
        continue
      }
    }
    break

    function breath(index: number, fromDirection: number, fromHoles: number) {
      const d = data[index] |= 1 << 4 // touch
      const type = origStates[index]
      if (type === Shape.OPAQUE) {
        return
      }
      if (type === Shape.INSIDE) {
        jigsaws.add(index)
        return
      }
      if (type === Shape.OUTSIDE) {
        return
      }

      const holes = type < blockHoles.length
        ? blockHoles[type]
        : complexShapes[Shape.COMPLEX - type].getHoles(fromDirection, fromHoles)
      // if no common hole or already exposed
      if (!((holes >> (20 - (fromDirection << 2))) & fromHoles) || (d | (holes << 8)) === d) {
        return
      }

      data[index] = d | (holes << 8)
      if (!alive[index]) {
        alive[index] = 1
        aliveCount++
      }
      if (!((d >>> 5) & 0b111)) {
        data[index] |= ((fromDirection + 1) << 5)
      }
    }
  }
  // find blocks to clear
  if (!jigsaws.size && !gen) {
    setAppState(AppState.FINALIZING)
    await awaitRender(true)
    const ids = rawpalette.map(ent => ent.Name)
    const makeSet = (arr: string[]) => new Set(ids.entries().filter(([i, id]) => arr.includes(id)).map(([i, id]) => i))
    
    const standalone = makeSet([
      'minecraft:redstone_block',
      'minecraft:target',
      'minecraft:waxed_copper_bulb',
      'minecraft:sculk_sensor',
      'minecraft:calibrated_sculk_sensor',
      'minecraft:daylight_detector',
      'minecraft:dispenser',
      'minecraft:oak_fence_gate',
      'minecraft:cherry_fence_gate',
      'minecraft:iron_trapdoor',
      'minecraft:oak_trapdoor',
      'minecraft:cherry_trapdoor',
      'minecraft:redstone_lamp'
    ])

    const supportBelow = makeSet([
      'minecraft:repeater',
      'minecraft:comparator',
      'minecraft:oak_pressure_plate',
      'minecraft:cherry_pressure_plate',
      'minecraft:stone_pressure_plate',
      'minecraft:polished_blackstone_pressure_plate',
      'minecraft:activator_rail',
      'minecraft:powered_rail',
      'minecraft:iron_door',
      'minecraft:oak_door',
      'minecraft:cherry_door'
    ])

    const supportFacing = makeSet([
      'minecraft:piston',
      'minecraft:piston_head',
      'minecraft:sticky_piston',
      'minecraft:dropper'
    ])

    const supportFacingR = makeSet([
      'minecraft:lever',
      'minecraft:oak_button',
      'minecraft:cherry_button',
      'minecraft:stone_button',
      'minecraft:polished_blackstone_button',
      'minecraft:tripwire_hook'
    ])

    const complexSupport = makeSet([
      'minecraft:redstone_wall_torch',
      'minecraft:redstone_torch',
      'minecraft:redstone_wire',
      'minecraft:slime_block',
      'minecraft:honey_block',
      'minecraft:hopper',
      'minecraft:observer',
      'minecraft:note_block',
      'minecraft:crafter'
    ])

    const redstones = new Set([
      ...standalone,
      ...supportBelow,
      ...supportFacing,
      ...supportFacingR,
      ...complexSupport
    ])
    const fallableSet = makeSet(fallable)
    const counts: { [id: string]: number } = {}
    const redstoneComponents: Set<number> = new Set()
    for (let i = 0; i < data.length; i++) {
      const state = getState(i)
      if (!data[i] && state !== 0) {
        const id = ids[state]
        if (!id.endsWith('air')) {
          data[i] = 0b101
          counts[id] = (counts[id] ?? 0) + 1
          if (data[i + layerSize] && fallableSet.has(getState(i + layerSize))) {
            data[i] = id === 'minecraft:cobblestone' ? 0 : 0b110
          }
          if (redstones.has(state)) {
            redstoneComponents.add(i)
            if (!standalone.has(state)) {
              const toAdd = new Uint8Array(6)
              if (supportBelow.has(state)) {
                toAdd[4] = 1
              } else if (supportFacing.has(state)) {
                toAdd[['west', 'east', 'north', 'south', 'down', 'up'].indexOf(rawpalette[state].Properties?.facing ?? '')] = 1
              } else if (supportFacingR.has(state)) {
                toAdd[['east', 'west', 'south', 'north', 'up', 'down'].indexOf(rawpalette[state].Properties?.facing ?? '')] = 1
              } else if (complexSupport.has(state)) {
                const p = rawpalette[state].Properties
                if (p) {
                  switch (id) {
                    case 'minecraft:redstone_wall_torch':
                    case 'minecraft:redstone_torch':
                    case 'minecraft:redstone_wire':
                    case 'minecraft:slime_block':
                    case 'minecraft:honey_block':
                      toAdd.fill(1)
                      break
                    case 'minecraft:hopper':
                      toAdd[['west', 'east', 'north', 'south', 'down', 'up'].indexOf(p.facing ?? 'down')] = 1
                      toAdd[5] = 1
                      break
                    case 'minecraft:observer':
                      const dir = Math.floor(['west', 'east', 'north', 'south', 'down', 'up'].indexOf(p.facing ?? '') / 2) * 2
                      toAdd[dir] = 1
                      toAdd[dir + 1] = 1
                      break
                    case 'minecraft:note_block':
                      toAdd[4] = 1
                      toAdd[5] = 1
                      break
                    case 'minecraft:crafter':
                      toAdd[['west', 'east', 'north', 'south', 'down', 'up'].indexOf(p.orientation?.split('_', 1)[0] ?? '')] = 1
                      break
                  }
                }
              }
              for (const side of iterateSides(i)) {
                if (toAdd[side]) {
                  redstoneComponents.add(i + offsets[side])
                }
              }
            }
          }
        }
      }
    }
    if (redstoneComponents.size) {
      setRedstoneDetected(true)
      for (const i of redstoneComponents) {
        const state = getState(i)
        if (data[i] & 0b100) {
          data[i] = 0
          const id = ids[state]
          if (id in counts) {
            counts[id]--
          }
        }
      }
    }
    function getState(index = 0) {
      const bitIndex = BigInt(index) * bits
      const i = Number(bitIndex / 64n)
      return Number(((((rawstates[i + 1] ?? 0n) << 64n) | (rawstates[i] ?? 0n)) >> (bitIndex % 64n)) & mask)
    }
    const sorted = Object.entries(counts).sort((b, a) => a[1] - b[1])
    if (sorted.length === 0) {
      setResultType(ResultType.PERFECT)
      return
    } else {
      setResultType(ResultType.NORMAL)
      for (const ent of sorted) {
        ent[0] = ent[0].replace(/^minecraft:/, '')
      }
      const total = sorted.reduce((p, v) => p + v[1], 0)
      sorted.unshift(['Total', total])
      setSaves(sorted)
    }
  } else {
    setResultType(gen ? ResultType.DETECTED_PATCHES : ResultType.DETECTED_PATHS)
    if (gen) {
      let i = patched.indexOf(1)
      while (i >= 0) {
        data[i] = data[i] & 0b11100000 | 0b101
        i = patched.indexOf(1, i + 1)
      }
    } else {
      for (let i of jigsaws) {
        while (i < data.length) {
          data[i] = data[i] & 0b11100000 | 0b101
          i += offsets[((data[i] >>> 5) & 0b111) - 1]
        }
      }
    }
  }
  // export as litematic mask
  let totalBlocks = 0
  const longArr = new BigUint64Array(Math.ceil(data.length * 2 / 64))
  index = 0
  buf = 0n
  bufs = 0n
  for (const d of data) {
    if (d & 0b100) {
      buf |= ((d & 0b10) ? 2n : 1n) << bufs
      totalBlocks++
    }
    bufs += 2n
    if (bufs >= 64n) {
      longArr[index++] = buf
      buf >>= 64n
      bufs -= 64n
    }
  }
  if (bufs > 0n) {
    longArr[index] = buf
  }
  const outFile = filename.slice(0, -'.litematic'.length) + '-mask.litematic'
  setDownloadCb(() => async (main, support) => {
    const nbt = new NBT.NBTData({
      Version: new NBT.Int32(6),
      SubVersion: new NBT.Int32(1),
      MinecraftDataVersion: new NBT.Int32(3700), // 1.21
      Metadata: {
        Name: root.data.Metadata.Name + ` ${jigsaws.size ? 'Patch' : 'Clear'} Mask`,
        Author: 'amelonrind.github.io',
        Description: 'Generated on https://amelonrind.github.io/corner-cutter',
        RegionCount: new NBT.Int32(1),
        TotalVolume: new NBT.Int32(data.length),
        TotalBlocks: new NBT.Int32(totalBlocks),
        TimeCreated: BigInt(Date.now()),
        TimeModified: BigInt(Date.now()),
        EnclosingSize: region.Size
      },
      Regions: { [regionName ?? 'Main']: {
        Position: region.Position,
        Size: region.Size,
        TileEntities: [],
        Entities: [],
        PendingBlockTicks: [],
        PendingFluidTicks: [],
        BlockStatePalette: [
          { Name: 'minecraft:air' },
          { Name: main },
          { Name: support }
        ],
        BlockStates: longArr
      }}
    })

    //@ts-ignore
    downloadBlob(outFile, await NBT.write(nbt, { endian: 'big', compression: 'gzip' }))
  })
}

/**
 * defines a shape that has multiple empty regions.
 * for example a tall wall can split a block space in half, creating two regions.
 */
class ComplexShape {
  readonly regions: Uint32Array
  // identity, assumes there's only 4 indexes maximum
  readonly hash: number

  static fromStoneWall(props: { [key: string]: string } | undefined) {
    const set = new Set([0b1000, 0b0100, 0b0010, 0b0001])
    const dirs = [
      [0b1000, 0b0100],
      [0b0010, 0b0001],
      [0b1000, 0b0010],
      [0b0100, 0b0001],
    ] as const
    const talls = [
      props?.north === 'tall',
      props?.south === 'tall',
      props?.west === 'tall',
      props?.east === 'tall',
    ]

    // connect regions that are not separated by tall
    for (const [a, b] of dirs.filter((_, i) => !talls[i])) {
      let va = 0
      let vb = 0
      for (const value of set) {
        if (a & value) {
          set.delete(value)
          va = value
          break
        }
      }
      for (const value of set) {
        if (b & value) {
          set.delete(value)
          vb = value
          break
        }
      }
      set.add(va | vb)
    }
    return new this(Uint8Array.from(set, v => (v | (v << 4)) ^ 0b11111111))
  }

  constructor(shapes: Uint8Array) {
    shapes.sort((a, b) => a - b)
    this.regions = Uint32Array.from(shapes, s => holesFrom3D(s))
    let hash = 0
    for (let i = 0; i < 4; i++) {
      hash = (hash << 8) | (shapes[i] ?? 0)
    }
    this.hash = hash
    // this.map = new Uint8Array(1 << (this.indexes.length))
  }

  register(getIndex: (holes: number) => number, arr: ComplexShape[]) {
    if (this.regions.length === 1) {
      return getIndex(this.regions[0])
    }
    let index = arr.findIndex(s => this.equals(s))
    if (index !== -1) {
      return Shape.COMPLEX - index
    }

    index = arr.length
    arr.push(this)
    return Shape.COMPLEX - index
  }

  getHoles(fromDirection: number, fromHoles: number) {
    let res = 0
    const bits = 20 - (fromDirection << 2)
    for (const sub of this.regions) {
      if ((sub >> bits) & fromHoles) {
        res |= sub
      }
    }
    return res
  }

  equals(other: ComplexShape) {
    return this.hash === other.hash
  }
}

// too lazy to split this into a worker
let lastRender = Date.now()
function awaitRender(force = false) {
  if (!force && Date.now() - lastRender < 40) return
  return new Promise(res => {
    requestAnimationFrame(() => {
      lastRender = Date.now()
      res(undefined)
    })
    setTimeout(res, force ? 100 : 30)
  })
}
