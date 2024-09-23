//@ts-check
let test

const root = document.getElementById('script-root') ?? document.body

const canvas = document.createElement('canvas')
canvas.width = 64
canvas.height = 64
const ctx = requireNonNull(canvas.getContext('2d'))

const infoText = document.createElement('div')
infoText.id = 'infoText'
infoText.innerText = "Drag 'n' drop or paste to import..."

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
paletteUrlInput.title = "The link of shared blocks generated from rebane2001's MapartCraft.\nRequired for blueprint exports."

const exportButton = document.createElement('button')
exportButton.type = 'button'
exportButton.innerText = 'Export'
exportButton.onclick = () => alert('WIP')

const exportTypeLabel = document.createElement('label')
exportTypeLabel.innerText = ' as '
exportTypeLabel.htmlFor = 'exportType'

const exportTypeDropdown = document.createElement('select')
exportTypeDropdown.id = 'exportType'
for (const opt of [
  '.litematic',
  '.nbt',
  '.dat / zip of .dat',
  'zip of 1x1 .litematic',
  'zip of 1x1 .nbt',
  'zip of rows of .litematic',
  'zip of rows of .nbt',
  '.litematic with separated materials',
  'zip of 1x1 .litematic with separated materials',
  'zip of rows of .litematic with separated materials',
]) {
  const res = document.createElement('option')
  res.value = opt
  res.innerText = opt
  exportTypeDropdown.options.add(res)
}

async function main() {
  await Readers.load()

  window.onresize = document.onresize = function() {
    updateScale()
  }

  MainContext.onNewImage = image => {
    const w = image.width / 128
    const h = image.height / 128
    infoText.innerText = `${image.width}x${image.height} (${Number.isInteger(w) ? w : w.toFixed(2)}x${Number.isInteger(h) ? h : h.toFixed(2)})`
    canvas.width = image.width
    canvas.height = image.height
    ctx.putImageData(image, 0, 0)
    updateScale()
  }
  MainContext.init()

  root.innerHTML = ''
  const br = () => document.createElement('br')
  root.appendChild(canvas)
  root.appendChild(infoText)
  root.appendChild(pngDlButton)
  root.appendChild(br())
  root.appendChild(paletteUrlLabel)
  root.appendChild(paletteUrlInput)
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
  const dataURL = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = dataURL
  a.download = 'unnamed.png'
  a.click()
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
