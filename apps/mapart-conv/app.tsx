import BlockImage, { ConfirmCache } from "./src/BlockImage.ts";
import ConvertMethod from "./src/ConvertMethods.ts";
import exportOptions from "./src/ExportOptions.ts";
import MainContext from "./src/MainContext.ts";
import TaskManager from "./src/TaskManager.ts";
import "./app.css";
import { batch, createEffect, createSignal, For, untrack } from "solid-js";
import { createLangSelect, localeOrderedElements, useI18n } from "./i18n.ts";
import { Header } from "../../lib/header.tsx";

const [canvasWidth, setCanvasWidth] = createSignal(64)
const [canvasHeight, setCanvasHeight] = createSignal(64)
const [canvasStyleWidth, setCanvasStyleWidth] = createSignal('256px')
const [canvasStyleHeight, setCanvasStyleHeight] = createSignal('256px')
const [canvasPixelated, setCanvasPixelated] = createSignal(true)
const [statusParams, setStatusParams] = createSignal<{
  imgWidth: number,
  imgHeight: number,
  mapWidth: string | number,
  mapHeight: string | number,
  imgType: string
}>()
let ctx!: CanvasRenderingContext2D
export let paletteUrlInput = document.createElement('input')
const [exportDisabled, setExportDisabled] = createSignal(true)
const [currentContext, setCurrentContext] = createSignal<MainContext | null>(null)
const [currentConvMethods, setCurrentConvertMethods] = createSignal<ConvertMethod[]>([])
const convertDisabled = () => currentConvMethods().length === 0
const [progressInfo, setProgressInfo] = createSignal('')

let canvasContainer: HTMLDivElement | null = null

function updateScale(container = canvasContainer) {
  // track signals
  canvasWidth()
  canvasHeight()
  if (!container) return
  canvasContainer = container
  const scale = Math.max(1, Math.min(5,
    Math.floor(container.clientWidth / canvasWidth()),
    Math.floor(container.clientHeight / canvasHeight())
  ))
  let pixelated = true
  let w = canvasWidth() * scale
  let h = canvasHeight() * scale
  if (w > container.clientWidth || h > container.clientHeight) {
    pixelated = false
    const scale = Math.min(container.clientHeight / canvasHeight(), container.clientWidth / canvasWidth()) * 0.99
    w = Math.round(canvasWidth() * scale)
    h = Math.round(canvasHeight() * scale)
  }
  batch(() => {
    setCanvasStyleWidth(`${w}px`)
    setCanvasStyleHeight(`${h}px`)
    setCanvasPixelated(pixelated)
  })
}

setCurrentConvertMethods(ConvertMethod.getList(MainContext.getCurrent()))

function main() {
  TaskManager.progressListener = setProgressInfo

  MainContext.onNewImage(mctx => {
    const image = mctx.getImageData()
    const w = image.width / 128
    const h = image.height / 128
    batch(() => {
      setStatusParams({
        imgWidth: image.width,
        imgHeight: image.height,
        mapWidth: Number.isInteger(w) ? w : w.toFixed(2),
        mapHeight: Number.isInteger(h) ? h : h.toFixed(2),
        imgType: mctx.base.constructor.name
      })
      setCanvasWidth(image.width)
      setCanvasHeight(image.height)
      setCurrentContext(mctx)
      setCurrentConvertMethods(ConvertMethod.getList(mctx))
      setExportDisabled(!(mctx.base instanceof BlockImage))
    })
    ctx.putImageData(image, 0, 0)
  })
  MainContext.init()

  console.log(`Convert methods:`, [...ConvertMethod.methods.keys()])
}

main()

export function App() {
  const { t } = useI18n()
  let exportTypeDropdown: HTMLSelectElement
  let convertTypeDropdown: HTMLSelectElement
  const [convMethod, setConvMethod] = createSignal<string>()

  createEffect(() => updateScale())

  const convertButton = <button
    type="button"
    disabled={convertDisabled()}
    onclick={() => {
      const opt = convMethod() || convertTypeDropdown!.value
      if (opt && ConvertMethod.has(opt)) {
        TaskManager.run(`Convert by ${opt}`, task => ConvertMethod.run(opt, task))
      } else {
        alert(t('undefined_alert.convert_method', { method: opt }))
      }
    }}
  >{t('control.convert.button')}</button>

  const convertDropdown = <select
    id="convertType"
    ref={convertTypeDropdown!}
    title={t('control.convert.tooltip')}
    disabled={convertDisabled()}
    onchange={e => setConvMethod(e.currentTarget.value)}
  >
    <For each={currentConvMethods()}>
      {(m) => <option value={m.name} selected={m.name === untrack(convMethod)}>{m.displayName()}</option>}
    </For>
  </select>

  const exportButton = <button
    type="button"
    disabled={exportDisabled()}
    onclick={() => {
      const opt = exportTypeDropdown!.value
      if (opt in exportOptions) {
        TaskManager.run(`Export as ${opt}`, async task => {
          ConfirmCache.clear()
          await exportOptions[opt](task)
        })
      } else {
        alert(t('undefined_alert.export_method', { method: opt }))
      }
    }}
  >{t('control.export.button')}</button>

  const exportDropdown = <select id="exportType" ref={exportTypeDropdown!}>
    <For each={Object.keys(exportOptions)}>
      {(opt) => <option value={opt}>{opt}</option>}
    </For>
  </select>

  return (<>
    <div id="sidebar">
      <Header>{createLangSelect()}</Header>
      <h1>{t('site.title')}</h1>
      <p id="site-desc">{t('site.description')}</p>
      <hr />
      <div id="controls">
        <div>
          {t('control.rebane_url_input')}
          <input
            id="palette-url"
            type="text"
            placeholder="https://rebane2001.com/mapartcraft/?preset="
            title={t('control.rebane_url_tooltip')}
            ref={paletteUrlInput}
          ></input>
        </div>
        <div class="group">
          {localeOrderedElements(t('control.convert.order'), { convert: convertButton, method: convertDropdown })}
        </div>
        <div class="group">
          {localeOrderedElements(t('control.export.order'), { export: exportButton, format: exportDropdown })}
        </div>
        <div class="group">
          <button
            type="button"
            disabled={currentContext() === null}
            onclick={() => MainContext.getCurrent()?.base.download()}
            title={t('control.download_png_tooltip')}
          >{t('control.download_png')}</button>
        </div>
      </div>
      <div id="progress-display">{progressInfo()}</div>
    </div>
    <div id="view">
      <div id="canvas-container" onresize={e => updateScale(e.currentTarget)} ref={container => {
        if (!container) return
        const update = () => updateScale(container)
        requestAnimationFrame(update)
        new ResizeObserver(update).observe(container)
      }}>
        <canvas
          id="main-canvas"
          width={canvasWidth()}
          height={canvasHeight()}
          style={{
            width: canvasStyleWidth(),
            height: canvasStyleHeight(),
            "image-rendering": canvasPixelated() ? "pixelated" : "auto"
          }}
          ref={c => ctx = c.getContext('2d')!}
        ></canvas>
      </div>
      <div id="info-text">{statusParams() ? t('status.image_info', statusParams()!) : t('status.import_guide')}</div>
    </div>
  </>)
}
