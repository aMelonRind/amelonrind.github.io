
import * as NBT from "../npm/nbtify/dist/index.js"
import suffocatable from "./suffocatable.json" with { type: "json" }
import fallable from "./fallable.json" with { type: "json" }
import { downloadBlob, log } from "../index.js"

/**
 * @param {LitematicNbt} root 
 * @param {string} filename 
 * @param {ProcessOptions} options
 */
export async function process(root, filename, options) {
  const regions = Object.entries(root.data.Regions)
  if (regions.length === 0) {
    await log('No region found')
    return
  }
  if (regions.length > 1) {
    await log('Multiple regions is not supported. Please re-save the litematic with only one region.')
    return
  }
  // init data
  await log('Initializing data')
  const [ regionName, region ] = regions[0]
  const sx = Math.abs(region.Size.x.valueOf())
  const sy = Math.abs(region.Size.y.valueOf())
  const sz = Math.abs(region.Size.z.valueOf())
  const layerSize = sx * sz
  const offsets = [-1, 1, -sx, sx, -layerSize, layerSize]

  /**
   * @param {number} index 
   */
  function* iterateSides(index) {
    if (index % sx > 0) yield 0 // left
    if (index % sx < sx - 1) yield 1 // right
    if (Math.floor(index % layerSize / sx) > 0) yield 2 // front
    if (Math.floor(index % layerSize / sx) < sz - 1) yield 3 // back
    if (Math.floor(index / layerSize) > 0) yield 4 // down
    if (Math.floor(index / layerSize) < sy - 1) yield 5 // up
  }
  // this mask represents solid sides indexed by bits defined by the comment below.
  // they are always viewed from the same side, from higher coords to lower coords.
  // for example up side is viewed from up to down, down side are also viewed from up to down.
  // that way i can easily use bitwise to check if two adjacent blocks allows sight to pass.
  // 6 sides in order: west, east, north, south, down, up
  // aka -x, +x, -z, +z, -y, +y
  const sides3DMasks = [
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
  // (0, 0, 0), (1, 0, 0), (0, 0, 1), (1, 0, 1), (0, 1, 0), (1, 1, 0), (0, 1, 1), (1, 1, 1)
  /** @type {(solidBits: number) => Uint8Array} */
  const holesFrom3D = bits => {
    let full = 0
    let index = 7
    while (bits && index >= 0) {
      if (bits & 1) {
        full |= sides3DMasks[index]
      }
      bits >>>= 1
      index--
    }
    return Uint8Array.from({ length: 6 }, (_, i) => ((full >> (i * 4)) & 0b1111) ^ 0b1111).reverse()
  }
  const blockHoles = [
    0b00000000,
    0b11111111,
    0b00001111,
    0b11110000,

    0b11001111, // 'top,north,straight': 4,
    0b11101111, // 'top,north,inner_left': 5,
    0b11011111, // 'top,north,inner_right': 6,
    0b10001111, // 'top,north,outer_left': 7,
    0b01001111, // 'top,north,outer_right': 8,
    0b00111111, // 'top,south,straight': 9,
    0b01111111, // 'top,south,inner_left': 10,
    0b10111111, // 'top,south,inner_right': 11,
    0b00011111, // 'top,south,outer_left': 12,
    0b00101111, // 'top,south,outer_right': 13,
    0b10101111, // 'top,west,straight': 14,
    0b10111111, // 'top,west,inner_left': 15,
    0b11101111, // 'top,west,inner_right': 16,
    0b00101111, // 'top,west,outer_left': 17,
    0b10001111, // 'top,west,outer_right': 18,
    0b01011111, // 'top,east,straight': 19,
    0b11011111, // 'top,east,inner_left': 20,
    0b01111111, // 'top,east,inner_right': 21,
    0b01001111, // 'top,east,outer_left': 22,
    0b00011111, // 'top,east,outer_right': 23,
    0b11111100, // 'bottom,north,straight': 24,
    0b11111110, // 'bottom,north,inner_left': 25,
    0b11111101, // 'bottom,north,inner_right': 26
    0b11111000, // 'bottom,north,outer_left': 27,
    0b11110100, // 'bottom,north,outer_right': 28
    0b11110011, // 'bottom,south,straight': 29,
    0b11110111, // 'bottom,south,inner_left': 30,
    0b11111011, // 'bottom,south,inner_right': 31
    0b11110001, // 'bottom,south,outer_left': 32,
    0b11110010, // 'bottom,south,outer_right': 33
    0b11111010, // 'bottom,west,straight': 34,
    0b11111011, // 'bottom,west,inner_left': 35,
    0b11111110, // 'bottom,west,inner_right': 36,
    0b11110010, // 'bottom,west,outer_left': 37,
    0b11111000, // 'bottom,west,outer_right': 38,
    0b11110101, // 'bottom,east,straight': 39,
    0b11111101, // 'bottom,east,inner_left': 40,
    0b11110111, // 'bottom,east,inner_right': 41,
    0b11110100, // 'bottom,east,outer_left': 42,
    0b11110001, // 'bottom,east,outer_right': 43,

    0b01010101, // wall_w
    0b10101010, // wall_e
    0b00110011, // wall_n
    0b11001100, // wall_s
  ].map(n => holesFrom3D(n)).concat([
    Uint8Array.from([0b1111, 0b1111, 0b1111, 0b1111, 0b1111, 0b1111]),
    Uint8Array.from([0b1111, 0b1111, 0b1111, 0b1111, 0b1111, 0b1111]),
    Uint8Array.from([0b1111, 0b1111, 0b1111, 0b1111, 0b1111, 0b1111]),
  ])
  const complexMap = {
    wall_w: 44,
    wall_e: 45,
    wall_n: 46,
    wall_s: 47,
    wall_we: 48,
    wall_ns: 49,
    wall_all: 50,
    double: 1,
    top: 2,
    bottom: 3,
    'top,north,straight': 4,
    'top,north,inner_left': 5,
    'top,north,inner_right': 6,
    'top,north,outer_left': 7,
    'top,north,outer_right': 8,
    'top,south,straight': 9,
    'top,south,inner_left': 10,
    'top,south,inner_right': 11,
    'top,south,outer_left': 12,
    'top,south,outer_right': 13,
    'top,west,straight': 14,
    'top,west,inner_left': 15,
    'top,west,inner_right': 16,
    'top,west,outer_left': 17,
    'top,west,outer_right': 18,
    'top,east,straight': 19,
    'top,east,inner_left': 20,
    'top,east,inner_right': 21,
    'top,east,outer_left': 22,
    'top,east,outer_right': 23,
    'bottom,north,straight': 24,
    'bottom,north,inner_left': 25,
    'bottom,north,inner_right': 26,
    'bottom,north,outer_left': 27,
    'bottom,north,outer_right': 28,
    'bottom,south,straight': 29,
    'bottom,south,inner_left': 30,
    'bottom,south,inner_right': 31,
    'bottom,south,outer_left': 32,
    'bottom,south,outer_right': 33,
    'bottom,west,straight': 34,
    'bottom,west,inner_left': 35,
    'bottom,west,inner_right': 36,
    'bottom,west,outer_left': 37,
    'bottom,west,outer_right': 38,
    'bottom,east,straight': 39,
    'bottom,east,inner_left': 40,
    'bottom,east,inner_right': 41,
    'bottom,east,outer_left': 42,
    'bottom,east,outer_right': 43,
  }
  const rawpalette = region.BlockStatePalette
  /**
   * 0 - air
   * 1 - wall
   * 2+ - others
   * 254 - force alive
   * 255 - jigsaw
   */
  const palette = Uint8Array.from(rawpalette, ent => {
    const name = ent.Name
    if (name === options.insideMarker) return 255
    if (name === options.outsideMarker) return 254
    if (suffocatable.includes(name) || options.extraSolidBlocks.includes(name)) {
      return 1
    }
    if (name.endsWith('_stairs')) {
      const half = ent.Properties?.half
      const facing = ent.Properties?.facing
      const shape = ent.Properties?.shape
      return complexMap[`${half},${facing},${shape}`] ?? complexMap[half] ?? 0
    }
    if (name.endsWith('_slab')) {
      const type = ent.Properties?.type
      return complexMap[type] ?? 0
    }
    if (name.endsWith('_wall')) {
      const p = ent.Properties
      const ns = p?.east === 'tall' && p?.west === 'tall'
      const we = p?.north === 'tall' && p?.south === 'tall'
      return ns ? (we ? complexMap.wall_all : complexMap.wall_ns) : (we ? complexMap.wall_we : 0)
    }
    return 0
  })
  /**```
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
  const data = new Uint8Array(sy * layerSize)
  globalThis.data = data
  const forceAlive = new Uint8Array(data.length)
  const alive = new Uint8Array(data.length)
  const rawstates = BigUint64Array.from(region.BlockStates)
  const origStates = new Uint8Array(data.length)
  const states = new Uint8Array(data.length)
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
    if (origStates[index] === 254) {
      forceAlive[index] = 1
      origStates[index] = 0
    }
    buf >>= bits
    bufs -= bits
    index++
  }
  if (bufs && buf) {
    origStates[index] = palette[Number(buf)]
    if (origStates[index] === 254) {
      forceAlive[index] = 1
      origStates[index] = 0
    }
  }
  // scan
  await log('Scanning...')
  // const debugOrig = [-4102, 16, 357]
  // const debugPos = [-3812, 54, 500]
  // const debugIndex = (debugPos[1] - debugOrig[1]) * layerSize + (debugPos[2] - debugOrig[2]) * sx + (debugPos[0] - debugOrig[0])
  /** @type {number[]} */
  const jigsaws = []
  const patched = new Uint8Array(data.length)
  let gen = 0
  scan:
  while (true) {
    jigsaws.length = 0
    data.set(patched)
    alive.set(forceAlive)
    states.set(origStates)
    let dirty = false
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
    let nextLog = 0
    index = 0
    let timeout = 0
    while (true) {
      index = alive.indexOf(1, index)
      if (index === -1) {
        if (!dirty) break
        if (Date.now() > nextLog) {
          let count = 0
          for (const v of alive) {
            if (v) count++
          }
          await log(`Scanning... ${count.toLocaleString()} left.`)
          nextLog = Date.now() + 500
        }
        dirty = false
        index = 0
        if (timeout++ > 99999) throw 'timeout'
        continue
      }
      alive[index] = 0
      const d = data[index]
      if ((d & 0b11) === 0b11 || (d & 0b111) === 0b010) continue
      const holes = blockHoles[(d & 0b11) === 0b01 ? 0 : states[index]] ?? blockHoles[0]
      for (const side of iterateSides(index)) {
        if (holes[side]) {
          breath(index + offsets[side], side ^ 1, holes[side])
        }
      }
    }
    // recursive
    if (options.recursive && jigsaws.length) {
      let added = false
      for (let i of jigsaws) {
        i += offsets[(data[i] >>> 5) - 1]
        i += offsets[(data[i] >>> 5) - 1]
        if (isNaN(i)) continue
        let added2 = false
        let j = i
        /** @type {Set<number>} */
        const visited = new Set()
        while (!isNaN(j) && !visited.has(j)) {
          visited.add(j)
          for (const k of [j, ...iterateSides(j).map(side => j + offsets[side])]) {
            if (origStates[k] && origStates[k] < 250 || patched[k] && !visited.has(k)) {
              patched[j] = 0b11
              added2 = true
              break
            }
          }
          j += offsets[(data[j] >>> 5) - 1]
        }
        if (!added2) {
          j = i
          j += offsets[(data[j] >>> 5) - 1]
          j += offsets[(data[j] >>> 5) - 1]
          visited.clear()
          while (!isNaN(j) && !visited.has(j)) {
            visited.add(j)
            patched[j] = 0b11
            added2 = true
            j += offsets[(data[j] >>> 5) - 1]
          }
        }
        added ||= added2
      }
      if (added) {
        gen++
        await log(`Running recursively #${gen}`)
        continue
      }
    }
    break

    /**
     * @param {number} index 
     * @param {number} fromDirection 
     * @param {number} fromHoles
     */
    function breath(index, fromDirection, fromHoles) {
      const d = data[index]
      let type = states[index]
      if ((d & 0b101) && type < 44) return
      if (type === 255) {
        jigsaws.push(index)
        states[index] = 0
        type = 0
      }
      if (type >= 44) {
        // special case: wall
        if (fromDirection >= 4) {
          data[index] &= 0b11100000
          states[index] = 0
          type = 0
        } else {
          const op = [
            [complexMap.wall_we, complexMap.wall_w],
            [complexMap.wall_we, complexMap.wall_e],
            [complexMap.wall_ns, complexMap.wall_n],
            [complexMap.wall_ns, complexMap.wall_s],
          ][fromDirection]
          if (type !== op[1]) {
            data[index] &= 0b11100000
            if (type === complexMap.wall_all || type === op[0]) {
              type = op[1]
              states[index] = op[1]
              alive[index] = 1
              dirty = true
            } else {
              type = 0
              states[index] = 0
            }
          }
        }
      }
      if (type === 0) {
        data[index] |= 0b01
        alive[index] = 1
        dirty = true
        if (!(d >>> 5)) {
          data[index] |= ((fromDirection + 1) << 5)
        }
      } else if (type === 1) {
        data[index] |= 0b11
      } else {
        if (!(blockHoles[type][fromDirection] & fromHoles)) {
          data[index] |= 0b10
        } else {
          data[index] |= 0b110
          alive[index] = 1
          dirty = true
          if (!(d >>> 5)) {
            data[index] |= ((fromDirection + 1) << 5)
          }
        }
      }
    }
  }
  // find blocks to clear
  if (!jigsaws.length && !gen) {
    await log('Finding blocks to clear')
    const ids = rawpalette.map(ent => ent.Name)
    /** @type {(arr: string[]) => Set<number>} */
    const makeSet = arr => new Set(arr.filter(n => ids.includes(n)).map(n => ids.indexOf(n)))
    
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
    // console.log(fallableSet)
    const counts = {}
    const redstoneComponents = new Set()
    for (let i = layerSize; i < data.length; i++) {
      const state = getState(i)
      if (!data[i] && state !== 0) {
        const id = ids[state]
        if (!id.endsWith('air')) {
          data[i] = 0b1001
          counts[id] = (counts[id] ?? 0) + 1
          if (data[i + layerSize] && fallableSet.has(getState(i + layerSize))) {
            data[i] = id === 'minecraft:cobblestone' ? 0 : 0b1010
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
                      toAdd[['west', 'east', 'north', 'south', 'down', 'up'].indexOf(p.facing ?? '')] = 1
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
      await log('Redstone component detected. Make sure to check them manually!')
      for (const i of redstoneComponents) {
        const state = getState(i)
        if (data[i] & 0b1000) {
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
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
    if (sorted.length === 0) {
      await log('This litematic is already perfect for this tool!')
      return
    } else {
      log('This mask can help you save:')
      const top10 = sorted.slice(0, 10)
      const idMax = Math.max(...top10.map(v => v[0].length))
      const countMax = Math.max(...top10.map(v => v[1])).toLocaleString().length
      const leaderboard = top10.map((v, i) =>
        `${(i + 1).toString().padStart(2)}. ${v[0].padEnd(idMax)}  ${v[1].toLocaleString().padStart(countMax)}`
      )
      for (const line of leaderboard) {
        log(line)
      }
      if (sorted.length > 10) {
        await log(`and ${sorted.slice(10).map(v => v[1]).reduce((a, b) => a + b).toLocaleString()} more...!`)
      } else {
        await log('='.repeat(4 + idMax + 2 + countMax + 2))
      }
    }
  } else {
    await log(`Inside Marker (${options.insideMarker}) detected. Generating ${gen ? 'patches' : 'paths'}.`)
    if (gen) {
      let i = patched.indexOf(0b11)
      while (i >= 0) {
        data[i] = data[i] & 0b11100000 | 0b1001
        i = patched.indexOf(0b11, i + 1)
      }
    } else {
      for (let i of jigsaws) {
        while (i < data.length) {
          data[i] = data[i] & 0b11100000 | 0b1001
          i += offsets[(data[i] >>> 5) - 1]
        }
      }
    }
  }
  // export as litematic mask
  await log('Exporting as litematic mask')
  let totalBlocks = 0
  const longArr = new BigUint64Array(Math.ceil(data.length * 2 / 64))
  index = 0
  buf = 0n
  bufs = 0n
  const mask64 = (1n << 64n) - 1n
  for (const d of data) {
    if (d & 0b1000) {
      buf |= ((d & 0b10) ? 2n : 1n) << bufs
      totalBlocks++
    }
    bufs += 2n
    if (bufs >= 64n) {
      longArr[index++] = buf & mask64
      buf >>= 64n
      bufs -= 64n
    }
  }
  if (bufs > 0n) {
    longArr[index] = buf
  }
  await log(`Total Blocks: ${totalBlocks.toLocaleString()}`)
  const nbt = new NBT.NBTData({
    Version: new NBT.Int32(6),
    SubVersion: new NBT.Int32(1),
    MinecraftDataVersion: new NBT.Int32(3700), // 1.21
    Metadata: {
      Name: root.data.Metadata.Name + ` ${jigsaws.length ? 'Patch' : 'Clear'} Mask`,
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
        { Name: 'minecraft:stone' },
        { Name: 'minecraft:cobblestone' }
      ],
      BlockStates: longArr
    }}
  })
  const outFile = filename.slice(0, -'.litematic'.length) + '-mask.litematic'
  //@ts-ignore
  downloadBlob(outFile, await NBT.write(nbt, { endian: 'big', compression: 'gzip' }))
  await log(`Done. Exported as ${outFile}.`)
}
