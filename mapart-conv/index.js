//@ts-check
let test

/** @type {HTMLCanvasElement} *///@ts-ignore
const canvas = document.getElementById('canvas');
const ctx = canvas?.getContext('2d');

async function main() {
  await Readers.load()

  window.onresize = document.onresize = function() {
    updateScale()
  }

  MainContext.onNewImage = image => {
    canvas.width = image.width
    canvas.height = image.height
    ctx?.putImageData(image, 0, 0)
    updateScale()
  }
  MainContext.init()
  console.log('loaded!')
}

main()

function keys(obj) {
  return Object.keys(obj).join(', ')
}

function classof(obj) {
  return obj.constructor.name
}

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
  a.download = 'canvas-image.png'
  a.click()
}
