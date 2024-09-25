//@ts-check

const emptyIcon = ''

const root = document.getElementById('script-root') ?? document.body

/** @type {{default: string, events: { [name: string]: typeof import('./eventDefinition.json')['events']['Get Hyped and March On!'] }}} */
let definition = {
  default: '',
  events: {}
}

const state = {
  /** @type {(typeof import('./eventDefinition.json')['events']['Get Hyped and March On!'])?} */
  selected: null,
  /** @type {HTMLInputElement[]} */
  bonuses: [],
  /** @type {HTMLInputElement[]} */
  requires: []
}

const eventLabel = document.createElement('label')
eventLabel.id = 'eventLabel'
eventLabel.htmlFor = 'eventSelect'
eventLabel.innerText = 'Event:'
const eventSelect = document.createElement('select')
eventSelect.id = 'eventSelect'

const apLabel = document.createElement('label')
apLabel.id = 'apLabel'
apLabel.htmlFor = 'apInput'
apLabel.innerText = 'Max AP:'
const apInput = document.createElement('input')
apInput.type = 'number'
apInput.id = 'apInput'

const wikiDiv = document.createElement('div')
wikiDiv.style.visibility = 'none'
const wikiLabel = document.createElement('label')
wikiLabel.id = 'wikiLabel'
wikiLabel.htmlFor = 'wikiLink'
wikiLabel.innerText = 'Wiki:'
const wikiLink = document.createElement('a')
wikiLink.id = 'wikiLink'
wikiDiv.appendChild(wikiLabel)
wikiDiv.appendChild(wikiLink)

const numberInputs = document.createElement('div')
numberInputs.id = 'numberInputs'

const output = document.createElement('div')
output.id = 'output'
output.style.whiteSpace = 'pre'

async function main() {
  definition = await fetch('eventDefinition.json').then(res => res.json())
  eventSelect.onchange = () => onSelectEvent(eventSelect.value)
  updateEventSelect()

  root.innerHTML = ''
  const br = () => root.appendChild(document.createElement('br'))
  root.appendChild(eventLabel)
  root.appendChild(eventSelect)
  br()
  // root.appendChild(apLabel)
  // root.appendChild(apInput)
  // br()
  root.appendChild(wikiDiv)
  br()
  root.appendChild(numberInputs)
  br()
  root.appendChild(output)

  console.log('loaded!')
  output.innerText = "This is currently trash. Don't use."
  // test()
}

function updateEventSelect() {
  eventSelect.options.length = 0
  for (const name in definition.events) {
    const opt = document.createElement('option')
    opt.value = name
    opt.innerText = name
    opt.selected = name === definition.default
    eventSelect.options.add(opt)
  }
  onSelectEvent(definition.default)
}

function onSelectEvent(event = definition.default) {
  numberInputs.innerHTML = ''
  output.innerText = ''
  const def = state.selected = definition.events[event] ?? null
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
  for (const url of Array.from(base, (_, i) => def.icons[i] ?? emptyIcon)) {
    const th = document.createElement('th')
    const img = document.createElement('img')
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
    td.appendChild(input)
    bonusesRow.appendChild(td)
  }

  const requiresRow = document.createElement('tr')
  const th2 = document.createElement('th')
  th2.innerText = 'Requires'
  requiresRow.appendChild(th2)
  for (const input of state.requires) {
    const td = document.createElement('td')
    td.appendChild(input)
    requiresRow.appendChild(td)
  }

  table.appendChild(headRow)
  table.appendChild(bonusesRow)
  table.appendChild(requiresRow)

  numberInputs.appendChild(table)
}

function calculate() {
  const def = state.selected
  if (!def) return

  const bonuses = Float32Array.from(state.bonuses, input => (input.valueAsNumber || 0) / 100 + 1)
  const requires = Uint16Array.from(state.requires, input => Math.max(-1, Math.min(65535, input.valueAsNumber || 0)))
  const levels = def.levels.map((d, i) => ({
    name: `ch${i + 1}`,
    ap: d.ap,
    items: Uint16Array.from(bonuses, (b, i) => Math.ceil((d.items[i] ?? 0) * b)),
    bitflag: d.items.slice(0, bonuses.length).reduce((p, v, i) => p | (+(v > 0) << i), 0),
    futurebits: 0
  }))
  const log = levels.map(l => `${l.name.padEnd(4, ' ')} ${l.ap}AP ${Array.from(l.items, v => `${v || '-'}`.padStart(2, ' ')).join(' ')}`)
  log.unshift('Levels with bonus:')
  log.push('')
  /** @type {{ [name: string]: Float32Array }} */
  const normalized = {}
  levels.forEach(l => normalized[l.name] = Float32Array.from(l.items, v => v / l.ap))

  let filteredLevels = levels.filter(level => {
    const a = normalized[level.name]
    return levels.every(l => {
      if (level === l) return true
      const d = normalized[l.name].map((v, i) => a[i] - v)
      if (!d.every(v => v <= 0)) return true
      if (d.every(v => v === 0)) {
        if (level.ap <= l.ap) return true
        log.push(`${level.name} has been out by ${l.name} for being the same but more AP requirement.`)
      } else {
        log.push(`${level.name} has been out by ${l.name} for being less efficient.`)
      }
      return false
    })
  })
  if (requires.some(v => v === 0)) {
    const mask = requires.reduce((p, v, i) => p | (+(v > 0) << i), 0)
    filteredLevels = filteredLevels.filter(level => {
      if (!(level.bitflag & mask)) {
        log.push(`${level.name} has been filtered out because it's not needed.`)
        return false
      }
      return true
    })
  }
  if (log.at(-1) !== '') {
    log.push('')
  }

  filteredLevels.sort((a, b) => b.bitflag - a.bitflag)
  let bits = 0
  for (let i = filteredLevels.length - 1; i >= 0; i--) {
    filteredLevels[i].futurebits = bits
    bits |= filteredLevels[i].bitflag
  }
  if (bits < (1 << requires.length) - 1) {
    for (let i = requires.length; i >= 0; i--) {
      if ((bits & (1 << i)) === 0) {
        requires[i] = 0
        log.push(`Removing item requirement index ${i} because there's no level to get it from.`)
      }
    }
  }

  const collector = new Collector()
  def.transferRates // TODO use this
  calc(filteredLevels, 0, requires, 0, 0, '', collector)
  if (collector.ap === Infinity) {
    log.push(`Didn't find any route for some reason...`)
  } else {
    log.push(
      `Explored ${collector.count} possibilities, found this route:`,
      `Uses ${collector.ap} AP.`,
      `Route: ${collector.route}` // todo: further analysis
    )
  }

  output.innerText = log.join('\n')
}

/**
 * @param {CalculatedLevel[]} levels 
 * @param {number} lvIndex 
 * @param {Uint16Array} requires 
 * @param {number} reqIndex 
 * @param {number} usedAP 
 * @param {string} route 
 * @param {Collector} collector 
 * @returns {number} used ap for calculation
 */
function calc(levels, lvIndex, requires, reqIndex, usedAP, route, collector) {
  if (usedAP - 500 > collector.ap) {
    collector.collect(Infinity, 'Abandoned route.')
    return Infinity
  }
  if (requires[reqIndex] === 0) {
    reqIndex++
    if (reqIndex === requires.length) {
      if (requires.every(v => v === 0)) {
        collector.collect(usedAP, route.slice(2))
        return usedAP
      }
    }
    return calc(levels, lvIndex, requires, reqIndex, usedAP, route, collector)
  }
  if (reqIndex >= requires.length || lvIndex >= levels.length) {
    collector.collect(-999, `something really bad happened. (${JSON.stringify({
      levels: levels.map(v => ({...v, items: Array.from(v.items)})),
      lvIndex,
      requires: Array.from(requires),
      reqIndex, usedAP, route
    }, undefined, '  ')})`)
    return Infinity
  }
  const lv = levels[lvIndex]
  const reqBits = requires.reduce((p, v, i) => p | (+(v > 0) << i), 0)
  if ((reqBits & lv.bitflag) === 0) {
    return calc(levels, lvIndex + 1, requires, reqIndex, usedAP, route, collector)
  }
  const min = Math.max(...requires.map((v, i) => (lv.futurebits & (1 << i)) ? 0 : Math.ceil(v / lv.items[i])))
  const max = Math.max(min, Math.ceil((collector.ap - usedAP) / lv.ap))
  const set = new Set()

  // prepare amounts for first iteration
  requires.forEach((v, i) => {
    if (!v || !lv.items[i]) return
    set.add(Math.max(min, Math.min(max, Math.ceil(v / lv.items[i]))))
  })
  set.delete(Infinity)
  set.add(min)
  set.add(max)
  let list = [...set]
  for (let i = 0; i < list.length; i++) {
    const v = list[i]
    for (let j = i + 1; j < list.length; j++) {
      set.add(Math.floor((v + list[j]) / 2))
    }
  }
  list = [...set]
  /** @type {{ [amount: number]: number }} */
  const cache = {}
  let res = Infinity

  const clone = new Uint16Array(requires.length)
  while (true) {
    // iterate through prepared amounts
    for (const amount of list) {
      if (amount in cache) continue
      clone.set(requires)
      lv.items.forEach((v, i) => {
        if (v) clone[i] = Math.max(0, clone[i] - v * amount)
      })
      cache[amount] = calc(
        levels,
        lvIndex + 1,
        clone,
        reqIndex,
        usedAP + lv.ap * amount,
        amount ? route + `, ${amount}x ${lv.name}` : route,
        collector
      )
    }
    // check result
    const lastRes = res
    res = Math.min(Infinity, ...Object.values(cache))
    if (lastRes === res) break
    // sort and filter list, prepare next iteration
    set.clear()
    const limit = res * 0.9
    for (const n of list.slice(0, 5)) {
      if (cache[n] < limit) continue
      for (let i = 1; i <= 16; i *= 2) {
        set.add(Math.max(min, Math.min(max, n - i)))
        set.add(Math.max(min, Math.min(max, n + i)))
      }
    }
    set.delete(Infinity)
    list = [...set]
  }
  return res
}

class Collector {
  count = 0
  ap = Infinity
  route = ''

  /**
   * @param {number} ap 
   * @param {string} route 
   */
  collect(ap, route) {
    this.count++
    if (ap > this.ap) return
    this.ap = ap
    this.route = route
  }
}

main()

/**
 * @typedef {{
 *  name: string;
 *  ap: number;
 *  items: Uint16Array;
 *  bitflag: number;
 *  futurebits: number;
 * }} CalculatedLevel
 */

function test() {
  state.bonuses[0].valueAsNumber = 90
  state.bonuses[1].valueAsNumber = 60
  state.bonuses[2].valueAsNumber = 45
  state.requires[0].valueAsNumber = 999
  state.requires[1].valueAsNumber = 9
  state.requires[2].valueAsNumber = 0
  calculate()
}
