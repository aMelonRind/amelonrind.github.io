import { mainGUI } from "./src/MainGUI.ts";
import { hasParam, isDev } from "../../lib/util.ts";
import { ItemSet, current as preset } from "../../data/ba/inventories.ts";
import { createLangSelect, useI18n } from "./i18n.ts";
import { Header } from "../../lib/header.tsx";
import "./app.css";
import { counter_cache as cc } from "./src/counter/cache.ts";
import { genCache } from "./src/counter/cache_gen.ts";

// import {} from "../../lib/wasm/.test.ts";

// todo: cache codec and bulk caching
// data codec and combination lookup

const devPreset = {
  zero: [[2, 2, 0], [2, 2, 0], [2, 2, 0]],
  optimizeTest: [[4, 4, 2], [2, 2, 0], [2, 2, 0]],
  patternTest: [[5, 5, 1], [4, 4, 1], [2, 2, 0]],
  performanceTest: [[4, 1, 2], [3, 1, 3], [2, 1, 3]], // basically modified theFirstTest
  // level 3 took 1288sec, goal is level 5
  // done final layer quick filter optimization, level 3 took 496sec
  // the third try of algorithm impl took 240s. After caching pointers, 184s.
  // After multi threading: mac m1: 2682.9ms on 6 threads

  notReallyHell: [[4, 2, 2], [3, 1, 3], [2, 1, 6]],
  // ^ 1796.0ms on multi threaded counter
  theFirstTest: [[4, 1, 2], [3, 1, 3], [2, 1, 5]], // season 8 stage 3 and 6
  // ^ Total possibilities: 446,710,624,706, Took time: 25,312s, Third try: 7,725s
  // Third try on macbook air m1: 971s. 8x faster than my main laptop.
  // After caching pointers: 4,429s, mac m1: 946s
  // After multi threading: mac m1: 77s on 6 threads (my windows laptop is half dead, mac is my main now)
} satisfies Record<string, ItemSet>;

function applyPreset(key: string) {
  //@ts-ignore
  const set: ItemSet | undefined = preset.items[key] ?? devPreset[key]
  if (!Array.isArray(set)) return
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
  setTimeout(() => mainGUI.inventory.scheduleInstantCounter(), 100)
  setTimeout(() => mainGUI.markAllDirty(), 200)
}

if (!hasParam('force_start') && !hasParam('no_multi_cache')) {
  console.info(
    `Note that the took time isn't always correct due to multi threading and caching.\n` +
    `Use ?force_start to disable cache.`
  )
}

export function App() {
  const { t } = useI18n()

  return <>
    <Header>
      <h1>{t('site.title')}</h1>
      {createLangSelect()}
    </Header>
    <div id="maindiv">
      <select
        id="presetSelect"
        title={t('preset.placeholder')}
        onchange={e => {
          const sel = e.currentTarget.value
          e.currentTarget.selectedIndex = 0
          applyPreset(sel)
        }}
      ><option selected disabled>{t('preset.placeholder')}</option>
        {isDev() && Object.keys(devPreset).map(key => <option value={key}>{`[dev] ${key}`}</option>)}
        {preset.items.map((_, i, a) => <option value={i.toString()}>
          {i + 1 === a.length ? t('preset.stageLast', { stage: i + 1 }) : t('preset.stage', { stage: i + 1 })}
        </option>)}
      </select>

      {mainGUI.canvas}
      <div class="hoverTextElement">{mainGUI.currentHoverText[0]().unwrap(t)}</div>
      <hr />

      <div id="site-description-container">
        <p id="site-main-description">{t('site.description.main')}</p>
        <div id="site-description" data-nosnippet>
          <p>{t('site.description.yap.0')}</p>
          <p>{t('site.description.yap.1')}</p>
          <p>{t('site.description.yap.2')}</p>
        </div>
      </div>

      {isDev() && <div class="dev-section">
        <label>Dev options</label>
        <button onclick={cc.testCodec}>Test cache codec</button>
        {hasParam('no_multi_cache') && hasParam('noauto') && <button disabled onclick={() => {
          genCache()
          mainGUI.startButton.markDirty()
        }}>Gen Cache</button>}
        <button onclick={() => cc.download(0)}>Download All Cache</button>
        <button onclick={() => cc.download(5000)}>Download &gt;5000ms Cache</button>
      </div>}
    </div>
  </>
}
