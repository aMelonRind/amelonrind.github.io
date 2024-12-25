//@ts-check
import definition from "./eventDefinition.json" with { type: "json" }
import initWasm, { LevelSet, calc as wasmCalc, RawLevels } from "./wasm/pkg/event_item_calc.js"
await initWasm()

const emptyIcon = 'https://static.miraheze.org/bluearchivewiki/thumb/8/8f/Item_Icon_Event_Item_0.png/90px-Item_Icon_Event_Item_0.png'

const root = document.getElementById('script-root') ?? document.body

/**
 * @typedef {typeof events['Get Hyped and March On!']} EventDefinition
 */
const defEvent = definition.default
export const events = definition.events

const state = {
  selectedName: '',
  /** @type {EventDefinition?} */
  selected: null,
  /** @type {HTMLInputElement[]} */
  bonuses: [],
  /** @type {HTMLInputElement[]} */
  requires: []
}

const eventSelectDiv = document.createElement('div')
const eventLabel = document.createElement('label')
eventLabel.classList.add('generic-label')
eventLabel.id = 'eventLabel'
eventLabel.htmlFor = 'eventSelect'
eventLabel.innerText = 'Event:'
const eventSelect = document.createElement('select')
eventSelect.id = 'eventSelect'
eventSelectDiv.append(eventLabel, eventSelect)

const wikiDiv = document.createElement('div')
wikiDiv.style.visibility = 'none'
const wikiLabel = document.createElement('label')
wikiLabel.classList.add('generic-label')
wikiLabel.id = 'wikiLabel'
wikiLabel.htmlFor = 'wikiLink'
wikiLabel.innerText = 'Wiki:'
const wikiLink = document.createElement('a')
wikiLink.id = 'wikiLink'
wikiLink.target = '_blank'
wikiDiv.append(wikiLabel, wikiLink)

const numberInputs = document.createElement('div')
numberInputs.id = 'numberInputs'

const output = document.createElement('div')
output.id = 'output'
output.style.whiteSpace = 'pre'

async function main() {
  eventSelect.onchange = () => onSelectEvent(eventSelect.value)
  updateEventSelect()

  root.innerHTML = ''
  root.append(eventSelectDiv, wikiDiv, numberInputs, output)

  console.log('loaded!')
}

export function updateEventSelect() {
  eventSelect.options.length = 0
  for (const name in events) {
    const opt = document.createElement('option')
    opt.value = name
    opt.innerText = name
    opt.selected = name === defEvent
    eventSelect.options.add(opt)
  }
  const event = localStorage.getItem('ba-event-item-calc:selectedEvent') ?? defEvent
  onSelectEvent((event in events) ? event : defEvent)
}

function onSelectEvent(event = defEvent) {
  localStorage.setItem('ba-event-item-calc:selectedEvent', event)
  numberInputs.innerHTML = ''
  output.innerText = ''
  state.selectedName = event
  const def = state.selected = events[event] ?? null
  if (!def) return
  if (def.wiki) {
    wikiLink.href = def.wiki
    wikiLink.innerText = def.wiki
    wikiDiv.style.visibility = ''
  } else {
    wikiDiv.style.visibility = 'none'
  }
  const base = { length: def.itemTypes }
  state.bonuses = Array.from(base, () => {
    const e = document.createElement('input')
    e.type = 'number'
    e.classList.add('bonusInput')
    e.onchange = calculate
    return e
  })
  state.requires = Array.from(base, () => {
    const e = document.createElement('input')
    e.type = 'number'
    e.classList.add('requireInput')
    e.onchange = calculate
    return e
  })
  const table = document.createElement('table')

  const headRow = document.createElement('tr')
  headRow.appendChild(document.createElement('td'))
  for (const url of Array.from(base, (_, i) => def.icons[i] || emptyIcon)) {
    const th = document.createElement('th')
    const img = document.createElement('img')
    img.classList.add('item-icon')
    img.src = url
    th.appendChild(img)
    headRow.appendChild(th)
  }

  const bonusesRow = document.createElement('tr')
  const th1 = document.createElement('th')
  th1.innerText = 'Bonuses'
  bonusesRow.appendChild(th1)
  for (const input of state.bonuses) {
    const td = document.createElement('td')
    td.append('+')
    td.appendChild(input)
    td.append('%')
    bonusesRow.appendChild(td)
  }

  const requiresRow = document.createElement('tr')
  const th2 = document.createElement('th')
  th2.innerText = 'Requires'
  requiresRow.appendChild(th2)
  for (const input of state.requires) {
    const td = document.createElement('td')
    td.style.whiteSpace = 'pre'
    td.append(' ')
    td.appendChild(input)
    requiresRow.appendChild(td)
  }

  table.appendChild(headRow)
  table.appendChild(bonusesRow)
  table.appendChild(requiresRow)
  
  try {
    const data = getStoredInputs()[event]
    if (data) {
      state.bonuses.forEach((e, i) => e.valueAsNumber = data.bonuses[i])
      state.requires.forEach((e, i) => e.valueAsNumber = data.requires[i])
      calculate()
    }
  } catch {}

  numberInputs.appendChild(table)
}

async function calculate() {
  const def = state.selected
  if (!def) return

  const bonusesInput = Uint16Array.from(state.bonuses, input => Math.max(0, Math.min(65535, input.valueAsNumber || 0)))
  const bonuses = Float32Array.from(bonusesInput, v => v / 100 + 1)
  const requires = Uint32Array.from(state.requires, input => Math.max(-1, Math.min(4294967295, input.valueAsNumber || 0)))

  const data = getStoredInputs()
  data[state.selectedName] = {
    bonuses: Array.from(bonusesInput),
    requires: Array.from(requires)
  }
  localStorage.setItem('ba-event-item-calc:inputs', JSON.stringify(data))

    /** @type {Float64Array} */
  const rcpDummy = new Float64Array(0)
  /** @type {Float32Array} */
  const normDummy = new Float32Array(0)
  const amountsGen = n => {
    const arr = new Uint32Array(def.levels.length)
    arr[n] = 1
    return arr
  }
  /** @type {(CalculatedLevel & { name: string })[]} */
  const rawLevels = def.levels.map((d, i) => ({
    name: `q${i + 1}`,
    amounts: amountsGen(i),
    ap: d.ap,
    /** @type {Uint32Array} */
    items: Uint32Array.from(bonuses, (b, i) => Math.ceil(roundFloat((d.items[i] ?? 0) * b))),
    normalized: normDummy,
    bitflag: d.items.slice(0, bonuses.length).reduce((p, v, i) => p | (+(v > 0) << i), 0),
    futurebits: 0,
    itemRcp: rcpDummy
  }))
  
  const list = rawLevels.map((l, i) => [
    l.name,
    l.ap + 'AP',
    ...Array.from(l.items, v => `${v || '-'}`),
    '  ',
    // calculate minimal bonus to get this amount
    ...Array.from(l.items, (v, j) => v ? `+${Math.max(0, Math.floor(roundFloat(((v - 1) / def.levels[i].items[j] - 1) * 20)) + 1) * 5}%` : '-')
  ])
  const maxs = Uint8Array.from(list[0], (_, i) => Math.max(...list.map(v => v[i].length)))
  const log = list.map(row => row.map((v, i) => i === 0 ? v.padEnd(maxs[i], ' ') : v.padStart(maxs[i], ' ')).join(' '))
  log.unshift('Levels with bonus:')
  log.push('')
  for (const rl of rawLevels) {
    rl.normalized = Float32Array.from(rl.items, v => v / rl.ap)
  }

  /** @type {CalculatedLevel[]} */
  let levels = rawLevels.filter(level => {
    const a = level.normalized
    return rawLevels.every(l => {
      if (level === l) return true
      const d = l.normalized.map((v, i) => a[i] - v)
      if (d.some(v => v > 0)) return true
      if (d.every(v => v === 0)) {
        if (level.ap <= l.ap) return true
        log.push(`${level.name} has been out by ${l.name} for being the same but more AP requirement.`)
      } else {
        log.push(`${level.name} has been out by ${l.name} for being less efficient.`)
      }
      return false
    })
  })
  const mask = requires.reduce((p, v, i) => p | (+(v > 0) << i), 0)
  levels = levels.filter(level => {
    if (!(level.bitflag & mask)) {
      log.push(`${level.name} has been filtered out because it's not needed.`)
      return false
    }
    return true
  })

  const bits = rawLevels.reduce((p, v) => p | v.bitflag, 0)
  if (bits < (1 << requires.length) - 1) {
    for (let i = requires.length; i >= 0; i--) {
      if ((bits & (1 << i)) === 0) {
        requires[i] = 0
        log.push(`Removing item requirement index ${i} because there's no level to get it from.`)
      }
    }
  }

  /** @type {CalculatedLevel[]} */
  const groupLevels = levels.flatMap((a, i) => levels.slice(i + 1).map(b => ({
    amounts: a.amounts.map((v, i) => v + b.amounts[i]),
    ap: a.ap + b.ap,
    items: a.items.map((v, i) => v + b.items[i]),
    normalized: normDummy,
    bitflag: a.bitflag | b.bitflag,
    futurebits: NaN,
    itemRcp: rcpDummy
  })))
  for (const gl of groupLevels) {
    gl.normalized = Float32Array.from(gl.items, v => v / gl.ap)
  }
  for (const ap of new Set(rawLevels.map(l => l.ap))) {
    const group = rawLevels.filter(l => l.ap === ap)
    for (let size = 3; size <= group.length; size++) {
      for (let i = 0; i + size <= group.length; i++) {
        const ls = group.slice(i, i + size)
        const amounts = new Uint32Array(rawLevels.length)
        const items = new Uint32Array(def.itemTypes)
        for (const l of ls) {
          for (let i = 0; i < rawLevels.length; i++) {
            amounts[i] += l.amounts[i]
          }
          for (let i = 0; i < def.itemTypes; i++) {
            items[i] += l.items[i]
          }
        }
        const ap = ls.reduce((p, v) => p + v.ap, 0)
        groupLevels.push({
          amounts,
          ap,
          items,
          normalized: Float32Array.from(items, v => v / ap),
          bitflag: ls.reduce((p, v) => p | v.bitflag, 0),
          futurebits: NaN,
          itemRcp: rcpDummy
        })
      }
    }
  }
  groupLevels.forEach(l => l.normalized = Float32Array.from(l.items, v => v / l.ap))
  levels.push(...groupLevels)
  levels = levels.filter(level => {
    if (!(level.bitflag & mask)) return false
    const a = level.normalized
    return levels.every(l => {
      if (level === l) return true
      const d = l.normalized.map((v, i) => a[i] - v)
      return d.some(v => v > 0) || level.ap <= l.ap && d.every(v => v === 0)
    })
  })
  for (const level of levels) level.itemRcp = Float64Array.from(level.items, v => 1 / v)

  log.push(`Level pool for approach1: ${levels.length}\n`)

  def.transferRates // TODO use this
  // too hard to implement

  const time = performance.now()
  const wasmRaws = new RawLevels(def.itemTypes)
  rawLevels.forEach(({ ap, items }, i) => wasmRaws.push(i, ap, items))
  const approach2 = wasmRaws.approach2(requires)
  const levelSets = levels.map(l => new LevelSet(l.amounts, l.ap, Uint32Array.from(l.items), l.bitflag))
  const approach1 = wasmCalc(levelSets, requires, approach2.ap)

  const lower = approach1.ap < approach2.ap
  const wasmRes = lower ? approach1 : approach2
  log.push(`Main calculation costs ${(performance.now() - time).toFixed(1)}ms.`)
  if (wasmRes.ap === 4294967295) {
    log.push(`Didn't find any route for some reason...`)
  } else outer: {
    log.push(
      `Explored ${approach2.count} + ${approach1.count} possibilities, found this route:`,
      `Approach: ${lower ? 1 : 2}`,
      `Uses ${wasmRes.ap} AP.`,
      `Route: ${Array.from(wasmRes.amounts, (v, i) => v && `${v}x q${i + 1}`).filter(v => v).join(', ')}`,
      'Performing further approach...\n'
    )
    output.innerText = log.join('\n') + '\n'.repeat(24)
    await new Promise(res => setTimeout(res, 1))

    levels = rawLevels.filter(level => {
      const a = level.normalized
      return rawLevels.every(l => {
        if (level === l) return true
        const d = l.normalized.map((v, i) => a[i] - v)
        if (d.some(v => v > 0)) return true
        return level.ap > l.ap && Number.isInteger(level.ap / l.ap)
      })
    })
    levels.sort((a, b) => b.bitflag - a.bitflag)
    let bits = 0
    for (let i = levels.length - 1; i >= 0; i--) {
      levels[i].futurebits = bits
      bits |= levels[i].bitflag
    }
    for (const level of levels) level.itemRcp = Float64Array.from(level.items, v => 1 / v)

    /** @type {{ [name: string]: CalculatedLevel }} */
    const byName = {}
    for (const l of levels) {
      byName[l.name ?? ''] = l
    }
    /** @type {Uint32Array} */
    const counts = wasmRes.amounts.slice()
    let lastAP = counts.reduce((p, v, i) => v ? p + v * rawLevels[i].ap : p, 0)

    const time = performance.now()
    let count = 0
    const clones = levels.map(() => new Uint32Array(requires.length)) // for performace
    while (true) {
      const clone = Uint32Array.from(requires)
      let extractedAP = 0
      const extractedRoute = new Uint32Array(rawLevels.length)
      for (const [i, v] of counts.entries()) {
        const l = rawLevels[i]
        if (v <= 3) {
          counts[i] = 0

          extractedAP += v * l.ap
          extractedRoute[i] += v
        } else {
          counts[i] -= 3

          for (let j = 0; j < clone.length; j++) {
            if (l.items[j] && clone[j]) {
              clone[j] = Math.max(0, clone[j] - l.items[j] * counts[i])
            }
          }

          extractedAP += 3 * l.ap
          extractedRoute[i] += 3
        }
      }

      const collector = new Collector(rawLevels, clone)
      collector.collect(extractedAP, [[extractedRoute, 1]])
      calcFurther(levels, 0, clone, clones, 0, [], collector)
      for (const [i, amount] of collector.route.entries()) {
        counts[i] += amount
      }

      count++
      const ap = counts.reduce((p, v, i) => v ? p + v * rawLevels[i].ap : p, 0)
      if (ap === lastAP) break
      if (ap < lastAP) lastAP = ap
    }
    log.push(
      `Further recursive calculation iterated ${count} time${count === 1 ? '' : 's'}, costs ${(performance.now() - time).toFixed(1)}ms.`,
      'Result:\n'
    )

    let sumAP = 0
    let sumAPForItem0 = 0
    const sumItems = new Uint32Array(requires.length)
    const list = [...counts.entries()].filter(([, v]) => v).sort(([, a], [, b]) => b - a).map(([i, amount]) => {
      const l = rawLevels[i]
      const ap = l.ap * amount
      sumAP += ap
      if (l.bitflag === 1) sumAPForItem0 += ap
      return [
        amount + 'x',
        l.name,
        ap + 'AP',
        ...Array.from(l.items, (v, i) => {
          const n = v * amount
          sumItems[i] += n
          return n.toString()
        })
      ]
    })
    if (list.length === 0) {
      log.push('Empty')
      break outer
    }
    list.push(
      ['', '', sumAP + 'AP', ...Array.from(sumItems, v => v.toString())],
      ['', '', '', ...Array.from(requires, v => v.toString())]
    )
    const maxs = Uint8Array.from(list[0], (_, i) => Math.max(...list.map(v => v[i].length)))
    maxs[1] = Math.max(maxs[1], 'sum'.length - 1 - maxs[0])
    maxs[2] = Math.max(maxs[2], 'requires'.length - 1 - maxs[0] - 1 - maxs[1])
    const strList = list.map(row => row.map((v, i) => i === 1 ? v.padEnd(maxs[i], ' ') : v.padStart(maxs[i], ' ')).join(' '))
    const len = strList.length
    strList[len - 2] = 'sum' + strList[len - 2].slice(3)
    strList[len - 1] = 'requires' + strList[len - 1].slice(8)
    log.push(
      strList.join('\n'),
      `\nSum AP for non-first items: ${sumAP - sumAPForItem0}`
    )
  }

  output.innerText = log.join('\n') + '\n'.repeat(8)
}

/**
 * this recursive function sacrificed some readability for performance.
 * @param {CalculatedLevel[]} levels 
 * @param {number} lvIndex 
 * @param {Uint32Array} requires 
 * @param {Uint32Array[]} clones for performance
 * @param {number} usedAP 
 * @param {[Uint32Array, number][]} route 
 * @param {Collector} collector 
 */
function calcFurther(levels, lvIndex, requires, clones, usedAP, route, collector) {
  // if (usedAP > collector.ap) return // commented out for performance
  const len = requires.length
  let i = 0, j = 0
  endCheck: {
    for (i = 0; i < len; i++) {
      if (requires[i]) break endCheck
    }
    collector.collect(usedAP, route)
    return
  }

  if (lvIndex === levels.length) return
  const { amounts, items, ap, futurebits, itemRcp } = levels[lvIndex]

  let min = 0
  for (i = 0; i < len; i++) {
    if ((~futurebits & (1 << i)) && requires[i]) {
      j = requires[i] * itemRcp[i]
      if (j > min) min = j
    }
  }
  if (min) {
    min = Math.ceil(Math.fround(min))
  }

  if (!futurebits) { // last item
    usedAP += ap * min
    if (usedAP > collector.ap) return
    route.push([amounts, min])
    collector.collect(usedAP, route)
    route.pop()
    return
  }

  const clone = clones[lvIndex]
  for (i = 0; i < len; i++) clone[i] = requires[i]
  lvIndex++

  // do first
  if (min) {
    usedAP += ap * min
    if (usedAP > collector.ap) return
    for (j = 0; j < len; j++) {
      if (items[j] && clone[j]) {
        clone[j] = Math.max(0, clone[j] - items[j] * min)
      }
    }
    route.push([amounts, min])
    calcFurther(levels, lvIndex, clone, clones, usedAP, route, collector)
    route.pop()
  } else {
    calcFurther(levels, lvIndex, clone, clones, usedAP, route, collector) // 0
  }

  let clear = true
  for (i = min + 1;; i++) {
    usedAP += ap
    if (usedAP > collector.ap) break
    clear = true
    for (j = 0; j < len; j++) {
      if (items[j] && clone[j]) {
        clone[j] = Math.max(0, clone[j] - items[j])
        clear = false
      }
    }
    if (clear) break
    route.push([amounts, i])
    calcFurther(levels, lvIndex, clone, clones, usedAP, route, collector)
    route.pop()
  }
}

class Collector {
  count = 0
  ap = Infinity
  /** @readonly @type {Uint32Array} */
  route
  dirty = false
  /** @readonly @type {CalculatedLevel[]} */
  def
  /** @readonly @type {Uint32Array} */
  req
  extra = -1

  /**
   * @param {CalculatedLevel[]} def 
   */
  constructor (def, req) {
    this.route = new Uint32Array(def.length)
    this.def = def
    this.req = req
  }

  /**
   * @param {number} ap 
   * @param {[Uint32Array, number][]} route 
   */
  collect(ap, route) {
    this.count++
    if (ap > this.ap) return
    if (ap < this.ap) {
      this.ap = ap
      this.dirty = true
      this.route.fill(0)
      for (const [amounts, multiplier] of route) {
        for (let i = 0; i < amounts.length; i++) {
          this.route[i] += amounts[i] * multiplier
        }
      }
      this.extra = this.calcExtra(this.route)
    } else {
      const res = new Uint32Array(this.def.length)
      for (const [amounts, multiplier] of route) {
        for (let i = 0; i < amounts.length; i++) {
          res[i] += amounts[i] * multiplier
        }
      }
      const extra = this.calcExtra(res)
      if (extra > this.extra) {
        this.dirty = true
        this.route.set(res)
        this.extra = extra
      }
    }
  }

  /**
   * @param {Uint32Array} route 
   */
  calcExtra(route) {
    const items = new Uint32Array(this.def[0].items.length)
    for (const [lv, amount] of route.entries()) {
      for (const [i, count] of this.def[lv].items.entries()) {
        items[i] += amount * count
      }
    }
    for (const [i, count] of this.req.entries()) {
      items[i] -= count
    }
    let clean = true
    for (let i = 2; i < items.length; i++) {
      const d = items[i - 1] / 5
      if (!Number.isInteger(d)) return -1
      if (d !== 0) {
        items[i] += d
        clean = false
      }
    }
    if ((items.at(-1) ?? 0) % 5 !== 0) return -1
    return (items[0] || Infinity) + (clean ? 0.5 : 0)
  }
}

/**
 * @returns {{ [event: string]: {
 *  bonuses: number[],
 *  requires: number[]
 * } }}
 */
function getStoredInputs() {
  const raw = localStorage.getItem('ba-event-item-calc:inputs')
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {}
  return {}
}

/**
 * @param {number} n 
 */
function roundFloat(n) {
  return Math.round(n * 10000) / 10000
}

main()

/**
 * @typedef {{
 *  name?: string;
 *  amounts: Uint32Array;
 *  ap: number;
 *  items: Uint32Array;
 *  normalized: Float32Array;
 *  bitflag: number;
 *  futurebits: number;
 *  itemRcp: Float64Array;
 * }} CalculatedLevel
 */
