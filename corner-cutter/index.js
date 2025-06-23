//@ts-check
import * as NBT from "./npm/nbtify/dist/index.js"
import suffocatable from "./src/suffocatable.json" with { type: "json" }
import fallable from "./src/fallable.json" with { type: "json" }

let logHistory = ''

async function main() {
  const shouldIgnore = n => n instanceof HTMLInputElement
  window.addEventListener('dragover', e => {
    if (shouldIgnore(e.target)) return
    e.preventDefault()
  })
  window.addEventListener('drop', e => {
    if (shouldIgnore(e.target)) return
    e.preventDefault()
    readItems(e.dataTransfer?.items)
  })
  window.addEventListener('paste', e => {
    if (shouldIgnore(e.target)) return
    readItems(e.clipboardData?.items)
  })

  log('Welcome!')
  log('This website is a simple tool for cutting corners on large minecraft builds.')
  log("This tool accepts litematica file. Drag'n'drop or paste to import.")
  log('You can place some jigsaw block in unreachable area, this tool can help you find unpatched holes.')
  log('Waiting for file...')
}

main()

/**
 * @param {DataTransferItemList | null | undefined} items 
 */
async function readItems(items) {
  if (!items) return
  for (const item of items) {
    if (item.type === 'text/plain' || item.type.startsWith('image/')) return
    if (item.kind !== 'file') return
    const file = item.getAsFile()
    if (!file) continue
    const name = file.name
    if (!name.endsWith('.litematic')) {
      await log(`This tool only accepts litematic file. Received ${name}.`)
      return
    }
    await log(`Reading ${name}...`)

    //@ts-ignore
    await process(await NBT.read(file, { strict: false }), name)
  }
}

/**
 * @param {LitematicNbt} root 
 * @param {string} filename 
 */
async function process(root, filename) {
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
  const sides3DMasks = [
    0b010000001000000000001000,
    0b000001000100000000000100,
    0b100000000000100000000010,
    0b000010000000010000000001,
    0b000100000010000010000000,
    0b000000010001000001000000,
    0b001000000000001000100000,
    0b000000100000000100010000
  ]
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
    0b11110000,
    0b00001111,

    0b11111100, // 'top,north,straight': 4,
    0b11111110, // 'top,north,inner_left': 5,
    0b11111101, // 'top,north,inner_right': 6,
    0b11111000, // 'top,north,outer_left': 7,
    0b11110100, // 'top,north,outer_right': 8,
    0b11110011, // 'top,south,straight': 9,
    0b11110111, // 'top,south,inner_left': 10,
    0b11111011, // 'top,south,inner_right': 11,
    0b11110001, // 'top,south,outer_left': 12,
    0b11110010, // 'top,south,outer_right': 13,
    0b11111010, // 'top,west,straight': 14,
    0b11111011, // 'top,west,inner_left': 15,
    0b11111110, // 'top,west,inner_right': 16,
    0b11110010, // 'top,west,outer_left': 17,
    0b11111000, // 'top,west,outer_right': 18,
    0b11110101, // 'top,east,straight': 19,
    0b11111101, // 'top,east,inner_left': 20,
    0b11110111, // 'top,east,inner_right': 21,
    0b11110100, // 'top,east,outer_left': 22,
    0b11110001, // 'top,east,outer_right': 23,
    0b11001111, // 'bottom,north,straight': 24,
    0b11101111, // 'bottom,north,inner_left': 25,
    0b11011111, // 'bottom,north,inner_right': 26
    0b10001111, // 'bottom,north,outer_left': 27,
    0b01001111, // 'bottom,north,outer_right': 28
    0b00111111, // 'bottom,south,straight': 29,
    0b01111111, // 'bottom,south,inner_left': 30,
    0b10111111, // 'bottom,south,inner_right': 31
    0b00011111, // 'bottom,south,outer_left': 32,
    0b00101111, // 'bottom,south,outer_right': 33
    0b10101111, // 'bottom,west,straight': 34,
    0b10111111, // 'bottom,west,inner_left': 35,
    0b11101111, // 'bottom,west,inner_right': 36,
    0b00101111, // 'bottom,west,outer_left': 37,
    0b10001111, // 'bottom,west,outer_right': 38,
    0b01011111, // 'bottom,east,straight': 39,
    0b11011111, // 'bottom,east,inner_left': 40,
    0b01111111, // 'bottom,east,inner_right': 41,
    0b01001111, // 'bottom,east,outer_left': 42,
    0b00011111, // 'bottom,east,outer_right': 43,

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
   * 255 - jigsaw
   */
  const palette = Uint8Array.from(rawpalette, ent => {
    const name = ent.Name
    if (suffocatable.includes(name)) {
      if (name === 'minecraft:jigsaw') return 255
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
  /**
   * 00000000
   *       00 - none
   *       01 - air
   *       10 - wall - scannable like stairs and slabs and walls
   *       11 - wall
   *      1 - is exposed stairs or slabs or walls
   *     1 - marked as block to clear
   *    1 - (reserved) replace to stone to avoid lighting issue
   * 111 - from direction (1-6)
   */
  const data = new Uint8Array(sy * layerSize)
  globalThis.data = data
  const alive = new Uint8Array((sy + 1) * layerSize).fill(1, sy * layerSize)
  const rawstates = BigUint64Array.from(region.BlockStates)
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
    states[index++] = palette[Number(buf & mask)]
    buf >>= bits
    bufs -= bits
  }
  if (bufs && buf) {
    states[index] = palette[Number(buf)]
  }
  /** @type {number[]} */
  const jigsaws = []
  // scan
  await log('Scanning...')
  // const debugOrig = [-4102, 16, 357]
  // const debugPos = [-3812, 54, 500]
  // const debugIndex = (debugPos[1] - debugOrig[1]) * layerSize + (debugPos[2] - debugOrig[2]) * sx + (debugPos[0] - debugOrig[0])
  let nextLog = 0
  let dirty = false
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
    if (index >= data.length) {
      breath(index - layerSize, 5, 0b1111)
    } else {
      const d = data[index]
      if ((d & 0b11) === 0b11 || (d & 0b111) === 0b010) continue
      const holes = blockHoles[(d & 0b11) === 0b01 ? 0 : states[index]] ?? blockHoles[0]
      // left
      if (index % sx > 0 && holes[0]) {
        breath(index - 1, 1, holes[0])
      }
      // right
      if (index % sx < sx - 1 && holes[1]) {
        breath(index + 1, 0, holes[1])
      }
      // front
      if (Math.floor(index % layerSize / sx) > 0 && holes[2]) {
        breath(index - sx, 3, holes[2])
      }
      // back
      if (Math.floor(index % layerSize / sx) < sz - 1 && holes[3]) {
        breath(index + sx, 2, holes[3])
      }
      // down
      if (Math.floor(index / layerSize) > 1 && holes[4]) { // won't scan the bottom layer
        breath(index - layerSize, 5, holes[4])
      }
      // up
      if (Math.floor(index / layerSize) < sy - 1 && holes[5]) {
        breath(index + layerSize, 4, holes[5])
      }
    }
  }
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
  // find blocks to clear
  if (!jigsaws.length) {
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
    console.log(fallableSet)
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
              // left
              if (i % sx > 0 && toAdd[0]) {
                redstoneComponents.add(i - 1)
              }
              // right
              if (i % sx < sx - 1 && toAdd[1]) {
                redstoneComponents.add(i + 1)
              }
              // front
              if (Math.floor(i % layerSize / sx) > 0 && toAdd[2]) {
                redstoneComponents.add(i - sx)
              }
              // back
              if (Math.floor(i % layerSize / sx) < sz - 1 && toAdd[3]) {
                redstoneComponents.add(i + sx)
              }
              // down
              if (Math.floor(i / layerSize) > 0 && toAdd[4]) {
                redstoneComponents.add(i - layerSize)
              }
              // up
              if (Math.floor(i / layerSize) < sy - 1 && toAdd[5]) {
                redstoneComponents.add(i + layerSize)
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
        await log('and more...!')
      } else {
        await log('='.repeat(4 + idMax + 2 + countMax + 2))
      }
    }
  } else {
    await log('Jigsaw detected. Generating paths')
    const offsets = [-1, 1, -sx, sx, -layerSize, layerSize]
    for (let i of jigsaws) {
      while (i < data.length) {
        data[i] = data[i] & 0b11100000 | 0b1001
        i += offsets[(data[i] >>> 5) - 1]
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
      Name: root.data.Metadata.Name + ' Clear Mask',
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
  downloadBlob(outFile, await NBT.write(nbt, { endian: 'big', compression: 'gzip' }))
  await log(`Done. Exported as ${outFile}.`)
}

/**
 * @param {string} msg 
 */
async function log(msg) {
  logHistory += '\n' + msg
  document.body.textContent = logHistory
  await new Promise(requestAnimationFrame)
}

/**
 * @param {string} fileName 
 * @param {BlobPart} data 
 */
function downloadBlob(fileName, data) {
  const blob = new Blob([data], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  downloadURL(url, fileName)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/**
 * @param {string} dataURL 
 * @param {string} fileName 
 */
function downloadURL(dataURL, fileName) {
  const a = document.createElement('a')
  a.href = dataURL
  a.download = fileName
  a.click()
}
