//@ts-check

class Equipment {
  /** @readonly @type {string} */ name
  /** @readonly @type {number} */ physical
  // /** @readonly @type {number} */ magic
  /** @readonly @type {number} */ critChance
  /** @readonly @type {number} */ critDmg
  /** @readonly @type {number} */ gemSlots

  // /** @readonly @type {boolean} */ meleeOnly
  // /** @readonly @type {boolean} */ magicOnly
  // /** @readonly @type {boolean} */ noCritStat
  /** @readonly @type {boolean} */ critChanceOnly

  /**
   * @param {string} name 
   * @param {{ physical?: number, critChance?: number, critDmg?: number, gemSlots?: number }} attributes 
   */
  constructor(name, { physical = 0, critChance = 0, critDmg = 0, gemSlots = 0 }) {
    if (!physical && !critChance && !critDmg && !gemSlots) {
      throw `There's equipment with zero stats (${name})`
    }
    this.name = name
    this.physical = physical
    // this.magic = magic
    this.critChance = critChance
    this.critDmg = critDmg
    this.gemSlots = gemSlots

    // this.noCritStat = !critChance && !critDmg && !gemSlots
    // this.meleeOnly = this.noCritStat && !magic
    // this.magicOnly = this.noCritStat && !physical
    this.critChanceOnly = !physical && !critDmg && !gemSlots
  }
}

class GemFactory {
  /** @readonly @type {string} */ name
  /** @readonly @type {string} */ attribute
  /** @readonly @type {number} */ min
  /** @readonly @type {number} */ max

  /**
   * @param {string} name 
   * @param {'physical' | 'critChance' | 'critDmg'} attribute 
   * @param {number} min 
   * @param {number} max 
   */
  constructor(name, attribute, min, max) {
    this.name = name
    this.attribute = attribute
    this.min = min
    this.max = max
  }

  /**
   * @param {number} quality 
   */
  build(quality) {
    return new Equipment(this.name, { [this.attribute]: this.min + (this.max - this.min) * quality })
  }

}

// const boots = [
//   new Equipment('四級鞋子', { physical: 30, gemSlots: 2 }),
//   new Equipment('炙炎流星鞋子', { physical: 14, gemSlots: 2 }),
//   new Equipment('日曜堅盾鞋子', { physical: 8, gemSlots: 2 }),
//   new Equipment('弒神鞋子', { critChance: 3, critDmg: 20, gemSlots: 2 }),
//   new Equipment('霓虹伊甸鞋子', { gemSlots: 2 }),
//   new Equipment('末日救贖鞋子', { physical: 50, critChance: 10, critDmg: 50, gemSlots: 2 }),
// ]

const engraves = [
  // new Equipment('爆裂魔法師刻印', { magic: 30 }),
  new Equipment('獵頭者刻印', { critChance: 6, critDmg: 40 }),
  // new Equipment('高階槍手刻印', { physical: 20 }), // 比收割者刻印弱
  new Equipment('收割者刻印', { physical: 40, critChance: 8 }),
]

const talisman = [
  new Equipment('戰爭護符', { physical: 15 }),
  // new Equipment('咒靈護符', { magic: 20 }),
  new Equipment('火力護符', { critChance: 9 }),
  new Equipment('將軍護符', { critDmg: 50 }),
]

const rings = [
  new Equipment('爆能戒指', { physical: 12 }),
  // new Equipment('永夜戒指', { magic: 18 }),
  new Equipment('爆率戒指IV', { critChance: 8 }),
  new Equipment('爆傷戒指IV', { critDmg: 40 }),
]

const gems = [
  new GemFactory('傷害寶石', 'physical', 20, 25),
  // new GemFactory('法傷寶石', 'magic', 40, 45),
  new GemFactory('暴率寶石', 'critChance', 8, 10),
  new GemFactory('暴傷寶石', 'critDmg', 70, 75),
]

class ResultCollector {
  /** @readonly @type {number} */ amount
  /** @readonly @type {{ name(): string, score: number }[]} */ list = []

  constructor(amount = 20) {
    this.amount = amount
  }

  /**
   * @param {() => string} nameGetter 
   * @param {number} score 
   * @returns 
   */
  collect(nameGetter, score) {
    if (this.list.length < this.amount) {
      this.list.push({ name: nameGetter, score })
      this.list.sort((a, b) => b.score - a.score)
    } else {
      //@ts-ignore
      if (this.list.at(-1)?.score > score) return
      this.list.push({ name: nameGetter, score })
      this.list.sort((a, b) => b.score - a.score)
      this.list.length = this.amount
    }
  }

}

// /** @typedef {'none' | 'physical' | 'magic'} DamageType */
// /** @type {{ [K in DamageType]: (physical?: number, magic?: number, critChance?: number, critDmg?: number) => number }} */
// const scoreFunc = {
//   none: (physical = 0, magic = 0, critChance = 0, critDmg = 200) => baseScoreFunc(100, critDmg, critChance),
//   physical: (physical = 0, magic = 0, critChance = 0, critDmg = 200) => baseScoreFunc(physical + 100, critDmg, critChance),
//   magic: (physical = 0, magic = 0, critChance = 0, critDmg = 200) => baseScoreFunc(magic + 100, critDmg, critChance)
// }
function scoreFunc(base = 100, chance = 0, crit = 200) {
  base += 100
  if (chance <= 0) return base / 100
  else if (chance >= 100) return base * crit / 10000
  return (base / 100) * ((crit / 100 - 1) * (chance / 100) + 1)
}
// /** @type {{ [K in DamageType]: (e: Equipment) => boolean }} */
// const equipmentFilter = {
//   none: e => !e.noCritStat,
//   physical: e => !e.magicOnly,
//   magic: e => !e.meleeOnly
// }

/**
 * param {keyof typeof scoreFunc} damageType 
 * @param {number} basePhysical 
 * param {number} baseMagic 
 * @param {number} baseCritChance 
 * @param {number} baseCritDmg 
 * @param {number} gemSlots 
 * @param {boolean} critOnly 
 * @param {number} amount 
 */
function calcStats(equipments = [engraves, talisman, rings, rings], basePhysical = 0, baseCritChance = 0, baseCritDmg = 200, gemSlots = 10, gemQuaity = 0.995, critOnly = false, amount = 20) {
  const list = equipments
  const collector = new ResultCollector(amount)
  iterate('', list, 0, gems.map(f => f.build(gemQuaity)), gemSlots, basePhysical, baseCritChance, baseCritDmg, critOnly, collector)
  return collector.list
}

/**
 * @param {string} nameStack 
 * @param {Equipment[][]} list 
 * @param {number} index 
 * @param {Equipment[]} gems 
 * @param {number} gemSlots 
 * param {scoreFunc['none']} scoreFunc 
 * @param {number} physical 
 * param {number} magic 
 * @param {number} critChance 
 * @param {number} critDmg 
 * @param {boolean} critOnly 
 * @param {ResultCollector} collector 
 */
function iterate(nameStack, list, index, gems, gemSlots, physical, critChance, critDmg, critOnly = false, collector) {
  if (index >= list.length) {
    iterateGems(nameStack + '\n', gems, 0, gemSlots, physical, critChance, critDmg, critOnly, collector)
    return
  }
  for (const e of list[index]) {
    if (e.critChanceOnly && critChance >= 100) continue
    iterate(`${nameStack}${index === 4 ? '\n' : ', '}${e.name}`, list, index + 1, gems, gemSlots + e.gemSlots, physical + e.physical, critChance + e.critChance, critDmg + e.critDmg, critOnly, collector)
  }
}

/**
 * @param {string} nameStack 
 * @param {Equipment[]} gems 
 * @param {number} index 
 * @param {number} gemSlots 
 * param {scoreFunc['none']} scoreFunc 
 * @param {number} physical 
 * param {number} magic 
 * @param {number} critChance 
 * @param {number} critDmg 
 * @param {boolean} critOnly 
 * @param {ResultCollector} collector 
 */
function iterateGems(nameStack, gems, index, gemSlots, physical, critChance, critDmg, critOnly = false, collector) {
  if (index >= gems.length || !gemSlots) {
    if (critOnly && critChance < 100) return
    const score = scoreFunc(physical, critChance, critDmg)
    collector.collect(() => `${nameStack.replace(/^, /gm, '')}\nDmg: +${physical.toFixed(3).replace(/\.?0+$/, '')}%, CC: ${critChance.toFixed(3).replace(/\.?0+$/, '')}%, CD: ${critDmg.toFixed(3).replace(/\.?0+$/, '')}%\nScore: ${Math.round(score * 1e12) / 1e12}`, score)
    return
  }
  const gem = gems[index]
  if (index === gems.length - 1) {
    iterateGems(`${nameStack}, ${gemSlots}x ${gem.name}`, gems, index + 1, 0, physical + gem.physical * gemSlots, critChance + gem.critChance * gemSlots, critDmg + gem.critDmg * gemSlots, critOnly, collector)
  } else if (gem.critChanceOnly && critOnly) {
    const need = Math.max(0, Math.ceil((100 - critChance) / gem.critChance))
    if (gemSlots < need) return
    iterateGems(need ? `${nameStack}, ${need}x ${gem.name}` : nameStack, gems, index + 1, gemSlots - need, physical, critChance + gem.critChance * need, critDmg, critOnly, collector)
  } else {
    const max = gem.critChanceOnly ? Math.min(Math.max(0, Math.ceil((100 - critChance) / gem.critChance)), gemSlots) : gemSlots
    for (let i = 0; i <= max; i++) {
      iterateGems(i ? `${nameStack}, ${i}x ${gem.name}` : nameStack, gems, index + 1, gemSlots - i, physical + gem.physical * i, critChance + gem.critChance * i, critDmg + gem.critDmg * i, critOnly, collector)
    }
  }
}
