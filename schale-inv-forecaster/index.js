
import { i18n, langs, setLang } from "./src/I18n.js"
import { mainGUI } from "./src/MainGUI.js"
import { isDev } from "./src/util.js"
export { mainGUI }

export { assemblerTest } from "./src/assembler/Assembler.js"
export { generateTest, bulkTest } from "./src/assembler/assembler_test.js"

/** @satisfies {Record<string, ItemSet>} */
const devPreset = {
  zero: [[2, 2, 0], [2, 2, 0], [2, 2, 0]],
  optimizeTest: [[4, 4, 2], [2, 2, 0], [2, 2, 0]],
  patternTest: [[5, 5, 1], [4, 4, 1], [2, 2, 0]],
  performanceTest: [[4, 1, 2], [3, 1, 3], [2, 1, 1]], // basically modified default6
  // level 3 took 1288sec, goal is level 5
  // done final layer quick filter optimization, level 3 took 496sec
  // the third try of algorithm impl took 240s. After caching pointers, 184s.

  notReallyHell: [[4, 2, 2], [3, 1, 3], [2, 1, 6]]
}
// /** @type {ItemSet[]} */
// const preset = [
//   // everything below except 3 and 6 are running in acceptable speed
//   // 2x1 is really small apparently
//   [[4, 2, 1], [3, 2, 2], [2, 2, 2]],
//   [[3, 3, 1], [3, 2, 2], [3, 1, 2]],
//   [[4, 1, 2], [3, 1, 3], [2, 1, 5]],
//   // ^ Total possibilities: 446,710,624,706, Took time: 25,312s, Third try: 7,725s
//   // Third try on macbook air m1: 971s. 8x faster than my main laptop.
//   // After caching pointers: 4,429s, mac m1: 946s
//   [[4, 2, 1], [3, 2, 2], [2, 2, 2]],
//   [[3, 3, 1], [3, 2, 2], [3, 1, 2]],
//   [[4, 1, 2], [3, 1, 3], [2, 1, 5]],
//   [[3, 3, 1], [4, 2, 1], [3, 2, 2]],
// ]

// // Descent of the Five Senses
// /** @type {ItemSet[]} */
// const preset = [
//   [[3, 2, 1], [3, 1, 5], [2, 1, 2]],
//   [[4, 2, 1], [2, 2, 2], [3, 1, 3]],
//   [[3, 3, 1], [1, 4, 3], [2, 1, 2]],
//   [[3, 2, 1], [3, 1, 5], [2, 1, 2]],
//   [[4, 2, 1], [2, 2, 2], [3, 1, 3]],
//   [[3, 3, 1], [1, 4, 3], [2, 1, 2]],
//   [[2, 2, 2], [3, 1, 3], [2, 1, 6]],
// ]

// Secret Midnight Party ~ Oni Holds a Bell ~
/** @type {ItemSet[]} */
const preset = [
  [[3, 2, 2], [3, 1, 5], [2, 1, 2]],
  [[4, 2, 1], [1, 4, 2], [3, 1, 5]],
  [[3, 3, 1], [2, 2, 4], [2, 1, 3]],
  [[3, 2, 2], [3, 1, 5], [2, 1, 2]],
  [[4, 2, 1], [1, 4, 2], [3, 1, 5]],
  [[3, 3, 1], [2, 2, 4], [2, 1, 3]],
  [[4, 2, 2], [3, 1, 3], [2, 1, 6]],
]
const last = 7
const presetOptions = preset.map((_, i) => {
  const opt = document.createElement('option')
  opt.value = i.toString()
  return opt
})
const updateInfo = 'Stage data: Global 2025/06/10'


const root = document.getElementById('script-root') ?? document.createElement('div')
const siteMainDesc = document.getElementById('site-main-description') ?? document.createElement('p')
const siteDesc = document.getElementById('site-description') ?? document.createElement('p')

const langsDropdown = document.createElement('select')
langsDropdown.title = 'Select language'
for (const [name, lang] of Object.entries(Object.fromEntries(langs.entries().map(([key, lang]) => [lang.name, key]).toArray()))) {
  const res = document.createElement('option')
  res.value = lang
  res.innerText = name
  langsDropdown.options.add(res)
  if (i18n.name === name) {
    res.selected = true
  }
}
langsDropdown.addEventListener('change', () => applyLang(langsDropdown.value))

const presetsDropdown = document.createElement('select')
presetsDropdown.title = i18n.preset
const presetsPlaceholder = document.createElement('option')
presetsPlaceholder.disabled = true
presetsPlaceholder.innerText = i18n.preset
presetsDropdown.options.add(presetsPlaceholder)
if (isDev()) {
  for (const opt in devPreset) {
    const res = document.createElement('option')
    res.value = opt
    res.innerText = '[dev] ' + opt
    presetsDropdown.options.add(res)
  }
}
for (const opt of presetOptions) {
  presetsDropdown.options.add(opt)
}
presetsDropdown.selectedIndex = 0
presetsDropdown.onchange = () => {
  const sel = presetsDropdown.value
  presetsDropdown.selectedIndex = 0
  applyPreset(sel)
}


function main() {
  /** @type {(...elements: (Node | string)[]) => HTMLDivElement} */
  const group = (...elements) => {
    const div = document.createElement('div')
    div.classList.add('group')
    div.append(...elements)
    return div
  }
  updateLang()
  root.innerHTML = ''
  root.append(langsDropdown, presetsDropdown, updateInfo, mainGUI.div)
}

main()

/**
 * @param {string} lang 
 */
function applyLang(lang) {
  setLang(lang)
  mainGUI.markAllDirty()
  updateLang()
}

function updateLang() {
  siteMainDesc.innerText = i18n.siteMainDescription
  siteDesc.innerText = i18n.siteDescription
  presetsDropdown.title = i18n.preset
  presetsPlaceholder.innerText = i18n.preset
  for (const [i, opt] of presetOptions.entries()) {
    opt.innerText = i18n.defaultPreset(i + 1, i + 1 === last)
  }
  mainGUI.markAllDirty()
}

/**
 * @param {string} key 
 */
function applyPreset(key) {
  /** @type {ItemSet=} */
  const set = preset[key] ?? devPreset[key]
  if (!set) return
  mainGUI.inventory.stopPlace()
  mainGUI.inventory.board.fill(0)
  for (const plac of mainGUI.inventory.placements) {
    plac.vert.length = 0
    plac.hori.length = 0
  }
  for (const [i, cfg] of mainGUI.itemcfg.entries()) {
    const [w, h, c] = set[i]
    cfg.sizeSelect.value.width = w
    cfg.sizeSelect.value.height = h
    cfg.countSelect.value = c
    cfg.init()
  }
  mainGUI.markAllDirty()
}
