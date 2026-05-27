import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import "./index.css";
import { getParam, hasParam } from "../../lib/util.ts";
import { Cgol } from "./Cgol.tsx";

const rawPixelSize = getParam('pixelSize')
const pixelSize = rawPixelSize && /^[1-9]\d{0,3}$/.test(rawPixelSize) ? parseInt(rawPixelSize) : 3

if (hasParam('broken') && !document.title.startsWith('Broken ')) {
  document.title = 'Broken ' + document.title
}

const [width, setWidth] = createSignal(200)
const [height, setHeight] = createSignal(100)
function calculateSize() {
  setWidth(Math.min(960, Math.floor(window.innerWidth / pixelSize)))
  setHeight(Math.min(540, Math.floor(window.innerHeight / pixelSize)))
}
window.addEventListener('resize', calculateSize)
calculateSize()

render(
  () => <Cgol width={width} height={height} pixelSize={pixelSize} showFps={hasParam('showFps')}></Cgol>,
  document.getElementById('cgol-container')!
)
