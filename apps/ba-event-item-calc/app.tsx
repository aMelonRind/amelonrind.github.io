import definition from "../../data/ba/events.json";
import { batch, createEffect, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { createStore, unwrap } from "solid-js/store";
import { Header } from "../../lib/header.jsx";
import { createLangSelect, useI18n } from "./i18n.js";
import { Maths, isDev, isTruthy } from "../../lib/util.js";
import { getCraftValue, Level, solve } from "./src/solver.js";
import "./app.css";

const emptyIcon = 'https://static.wikitide.net/bluearchivewiki/thumb/8/8f/Item_Icon_Event_Item_0.png/144px-Item_Icon_Event_Item_0.png'

type EventDefinition = typeof definition.events['A Certain Scientific Blue Archive'];
type EventName = keyof typeof definition.events;

enum StorageKey {
  SELECTED = 'ba-event-item-calc:selectedEvent',
  INPUTS = 'ba-event-item-calc:inputs',
  PERFECTIONIST = 'ba-event-item-calc:perfectionist'
}

const events = definition.events
const defEvent = (definition.default in events ? definition.default : Object.keys(events)[0]) as EventName

const [selectedName, setSelectedName] = createSignal<EventName>(defEvent)
const [selectedEvent, setSelectedEvent] = createSignal<EventDefinition | null>(null)
const [bonusesInputs, setBonusesInputs] = createStore(new Uint16Array(16))
const [requiresInputs, setRequiresInputs] = createStore(new Uint32Array(16))
const [isPerfectionist, setPerfectionist] = createSignal(false)
const [bonusesText, setBonusesText] = createSignal('')
const [sweepsText, setSweepsText] = createSignal('')
const [perfectSweepsText, setPerfectSweepsText] = createSignal('')
let calculateSession = 0

setPerfectionist(isTruthy(localStorage[StorageKey.PERFECTIONIST]))

function onSelectEvent(event: EventName = defEvent) {
  if (!(event in events)) {
    event = defEvent
  }
  localStorage[StorageKey.SELECTED] = event
  batch(() => {
    for (let i = 0; i < 16; i++) {
      setBonusesInputs(i, 0)
      setRequiresInputs(i, 0)
    }
    try {
      const data = getStoredInputs()[event]
      if (data) {
        for (const [i, v] of data.bonuses.entries()) {
          setBonusesInputs(i, v)
        }
        for (const [i, v] of data.requires.entries()) {
          setRequiresInputs(i, v)
        }
      }
    } catch {}
    setSelectedName(event)
    setSelectedEvent(events[event] ?? null)
    calculate()
  })
}

async function calculate() {
  batch(() => {
    setBonusesText('')
    setSweepsText('')
    setPerfectSweepsText('')
  })
  const def = selectedEvent()
  if (!def) return

  const bonusesInput = unwrap(bonusesInputs).subarray(0, def.itemTypes)
  const bonuses = Uint16Array.from(bonusesInput, v => v + 100)
  const requires = unwrap(requiresInputs).subarray(0, def.itemTypes)

  const data = getStoredInputs()
  data[selectedName()] = {
    bonuses: Array.from(bonusesInput),
    requires: Array.from(requires)
  }
  for (const key of (Object.keys(data))) {
    if (data[key].bonuses.every(v => !v) && data[key].requires.every(v => !v)) {
      delete data[key]
    }
  }
  localStorage[StorageKey.INPUTS] = JSON.stringify(data)

  if (bonusesInput.every(v => !v) && requires.every(v => !v)) {
    return
  }

  const session = ++calculateSession
  const levels: Level[] = def.levels.map(({ ap, items }) => ({
    ap,
    items: Uint32Array.from(bonuses, (b, i) => Math.ceil((items[i] ?? 0) * b / 100))
  }))

  renderBonuses(levels, def.levels)

  if (requires.every(v => !v)) {
    setSweepsText("No Requirement.")
    return
  } else {
    setSweepsText("Solving sweeps...")
  }

  await new Promise(res => setTimeout(res, 1))
  const res = await solve(
    levels,
    requires,
    Uint16Array.from(def.voids),
    Uint8Array.from(def.tfers)
  )
  if (session !== calculateSession) return
  if (!res) {
    setSweepsText("Didn't find any route for some reason...")
    return
  }

  let sumAP = 0

  const st = toSweepsText(res.normal.sweeps, res.normal.tier)
  setSweepsText(st)
  if (res.perfect) {
    const normalAP = sumAP
    let text = toSweepsText(res.perfect.sweeps, res.perfect.tier)
    if (sumAP > normalAP) {
      text += `\nCosts ${sumAP - normalAP} more AP`
      const valueRatio = (getCraftValue(res.perfect.sweeps) / getCraftValue(res.normal.sweeps))
        / (sumAP / normalAP)
        * 100
      if (!isNaN(valueRatio)) {
        text += `, ${valueRatio.toFixed(2)}% value`
      }
    }
    setPerfectSweepsText(text)
  }

  function toSweepsText(sweeps: Uint32Array, tier: string): string {
    sumAP = 0
    let sumAPForItem0 = 0
    const sumItems = new Uint32Array(requires.length)
    const list = [...sweeps.entries()].filter(([, v]) => v).sort(([, b], [, a]) => a - b).map(([i, amount]) => {
      const l = levels[i]
      const ap = l.ap * amount
      sumAP += ap
      if (l.items.slice(1).every(v => !v)) sumAPForItem0 += ap
      return [
        amount + 'x',
        `q${i + 1}`,
        ap + 'AP',
        ...Array.from(l.items, (v, i) => {
          const n = v * amount
          sumItems[i] += n
          return n.toString()
        })
      ]
    })
    if (list.length === 0) {
      return 'Empty'
    }
    const leftover = Int32Array.from(sumItems, (v, i) => v - requires[i])
    list.push(
      ['', '', sumAP + 'AP', ...Array.from(sumItems, v => v.toString())],
      ['', '', '', ...Array.from(requires, v => v.toString())],
      ['', '', '', ...Array.from(leftover, v => v.toString())]
    )
    const maxs = Uint8Array.from(list[0], (_, i) => Math.max(...list.map(v => v[i].length)))
    // '1x q1'.length > 'sum'.length == 3
    // maxs[1] = Math.max(maxs[1], 'sum'.length - 1 - maxs[0])
    // '1x q1 1AP'.length > 'requires'.length == 'leftover'.length == 8
    // maxs[2] = Math.max(maxs[2], 'requires'.length - 1 - maxs[0] - 1 - maxs[1])
    const strList = list.map(row => row.map((v, i) => i === 1 ? v.padEnd(maxs[i], ' ') : v.padStart(maxs[i], ' ')).join(' '))
    strList.splice(-3, 0, '')
    const len = strList.length
    strList[len - 3] = 'sum' + strList[len - 3].slice(3)
    strList[len - 2] = 'requires' + strList[len - 2].slice(8)
    strList[len - 1] = 'leftover' + strList[len - 1].slice(8)
    return strList.join('\n') +
    `\n\nSum AP for non-first items: ${sumAP - sumAPForItem0}` +
    `\nTier: ${tier}`
  }
}

function renderBonuses(levels: Level[], defLevels: { ap: number, items: number[] }[]) {
  const list = levels.map(({ ap, items }, i) => [
    `q${i + 1}`,
    `${ap}AP`,
    ...Array.from(items, v => `${v || '-'}`),
    ' ',
    // calculate minimal bonus to get this amount
    ...Array.from(items, (v, j) => v
      ? `+${Math.max(0, Math.floor(roundFloat(((v - 1) / defLevels[i].items[j] - 1) * 20)) + 1) * 5}%`
      : '-'
    )
  ])
  const maxs = Uint8Array.from(list[0], (_, i) => Math.max(...list.map(v => v[i].length)))

  const gcd = new Uint32Array(levels[0].items.length)
  for (const { items } of levels) {
    for (let i = 0; i < gcd.length; i++) {
      if (!items[i]) continue
      if (!gcd[i]) {
        gcd[i] = items[i]
      } else {
        gcd[i] = Maths.gcd(items[i], gcd[i])
      }
    }
  }
  const gcds = ['GCD', ...Array.from(gcd, v => `${v || '-'}`)]

  setBonusesText(
    'Levels with bonus:\n' +
    list.map(row => row.map((v, i) => v[i === 0 ? 'padEnd' : 'padStart'](maxs[i])).join(' ')).join('\n') +
    '\n' + gcds.map((v, i) => i ? v.padStart(maxs[i + 1]) : v.padEnd(maxs[0] + 1 + maxs[1])).join(' ')
  )
}

function getStoredInputs(): { [event: string]: { bonuses: number[], requires: number[] } } {
  const raw = localStorage[StorageKey.INPUTS]
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {}
  return {}
}

function roundFloat(n: number): number {
  return Math.round(n * 10000) / 10000
}

export function App() {
  const { t } = useI18n()
  const onpaste = async (e: ClipboardEvent) => {
    const def = selectedEvent()
    const items = e.clipboardData?.items
    if (!items || !def) return
    for (const item of items) {
      if (item.type === 'text/plain') {
        const expressions: string[] =
          (await new Promise<string>(res => item.getAsString(str => res(str)))).trim().split(/\r?\n/g);
        if (expressions.length !== def.itemTypes) continue
        if (!expressions.every(exp => /^[\d()+\-*/% ]+$/.test(exp))) continue
        for (const [i, exp] of expressions.entries()) {
          setRequiresInputs(i, window.eval(exp))
        }
        calculate()
      }
    }
  }

  onMount(() => {
    window.addEventListener('paste', onpaste)
    onSelectEvent(localStorage[StorageKey.SELECTED] as EventName ?? defEvent)
  })

  createEffect(() => {
    localStorage[StorageKey.PERFECTIONIST] = isPerfectionist() ? 1 : 0
  })

  onCleanup(() => {
    window.removeEventListener('paste', onpaste)
  })

  return <>
    <Header>
      <h1>{t('site.title')}</h1>
      {createLangSelect()}
    </Header>
    <div id="event-select-div">
      <label id="event-label" for="event-select">{t('event')}</label>
      <select
        id="event-select"
        value={selectedName()}
        onchange={e => onSelectEvent(e.currentTarget.value as EventName)}
      >
        <For each={Object.keys(events)}>{name => <option value={name}>{name}</option>}</For>
      </select>
      <Show when={selectedEvent()?.wiki}>
        <a id="wiki-link" href={selectedEvent()!.wiki} target="_blank" rel="noopener">{t('wiki')}</a>
      </Show>
    </div>
    <div id="number-inputs">{numberInputs(selectedEvent(), t)}</div>
    <div id="control">
      <label class="ctlabel">
        <input
          type="checkbox"
          checked={isPerfectionist()}
          onchange={e => setPerfectionist(e.currentTarget.checked)}
        ></input>
        {t('control.perfectionist')}
        </label>
      <Show when={isDev()}>
        <button onclick={fillRandomFirst}>{t('control.random')}</button>
        <button onclick={fillRandom}>{t('control.random')}</button>
      </Show>
    </div>
    <div id="output">
      <div id="output-bonuses">{bonusesText()}</div>
      <div id="output-sweeps">{isPerfectionist() && perfectSweepsText() || sweepsText()}</div>
    </div>
  </>
}

function numberInputs(def: EventDefinition | null, t: ReturnType<typeof useI18n>['t']) {
  if (!def) return null
  const base = Array.from({ length: def.itemTypes }, (_, i) => i)
  const icons = Array.from(base, i => def.icons[i] || emptyIcon)
  return <table><tbody>
    <tr id="head-row">
      <td></td>
      <For each={icons}>{url => <th><img class="item-icon" src={url}></img></th>}</For>
    </tr>
    <tr id="bonuses-row">
      <th>{t('bonuses')}</th>
      <For each={icons}>{(_, i) => <td>+<input
        type="number"
        class="bonus-input"
        onchange={e => {
          setBonusesInputs(i(), e.currentTarget.valueAsNumber)
          calculate()
        }}
        value={bonusesInputs[i()]}
      ></input>%</td>}</For>
    </tr>
    <tr id="requires-row">
      <th>{t('requires')}</th>
      <For each={icons}>{(_, i) => <td class="require-td">{' '}<input
        type="number"
        class="require-input"
        onchange={e => {
          setRequiresInputs(i(), e.currentTarget.valueAsNumber)
          calculate()
        }}
        value={requiresInputs[i()]}
      ></input></td>}</For>
    </tr>
  </tbody></table>
}

function fillRandomFirst() {
  const def = selectedEvent()
  if (!def) return
  for (let i = 0; i < def.itemTypes; i++) {
    setRequiresInputs(i, i ? 0 : 3000 + Math.floor(Math.random() * 30000))
  }
  calculate()
}

function fillRandom() {
  const def = selectedEvent()
  if (!def) return
  for (let i = 0; i < def.itemTypes; i++) {
    setRequiresInputs(i, 3000 + Math.floor(Math.random() * 30000))
  }
  calculate()
}
