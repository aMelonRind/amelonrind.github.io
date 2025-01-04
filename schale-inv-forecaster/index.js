
import { i18n, langs, setLang } from "./src/I18n.js"
import { forceRenderNextFrame, mainGUI } from "./src/MainGUI.js"
import { isDev } from "./src/util.js"
export { mainGUI }

/** @type {Record<string, ItemSet>} */
const devPreset = {
  optimizeTest: [[4, 4, 2], [2, 2, 0], [2, 2, 0]],
  patternTest: [[5, 5, 1], [4, 4, 1], [2, 2, 0]],
  performanceTest: [[4, 1, 2], [3, 1, 3], [2, 1, 1]], // basically modified default6
  // level 3 took 1288sec, goal is level 5
  // done final layer quick filter optimization, level 3 took 496sec

  hell: [[4, 2, 2], [3, 1, 3], [2, 1, 6]]
}
/** @type {ItemSet[]} */
const preset = [
  // everything below except 3 and 6 are running in acceptable speed
  // 2x1 is really small apparently
  [[4, 2, 1], [3, 2, 2], [2, 2, 2]],
  [[3, 3, 1], [3, 2, 2], [1, 3, 2]],
  [[1, 4, 2], [1, 3, 3], [2, 1, 5]],
  [[4, 2, 1], [3, 2, 2], [2, 2, 2]],
  [[3, 3, 1], [3, 2, 2], [1, 3, 2]],
  [[1, 4, 2], [1, 3, 3], [2, 1, 5]],
  [[3, 3, 1], [4, 2, 1], [3, 2, 2]],
]
const last = 7
const presetOptions = preset.map((_, i) => {
  const opt = document.createElement('option')
  opt.value = i.toString()
  return opt
})
const updateInfo = 'Stage data: Global 2024/12/03'


const root = document.getElementById('script-root') ?? document.createElement('div')
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
  siteDesc.innerText = i18n.siteDescription
  presetsDropdown.title = i18n.preset
  presetsPlaceholder.innerText = i18n.preset
  for (const [i, opt] of presetOptions.entries()) {
    opt.innerText = i18n.defaultPreset(i + 1, i + 1 === last)
  }
  forceRenderNextFrame()
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
  forceRenderNextFrame()
}

// TODO LIST
// ==== wasm ====
// optimize: available mask
// improve wasm progress report?
