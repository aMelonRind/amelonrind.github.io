//@ts-check
///<reference path = "./index.d.ts"/>
let test

const root = document.getElementById('script-root') ?? document.body

const canvas = document.createElement('canvas')
canvas.classList.add('mainCanvas')
canvas.width = 64
canvas.height = 64
const ctx = requireNonNull(canvas.getContext('2d'))

const infoText = document.createElement('div')
infoText.id = 'infoText'
infoText.innerText = "Drag 'n' drop or paste to import...\nAccepts images/.nbt/.schematic/.litematic/map_*.dat/.zip"

const pngDlButton = document.createElement('button')
pngDlButton.type = 'button'
pngDlButton.onclick = () => MainContext.getCurrent()?.base.download()
pngDlButton.innerText = 'Download as PNG'

const paletteUrlLabel = document.createElement('label')
paletteUrlLabel.innerText = 'Rebane palette url: '
paletteUrlLabel.htmlFor = 'paletteUrl'

const paletteUrlInput = document.createElement('input')
paletteUrlInput.id = 'paletteUrl'
paletteUrlInput.type = 'text'
paletteUrlInput.placeholder = 'https://rebane2001.com/mapartcraft/?preset='
paletteUrlInput.title = "The link of shared blocks generated from rebane2001's MapartCraft."

const exportButton = document.createElement('button')
exportButton.type = 'button'
exportButton.innerText = 'Export'
exportButton.onclick = () => {
  const opt = exportTypeDropdown.value
  if (opt in exportOptions) {
    TaskManager.run(`Export as ${opt}`, async task => {
      ConfirmCache.clear()
      await exportOptions[opt](task)
    })
  } else {
    alert('undefined exportOption')
  }
}
exportButton.disabled = true

const exportTypeLabel = document.createElement('label')
exportTypeLabel.innerText = ' as '
exportTypeLabel.htmlFor = 'exportType'

const exportTypeDropdown = document.createElement('select')
exportTypeDropdown.id = 'exportType'
for (const opt in exportOptions) {
  const res = document.createElement('option')
  res.value = opt
  res.innerText = opt
  exportTypeDropdown.options.add(res)
}

const convertButton = document.createElement('button')
convertButton.type = 'button'
convertButton.innerText = 'Convert'
convertButton.onclick = () => {
  const opt = convertTypeDropdown.value
  if (ConvertMethod.has(opt)) {
    TaskManager.run(`Convert by ${opt}`, task => ConvertMethod.run(opt, task))
  } else {
    alert('undefined convertMethods')
  }
}

const convertTypeLabel = document.createElement('label')
convertTypeLabel.innerText = ' by '
convertTypeLabel.htmlFor = 'convertType'

const convertTypeDropdown = document.createElement('select')
convertTypeDropdown.id = 'convertType'
convertTypeDropdown.title = `For normal dither types, go to Rebane's MapartCraft because they're more advanced.
This site is mainly for special image types.
After converting from there, copy the image and then use "nearest" convert type here.`
updateConvertMethodDropdown()

const progressDisplay = document.createElement('div')
progressDisplay.id = 'progress-display'

async function main() {
  await Readers.load()
  BlockPalette.postLoad()
  TaskManager.progressDiv = progressDisplay

  window.onresize = document.onresize = function() {
    updateScale()
  }

  MainContext.onNewImage(mctx => {
    const image = mctx.getImageData()
    const w = image.width / 128
    const h = image.height / 128
    infoText.innerText = `${image.width}x${image.height} (${Number.isInteger(w) ? w : w.toFixed(2)}x${Number.isInteger(h) ? h : h.toFixed(2)}) • ${mctx.base.constructor.name}`
    canvas.width = image.width
    canvas.height = image.height
    ctx.putImageData(image, 0, 0)
    updateScale()
    updateConvertMethodDropdown(mctx)
    exportButton.disabled = !(mctx.base instanceof BlockImage)
  })
  MainContext.init()

  document.body.append(progressDisplay)

  root.innerHTML = ''
  const br = () => document.createElement('br')
  /** @type {(...elements: (Node | string)[]) => HTMLDivElement} */
  const group = (...elements) => {
    const div = document.createElement('div')
    div.classList.add('group')
    div.append(...elements)
    return div
  }
  root.append(canvas, infoText, pngDlButton,
    group(paletteUrlLabel, paletteUrlInput),
    group(convertButton, convertTypeLabel, convertTypeDropdown),
    group(exportButton, exportTypeLabel, exportTypeDropdown)
  )

  updateScale()

  console.log('loaded!')
  console.log(`Convert methods:`, [...ConvertMethod.methods.keys()])
}

main()

function updateScale() {
  const scale = Math.max(1, Math.min(5,
    Math.floor(window.innerWidth * 0.9 / canvas.width),
    Math.floor(window.innerHeight * 0.9 / canvas.height)
  ))
  canvas.style.width = `${canvas.width * scale}px`
  canvas.style.height = `${canvas.height * scale}px`
}

function updateConvertMethodDropdown(ctx = MainContext.getCurrent()) {
  const prev = convertTypeDropdown.options.item(convertTypeDropdown.selectedIndex)?.value
  convertTypeDropdown.options.length = 0
  convertTypeDropdown.selectedIndex = 0
  for (const [i, m] of ConvertMethod.getList(ctx).entries()) {
    const res = document.createElement('option')
    res.value = m.name
    res.innerText = m.name
    convertTypeDropdown.options.add(res)
    if (m.name === prev) {
      convertTypeDropdown.selectedIndex = i
    }
  }
  convertButton.disabled = convertTypeDropdown.options.length === 0
}

/**
 * @template T
 * @param {T} obj 
 * @param {string} [message] 
 * @returns {NonNullable<T>}
 */
function requireNonNull(obj, message = 'Object is null!') {
  if (obj == null) throw message
  return obj
}

/**
 * @param {string} fileName 
 * @param {BlobPart} data 
 */
function downloadBlob(fileName, data) {
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
