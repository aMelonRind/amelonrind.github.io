module.exports = 0

const url = 'https://raw.githubusercontent.com/rebane2001/mapartcraft/refs/heads/master/src/components/mapart/json/coloursJSON.json'
const version = '&1.20'
const defaultPalette = [
  'air',
  'grass_block',
  'sandstone_slab',
  'mushroom_stem',
  'redstone_block',
  'packed_ice',
  'iron_block',
  'oak_leaves[persistent=true]',
  'white_wool',
  'clay',
  'jungle_slab',
  'cobblestone',
  'water',
  'oak_slab',
  'diorite_slab',
  'orange_wool',
  'magenta_wool',
  'light_blue_wool',
  'yellow_wool',
  'lime_wool',
  'pink_wool',
  'gray_wool',
  'light_gray_wool',
  'cyan_wool',
  'purple_wool',
  'blue_wool',
  'brown_wool',
  'green_wool',
  'red_wool',
  'black_wool',
  'gold_block',
  'prismarine_brick_slab',
  'lapis_block',
  'emerald_block',
  'spruce_slab',
  'netherrack',
  'cherry_slab',
  'orange_terracotta',
  'magenta_terracotta',
  'light_blue_terracotta',
  'yellow_terracotta',
  'lime_terracotta',
  'pink_terracotta',
  'gray_terracotta',
  'light_gray_terracotta',
  'cyan_terracotta',
  'purple_terracotta',
  'blue_terracotta',
  'brown_terracotta',
  'green_terracotta',
  'red_terracotta',
  'black_terracotta',
  'crimson_nylium',
  'crimson_slab',
  'crimson_hyphae',
  'warped_nylium',
  'warped_slab',
  'warped_hyphae',
  'warped_wart_block',
  'deepslate',
  'raw_iron_block',
  'verdant_froglight'
]

const fs = require('node:fs')

async function nodePalette() {
  const raw = await fetch(url).then(res => res.json())
  const rebane = Object.keys(raw).map(() => [])
  /** @type {{ [index: string]: number }} */
  const unusualIndexDict = {}
  /** @type {Set<string>} */
  const nsb = new Set()
  console.log(`size: ${rebane.length}`)
  for (const [sIndex, { blocks, mapdatId }] of Object.entries(raw)) {
    const index = parseInt(sIndex)
    if (isNaN(index)) {
      console.warn(`index is NaN (${sIndex})`)
      continue
    }
    if (index < 0 || index >= rebane.length) {
      console.warn(`index out of bound (${index})`)
      continue
    }
    if (rebane[index].length > 0) {
      console.warn(`index ${index} was already generated`)
      continue
    }
    if (mapdatId != index + 1) {
      // console.warn(`mapdatId for index ${index} is not index + 1 (${mapdatId})`)
      unusualIndexDict[sIndex] = mapdatId
    }
    for (const { validVersions, supportBlockMandatory, presetIndex } of Object.values(blocks)) {
      if (rebane[index][presetIndex]) {
        console.warn(`duplicate entry for presetIndex ${presetIndex} in index ${index}`)
        continue
      }
      /** @type {string | object} */
      let data = version
      while (typeof data === 'string') {
        data = validVersions[data.slice(1)]
      }
      if (!data || typeof data !== 'object') {
        // it's just not available in the version
        // console.warn(`cannot find valid block for presetIndex ${presetIndex} in index ${index}`)
        continue
      }
      let { NBTName: name, NBTArgs } = data
      if (supportBlockMandatory) {
        nsb.add(name)
      }
      if (!isEmpty(NBTArgs)) {
        name += `[${Object.entries(NBTArgs).map(([key, value]) => `${key}=${value}`).sort().join(',')}]`
      }
      rebane[index][presetIndex] = name
    }
  }
  for (const r of [
    "beacon",
    "brewing_stand",
    "cobweb",
    "iron_trapdoor",
    "pumpkin",
    "slime_block",
    "water", // special case
  ]) {
    nsb.delete(r)
  }
  const needSupportBlock = Array.from(nsb).filter(v => !v.endsWith('_slab') && !v.endsWith('_stained_glass')).sort()
  const res = {
    defaultPalette,
    rebane,
    unusualIndexDict,
    needSupportBlock
  }
  fs.promises.writeFile('./palette.json', JSON.stringify(res, undefined, '  '))
  console.log('exported.')
  const nTypes = [
    '_pressure_plate',
    '_carpet',
    '_concrete_powder'
  ]
  const nConfirmed = new Set([
    'glow_lichen',
    'gravel',
    'pointed_dripstone',
    'red_sand',
    'sand',
    'snow',
    'white_candle'
  ])
  const manual = needSupportBlock.filter(id => !nTypes.some(suf => id.endsWith(suf)) && !nConfirmed.has(id))
  if (manual.length) {
    console.log(`note that the needSupportBlock list needs manual validation.\nspecifically ${manual.join(', ')}`)
  }
}

function isEmpty(obj) {
  for (const _ in obj) return false
  return true
}

nodePalette()
