//@ts-check
///<reference path = "./index.d.ts"/>
let test

const root = document.getElementById('script-root') ?? document.body

const canvas = document.createElement('canvas')
canvas.width = 64
canvas.height = 64
const ctx = requireNonNull(canvas.getContext('2d'))

const infoText = document.createElement('div')
infoText.id = 'infoText'
infoText.innerText = "Drag 'n' drop or paste to import...\nAccepts images/.nbt/.schematic/.litematic/map_*.dat/.zip"

const pngDlButton = document.createElement('button')
pngDlButton.type = 'button'
pngDlButton.onclick = downloadCanvasAsPNG
pngDlButton.innerText = 'Download as PNG'
pngDlButton.title = 'Alternatively you can right click on the canvas'

const paletteUrlLabel = document.createElement('label')
paletteUrlLabel.innerText = 'Rebane palette url: '
paletteUrlLabel.htmlFor = 'paletteUrl'

const paletteUrlInput = document.createElement('input')
paletteUrlInput.id = 'paletteUrl'
paletteUrlInput.type = 'text'
paletteUrlInput.placeholder = 'https://rebane2001.com/mapartcraft/?preset='
paletteUrlInput.title = "The link of shared blocks generated from rebane2001's MapartCraft.\nRequired for blueprint exports."

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
  if (opt in convertMethods) {
    TaskManager.run(`Convert by ${opt}`, task => convertMethods[opt](task))
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
for (const opt in convertMethods) {
  const res = document.createElement('option')
  res.value = opt
  res.innerText = opt
  convertTypeDropdown.options.add(res)
}

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
    infoText.innerText = `${image.width}x${image.height} (${Number.isInteger(w) ? w : w.toFixed(2)}x${Number.isInteger(h) ? h : h.toFixed(2)}) • ${mctx.base instanceof BlockImage ? 'BlockImage' : 'RGBAImage'}`
    canvas.width = image.width
    canvas.height = image.height
    ctx.putImageData(image, 0, 0)
    updateScale()
    exportButton.disabled = !(mctx.base instanceof BlockImage)
  })
  MainContext.init()

  root.innerHTML = ''
  const br = () => document.createElement('br')
  root.appendChild(progressDisplay)
  root.appendChild(canvas)
  root.appendChild(infoText)
  root.appendChild(pngDlButton)
  root.appendChild(br())
  root.appendChild(paletteUrlLabel)
  root.appendChild(paletteUrlInput)
  root.appendChild(br())
  root.appendChild(convertButton)
  root.appendChild(convertTypeLabel)
  root.appendChild(convertTypeDropdown)
  root.appendChild(br())
  root.appendChild(exportButton)
  root.appendChild(exportTypeLabel)
  root.appendChild(exportTypeDropdown)

  updateScale()

  console.log('loaded!')
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

function downloadCanvasAsPNG() {
  downloadURL(canvas.toDataURL('image/png'), `${MainContext.getCurrent()?.base.filename ?? 'unnamed'}.png`)
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
