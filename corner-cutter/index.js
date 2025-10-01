//@ts-check
import * as NBT from "./npm/nbtify/dist/index.js"
import { process } from "./src/processor.js"

let logHistory = 'Welcome!'

const root = document.getElementById('script-root') ?? document.body

const fileSelect = document.createElement('input')
fileSelect.id = 'fileSelect'
fileSelect.type = 'file'
fileSelect.accept = '.litematic'
fileSelect.title = 'Accepts litematica file with exactly one region.'
fileSelect.files?.item

const outsidesTitle = 'Choose which sides should be treated as outside.'
const outsidesLabel = createLabel(
  'Outsides: ', 'outsidesSelect',
  outsidesTitle
)

/** @type {Side[]} */
const sides = ['up', 'down', 'north', 'south', 'west', 'east']
const outsidesCheckboxes = []
for (const side of sides) {
  const box = document.createElement('input')
  box.id = `${side}OutsideCheckbox`
  box.type = 'checkbox'
  box.title = outsidesTitle
  if (side === 'up') {
    box.checked = true
  }
  outsidesCheckboxes.push(box, createLabel(side, `${side}OutsideCheckbox`))
}


const insideMarkerInput = document.createElement('input')
insideMarkerInput.id = 'insideMarker'
insideMarkerInput.type = 'text'
insideMarkerInput.value = 'minecraft:jigsaw'
insideMarkerInput.placeholder = 'none'
const insideMarkerLabel = createLabel(
  'Inside Marker: ', 'insideMarker',
  insideMarkerInput.title = 'Set which block should be treated as inside (unreachable).'
)

const outsideMarkerInput = document.createElement('input')
outsideMarkerInput.id = 'outsideMarker'
outsideMarkerInput.type = 'text'
outsideMarkerInput.placeholder = 'none'
const outsideMarkerLabel = createLabel(
  'Outside Marker: ', 'outsideMarker',
  outsideMarkerInput.title = 'Set which block should be treated as outside.'
)

const extraSolidBlocksInput = document.createElement('input')
extraSolidBlocksInput.id = 'extraSolidBlocks'
extraSolidBlocksInput.type = 'text'
extraSolidBlocksInput.placeholder = 'stone,dirt,grass_block'
const extraSolidBlocksLabel = createLabel(
  'Extra Solid Blocks: ', 'extraSolidBlocks',
  extraSolidBlocksInput.title =
    "Adds extra solid blocks in case it's modded or this site's data is outdated.\n" +
    'Can be ids separated by commas or a valid json of array of strings.\n' +
    '"minecraft:" namespace can be omitted.'
)

const recursiveCheckbox = document.createElement('input')
recursiveCheckbox.id = 'recursive'
recursiveCheckbox.type = 'checkbox'
const recursiveLabel = createLabel(
  'Recursive: ', 'recursive',
  recursiveCheckbox.title = 'If checked and holes are found, attempts to patch them and then rescan.'
)

const startButton = document.createElement('button')
startButton.type = 'button'
startButton.innerText = 'Start'
startButton.onclick = start
startButton.title = 'Starts scan with the given inputs.'

const logDisplay = document.createElement('div')
logDisplay.id = 'logDisplay'
logDisplay.textContent = ''

async function main() {
  const shouldIgnore = n => n instanceof HTMLInputElement
  window.addEventListener('dragover', e => {
    if (shouldIgnore(e.target)) return
    e.preventDefault()
  })
  window.addEventListener('drop', e => {
    if (!shouldIgnore(e.target)) {
      e.preventDefault()
    }
    fileSelect.files = e.dataTransfer?.files ?? (shouldIgnore(e.target) ? fileSelect.files : null)
    // readItems(e.dataTransfer?.items)
  })
  window.addEventListener('paste', e => {
    fileSelect.files = e.clipboardData?.files ?? (shouldIgnore(e.target) ? fileSelect.files : null)
    // readItems(e.clipboardData?.items)
  })

  root.innerHTML = ''
  const br = () => document.createElement('br')
  /** @type {(...elements: (Node | string)[]) => HTMLDivElement} */
  const group = (...elements) => {
    const div = document.createElement('div')
    div.classList.add('group')
    div.append(...elements)
    return div
  }
  root.append(fileSelect,
    group(outsidesLabel, ...outsidesCheckboxes),
    group(insideMarkerLabel, insideMarkerInput),
    group(outsideMarkerLabel, outsideMarkerInput),
    group(extraSolidBlocksLabel, extraSolidBlocksInput),
    group(recursiveLabel, recursiveCheckbox),
    startButton,
    logDisplay
  )

  log('This website is a simple tool for cutting corners on large minecraft builds.')
  log("This tool accepts litematic file. Drag'n'drop or paste to import.")
  log('You can place some jigsaw (or configured inside marker) block in unreachable area, this tool can help you find unpatched holes.')
}

main()

/**
 * @param {string} text 
 * @param {string} htmlFor 
 * @param {string?} title 
 * @returns {HTMLLabelElement}
 */
function createLabel(text, htmlFor, title = null) {
  const label = document.createElement('label')
  label.innerText = text
  label.htmlFor = htmlFor
  if (title) {
    label.title = title
  }
  return label
}

async function start() {
  const files = fileSelect.files
  if (!files?.length) {
    log('No file selected.')
    return
  }

  /** @type {ProcessOptions} */
  const options = {
    outsides: {
      'up': false,
      'down': false,
      'north': false,
      'south': false,
      'west': false,
      'east': false
    },
    insideMarker: completeId(insideMarkerInput.value.trim()) || null,
    outsideMarker: completeId(outsideMarkerInput.value.trim()) || null,
    extraSolidBlocks: [],
    recursive: recursiveCheckbox.checked
  }

  for (const [i, side] of sides.entries()) {
    options.outsides[side] = outsidesCheckboxes[i * 2].checked
  }

  if (options.insideMarker && options.insideMarker === options.outsideMarker) {
    log('Inside Marker and Outside Marker cannot be the same!')
    return
  }

  if (Object.values(options.outsides).every(v => !v) && !options.outsideMarker) {
    log('No outside specified. Every block would be marked as removal.')
    return
  }

  const esbInput = extraSolidBlocksInput.value
  if (esbInput.startsWith('[')) {
    try {
      const json = JSON.parse(esbInput)
      if (!Array.isArray(json)) throw 'Not an array'
      if (!json.every(v => typeof v === 'string')) throw 'Not a string array'
      options.extraSolidBlocks = json
        .map(str => completeId(str))
        .filter(v => v)
    } catch (e) {
      log('Failed to parse Extra Solid Blocks!')
      log(e)
      return
    }
  } else {
    options.extraSolidBlocks = esbInput
      .split(',')
      .map(str => completeId(str.trim()))
      .filter(v => v)
  }

  let detected = false
  for (const blob of Array.from({ length: files.length }, i => files.item(i))) {
    if (!blob) continue
    detected = true
    const name = blob.name
    if (!name.endsWith('.litematic')) {
      await log(`This tool only accepts litematic file. Received ${name}.`)
      continue
    }
    await log(`Reading ${name}...`)

    await process(
      // @ts-ignore
      await NBT.read(blob, { strict: false }),
      name,
      options
    )
  }

  if (!detected) {
    log('No file detected.')
  }
}

/**
 * @param {string} id 
 * @returns 
 */
function completeId(id) {
  return !id || id.includes(':') ? id : 'minecraft:' + id
}

/**
 * @param {string} msg 
 */
export async function log(msg) {
  logHistory += '\n' + msg

  if (logHistory.length > 100_000_000) {
    let index = logHistory.indexOf('\n')
    if (index !== -1) {
      while (logHistory.length - index - 1 > 80_000_000) {
        const i = logHistory.indexOf('\n', index + 1)
        if (i === -1) break
        index = i
      }
      logHistory = logHistory.slice(index + 1)
      logDisplay.scrollTo({
        top: Math.min(logDisplay.scrollTop, logDisplay.scrollHeight - logDisplay.clientHeight),
        behavior: 'instant'
      })
    }
  }
  const isAtBottom = logDisplay.scrollTop + logDisplay.clientHeight >= logDisplay.scrollHeight - 2
  // let debug = `st: ${logDisplay.scrollTop}, ch: ${logDisplay.clientHeight}, sh: ${logDisplay.scrollHeight}, iab: ${isAtBottom}`
  logDisplay.textContent = logHistory
  // debug += `\nst: ${logDisplay.scrollTop}, ch: ${logDisplay.clientHeight}, sh: ${logDisplay.scrollHeight}`
  if (isAtBottom) {
    logDisplay.scrollTo({
      top: logDisplay.scrollHeight - logDisplay.clientHeight,
      behavior: 'instant'
    })
    // debug += `\nst: ${logDisplay.scrollTop}, ch: ${logDisplay.clientHeight}, sh: ${logDisplay.scrollHeight}`
  }
  // console.log(debug)
  await new Promise(requestAnimationFrame)
}

/**
 * @param {string} fileName 
 * @param {BlobPart} data 
 */
export function downloadBlob(fileName, data) {
  const blob = new Blob([data], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  downloadURL(url, fileName)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/**
 * @param {string} dataURL 
 * @param {string} fileName 
 */
function downloadURL(dataURL, fileName) {
  const a = document.createElement('a')
  a.href = dataURL
  a.download = fileName
  a.click()
}
