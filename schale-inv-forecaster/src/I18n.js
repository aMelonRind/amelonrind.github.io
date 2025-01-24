
/** @type {I18n} */
const english = {
  name: 'English',
  empty: '\u00A0',
  siteMainDescription:
    'This tool is WIP, for calculating possibilities\n' +
    'of Settlement Task event in Blue Archive.',
  siteDescription:
    'The algorithm is not done yet, it might take\n' +
    'too long on certain combinations.\n\n' +
    'Note that this tool explores all possibilities\n' +
    'and treat them all equally, which might be\n' +
    'inaccurate.\n\n' +
    'The theoretically best way of solving this event\n' +
    'is having someone host a database that collects\n' +
    'solved pattern from worldwide senseis, because\n' +
    "it seems like they're not fully random generated.\n" +
    "Noticed it when there's multiple same pattern\n" +
    "in a chat group i'm in. Could it be picked by\n" +
    'BA devs? idk..',
  preset: 'Apply a preset...',
  defaultPreset: (stage, last) => `Stage ${stage}${last ? '+' : ''}`,
  hoverToSee: 'Hover an element to see description',
  clickToPlaceItem: (id, rotate) => `Click to place ${rotate ? 'rotated\u00A0' : ''}item\u00A0${id + 1}`,
  placementOOB: 'Placement out of bounds',
  placementOccupied: 'Placement occupied',
  clickToRemoveItem: 'Click to remove placement',
  somethingWrongInInv: 'Something wrong happened in the inventory data..',
  clickToMark: (index, open) => `Click to mark index\u00A0${index} as ${open ? '' : 'not\u00A0'}opened`,
  slotStat: (counts, sum, partialVisible, visible, perc) =>
    ` | Counts:\u00A0[${counts.map(v => v.toLocaleString()).join(',\u00A0')}], Sum:\u00A0${sum.toLocaleString()}` +
    (partialVisible ? `, Visible:\u00A0${visible.toLocaleString()}` : '') +
    `, Percentage:\u00A0${perc.toFixed(3).replace(/00+$/, '0')}%`,
  invalid1x1: 'Size\u00A01x1 is invalid',
  setItemSize: (id, w, h) => `Set size to ${w}x${h} for item\u00A0${id + 1}`,
  setItemCount: (id, count) => `Set count to ${count} for item\u00A0${id + 1}`,
  setItemVisibility: (id, value) => `${value ? 'Enable' : 'Disable'} visibility for item\u00A0${id + 1}`,
  addItemPlacement: (id, rotate) => `Add ${rotate ? 'rotated\u00A0' : ''}placement for item\u00A0${id + 1}`,
  itemPlacementFull: (id, count) => `Placement for item\u00A0${id + 1} are already satisfied (${count})`,
  running: 'Running',
  runningCanRestart: 'Running, click to restart with current state',
  runningElapsed: elapsedMs => ` | Elapsed:\u00A0${(elapsedMs / 1000).toFixed(1)}s`,
  clickToStart: 'Click to start',
  totalPossibilities: (total, time) => `Total\u00A0possibilities:\u00A0${total.toLocaleString()}, Took\u00A0time:\u00A0${time}`,
  totalPossibilities1: 'Total\u00A0possibilities:\u00A01'
}

/** @type {I18n} */
const zhtw = {
  name: '繁體中文',
  empty: '\u3000\u00A0',
  siteMainDescription: '這個工具正在製作中 拿來計算蔚藍檔案裡其中一種總結算的可能性',
  siteDescription:
    '演算法還沒製作完成 它可能會在某些組合花太久時間\n\n' +
    '提醒: 這工具會尋找所有的可能性 並且一視同仁\n' +
    '所以計算結果與真實情況可能會有些差異\n\n' +
    '理論上這活動的最佳解是讓某大佬架設一個資料庫\n' +
    '蒐集全球老師們解完的排列\n' +
    '因為這活動的排列似乎不是完全隨機的\n' +
    '我在某個聊天群注意到的 不同人解的但是有多個相同的排列\n' +
    '不知道是不是檔案的工程師挑的',
  preset: '套用預設...',
  defaultPreset: (stage, last) => `回合${stage}${last ? '+' : ''}`,
  hoverToSee: '懸浮在元件上查看註解',
  clickToPlaceItem: (id, rotate) => `點擊放置${rotate ? '旋轉的' : ''}物品${'一二三'[id]}`,
  placementOOB: '放置範圍超出邊界',
  placementOccupied: '放置範圍已經被占用',
  clickToRemoveItem: '點擊移除放置的物品',
  somethingWrongInInv: '內部資料出了點問題..',
  clickToMark: (index, open) => `點擊標記第${index}格為${open ? '' : '未'}開啟`,
  slotStat: (counts, sum, partialVisible, visible, perc) =>
    ` | 數量:\u00A0[${counts.map(v => v.toLocaleString()).join(',\u00A0')}]\u3000總和:\u00A0${sum.toLocaleString()}` +
    (partialVisible ? `\u3000可見:\u00A0${visible.toLocaleString()}` : '') +
    `\u3000百分比:\u00A0${perc.toFixed(3).replace(/00+$/, '0')}%`,
  invalid1x1: '1x1大小是不可用的',
  setItemSize: (id, w, h) => `設定物品${'一二三'[id]}的大小為${w}x${h}`,
  setItemCount: (id, count) => `設定物品${'一二三'[id]}的數量為${count}`,
  setItemVisibility: (id, value) => `${value ? '開啟' : '關閉'}物品${'一二三'[id]}的可見性`,
  addItemPlacement: (id, rotate) => `新增一個${rotate ? '旋轉的' : ''}物品${'一二三'[id]}放置點`,
  itemPlacementFull: (id, count) => `物品${'一二三'[id]}已經放滿${count}個了`,
  running: '計算中',
  runningCanRestart: '計算中 點擊以目前狀態重新開始',
  runningElapsed: elapsedMs => ` | 經過時間:\u00A0${(elapsedMs / 1000).toFixed(1)}s`,
  clickToStart: '點擊開始計算',
  totalPossibilities: (total, time) => `全部可能性:\u00A0${total.toLocaleString()}\u3000計算時間:\u00A0${time}`,
  totalPossibilities1: '全部可能性:\u00A01'
}

/** @type {Map<string?, I18n>} */
export const langs = new Map()
langs.set('en-us', english)
langs.set('en', english)

langs.set('zh-tw', zhtw)
langs.set('zh', zhtw)

export let i18n = langs.get(localStorage.getItem('schale-inv-mng:lang'))
  ?? navigator.languages.values().map(v => langs.get(v.toLowerCase().replaceAll('_', '-'))).find(v => v)
  ?? english

/**
 * @param {string} lang 
 */
export function setLang(lang) {
  const l = langs.get(lang)
  if (!l) return
  i18n = l
  localStorage.setItem('schale-inv-mng:lang', lang)
}
