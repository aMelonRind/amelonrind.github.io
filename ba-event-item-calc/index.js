//@ts-check
if (0) module.exports = 0

const emptyIcon = 'https://static.miraheze.org/bluearchivewiki/thumb/8/8f/Item_Icon_Event_Item_0.png/90px-Item_Icon_Event_Item_0.png'

const root = document.getElementById('script-root') ?? document.body

/** @type {{default: string, events: { [name: string]: typeof import('./eventDefinition.json')['events']['Get Hyped and March On!'] }}} */
let definition = {
  default: '',
  events: {}
}

const state = {
  selectedName: '',
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
  root.appendChild(wikiDiv)
  br()
  root.appendChild(numberInputs)
  br()
  root.appendChild(output)

  console.log('loaded!')
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
  state.selectedName = event
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
  for (const url of Array.from(base, (_, i) => def.icons[i] || emptyIcon)) {
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
  localStorage.setItem('inputs', JSON.stringify(data))

  const rcpDummy = new Float64Array(0)
  const rawLevels = def.levels.map((d, i) => ({
    name: `q${i + 1}`,
    ap: d.ap,
    items: Uint16Array.from(bonuses, (b, i) => Math.ceil(roundFloat((d.items[i] ?? 0) * b))),
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
  /** @type {{ [name: string]: Float32Array }} */
  const normalized = {}
  rawLevels.forEach(l => normalized[l.name] = Float32Array.from(l.items, v => v / l.ap))

  let levels = rawLevels.filter(level => {
    const a = normalized[level.name]
    return rawLevels.every(l => {
      if (level === l) return true
      const d = normalized[l.name].map((v, i) => a[i] - v)
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
    name: `${a.name} and ${b.name}`,
    ap: a.ap + b.ap,
    items: a.items.map((v, i) => v + b.items[i]),
    bitflag: a.bitflag | b.bitflag,
    futurebits: NaN,
    itemRcp: rcpDummy
  })))
  for (const ap of new Set(rawLevels.map(l => l.ap))) {
    const group = rawLevels.filter(l => l.ap === ap)
    for (let size = 3; size <= group.length; size++) {
      for (let i = 0; i + size <= group.length; i++) {
        const ls = group.slice(i, i + size)
        groupLevels.push({
          name: ls.map(l => l.name).join(' and '),
          ap: ls.reduce((p, v) => p + v.ap, 0),
          items: ls[0].items.map((_, i) => ls.reduce((p, v) => p + v.items[i], 0)),
          bitflag: ls.reduce((p, v) => p | v.bitflag, 0),
          futurebits: NaN,
          itemRcp: rcpDummy
        })
      }
    }
  }
  groupLevels.forEach(l => normalized[l.name] = Float32Array.from(l.items, v => v / l.ap))
  levels.push(...groupLevels)
  levels = levels.filter(level => {
    if (!(level.bitflag & mask)) return false
    const a = normalized[level.name]
    return levels.every(l => {
      if (level === l) return true
      const d = normalized[l.name].map((v, i) => a[i] - v)
      return d.some(v => v > 0) || level.ap <= l.ap && d.every(v => v === 0)
    })
  })
  for (const level of levels) level.itemRcp = Float64Array.from(level.items, v => 1 / v)

  log.push(`Level pool: ${levels.length}\n`)

  def.transferRates // TODO use this
  // too hard to implement

  const collector = new Collector()
  const time = performance.now()
  calc(levels, requires, 0, '', collector)
  log.push(`Recursive calculation costs ${(performance.now() - time).toFixed(1)}ms.`)
  if (collector.ap === Infinity) {
    log.push(`Didn't find any route for some reason...`)
  } else outer: {
    log.push(
      `Explored ${collector.count} possibilities, found this route:`,
      `Uses ${collector.ap} AP.`,
      `Route: ${collector.route}`,
      'Performing further approach...\n'
    )
    output.innerText = log.join('\n') + '\n'.repeat(24)
    await new Promise(res => setTimeout(res, 1))

    levels = rawLevels.filter(level => {
      const a = normalized[level.name]
      return rawLevels.every(l => {
        if (level === l) return true
        const d = normalized[l.name].map((v, i) => a[i] - v)
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
      byName[l.name] = l
    }
    /** @type {{ [name: string]: number }} */
    const counts = {}
    for (const str of collector.route.split(', ')) {
      if (!str) continue
      const match = str.match(/^(\d+)x (q\d+(?: and q\d+)*)$/)
      if (!match) {
        log.push(`error: string doesn't match: "${str}"`)
        break outer
      }
      const amount = parseInt(match[1])
      if (amount <= 0) continue
      for (const name of match[2].split(' and ')) {
        if (!(name in byName)) {
          log.push(`error: level doesn't exist: "${name}"`)
          break outer
        }
        counts[name] = (counts[name] ?? 0) + amount
      }
    }

    const time = performance.now()
    let lastAP = Object.entries(counts).reduce((p, [name, amount]) => p + byName[name].ap * amount, 0)
    let count = 0
    const clones = levels.map(() => new Uint32Array(requires.length)) // for performace
    while (true) {
      /** @type {{ [name: string]: number }} */
      const extracted = {}
      const clone = Uint32Array.from(requires)
      let extractedAP = 0
      let extractedRoute = ''
      for (const name in counts) {
        const l = byName[name]
        if (counts[name] <= 3) {
          const amount = counts[name]
          delete counts[name]
          extracted[name] = amount

          extractedAP += amount * l.ap
          extractedRoute += `, ${amount}x ${l.name}`
        } else {
          counts[name] -= 3
          extracted[name] = 3

          for (let i = 0; i < clone.length; i++) {
            if (l.items[i] && clone[i]) {
              clone[i] = Math.max(0, clone[i] - l.items[i] * counts[name])
            }
          }

          extractedAP += 3 * l.ap
          extractedRoute += `, 3x ${l.name}`
        }
      }

      const collector = new Collector()
      collector.collect(extractedAP, extractedRoute.slice(2))
      calcFurther(levels, 0, clone, clones, 0, '', collector)
      for (const str of collector.route.split(', ')) {
        if (!str) continue
        const match = str.match(/^(\d+)x (q\d+)$/)
        if (!match) {
          log.push(`error: string doesn't match: "${str}"`)
          break outer
        }
        const amount = parseInt(match[1])
        if (amount <= 0) continue
        const name = match[2]
        if (!(name in byName)) {
          log.push(`error: level doesn't exist: "${name}"`)
          break outer
        }
        counts[name] = (counts[name] ?? 0) + amount
      }

      count++
      const ap = Object.entries(counts).reduce((p, [name, amount]) => p + byName[name].ap * amount, 0)
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
    const list = Object.entries(counts).sort(([_, a], [$, b]) => b - a).map(([name, amount]) => {
      const l = byName[name]
      const ap = l.ap * amount
      sumAP += ap
      if (l.bitflag === 1) sumAPForItem0 += ap
      return [
        amount + 'x',
        name,
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
 * @param {CalculatedLevel[]} levels 
 * @param {Uint32Array} requires 
 * @param {number} usedAP 
 * @param {string} route 
 * @param {Collector} collector 
 */
function calc(levels, requires, usedAP, route, collector) {
  const len = requires.length
  let reqBits = 0
  let i = 0, j = 0, k = 0, v = 0
  for (j = 0; j < len; j++) {
    if (requires[j]) reqBits |= 1 << j
  }
  if (reqBits === 0) {
    collector.collect(usedAP, route.slice(2))
    return
  }

  const clone = new Uint32Array(len)
  for (i = 0; i < levels.length; i++) {
    const { bitflag, itemRcp, ap, items, name } = levels[i]
    for (j = 0; j < len; j++) {
      if (~(reqBits & bitflag) & (1 << j)) continue
      const amount = Math.ceil(Math.fround(requires[j] * itemRcp[j]))
      const uap = usedAP + ap * amount
      if (uap > collector.ap) {
        collector.collect(uap, 'Abandoned route.')
        continue
      }
      for (k = 0; k < len; k++) {
        v = requires[k]
        clone[k] = (v && items[k]) ? Math.max(0, v - items[k] * amount) : v
      }
      calc(
        levels,
        clone,
        uap,
        `${route}, ${amount}x ${name}`,
        collector
      )
    }
  }
}

/**
 * this recursive function sacrificed some readability for performance.
 * @param {CalculatedLevel[]} levels 
 * @param {number} lvIndex 
 * @param {Uint32Array} requires 
 * @param {Uint32Array[]} clones for performance
 * @param {number} usedAP 
 * @param {string} route 
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
    collector.collect(usedAP, route.slice(2))
    return
  }

  if (lvIndex === levels.length) return
  const { name, items, ap, futurebits, itemRcp } = levels[lvIndex]

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
    collector.collect(usedAP, `${route}, ${min}x ${name}`.slice(2))
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
    calcFurther(levels, lvIndex, clone, clones, usedAP, `${route}, ${min}x ${name}`, collector)
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
    calcFurther(levels, lvIndex, clone, clones, usedAP, `${route}, ${i}x ${name}`, collector)
  }
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
    if (ap >= this.ap) return
    this.ap = ap
    this.route = route
  }
}

/**
 * @returns {{ [event: string]: {
 *  bonuses: number[],
 *  requires: number[]
 * } }}
 */
function getStoredInputs() {
  const raw = localStorage.getItem('inputs')
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
 *  name: string;
 *  ap: number;
 *  items: Uint16Array;
 *  bitflag: number;
 *  futurebits: number;
 *  itemRcp: Float64Array;
 * }} CalculatedLevel
 */
