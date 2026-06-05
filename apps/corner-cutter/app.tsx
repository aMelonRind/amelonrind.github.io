import * as NBT from "../../lib/nbtify/src/index.js";
import { process, ProcessOptions } from "./src/processor.ts";
import { batch, createEffect, createSignal, For, Match, on, onCleanup, onMount, Show, Switch, untrack } from "solid-js";
import { createStore, unwrap } from "solid-js/store";
import { createLangSelect, tw, useI18n, WrappedTranslatable } from "./i18n.ts";
import { Header } from "../../lib/header.tsx";
import "./app.css";

const [fileInput, setFileInput] = createSignal<FileList | null>(null)
const [insideMarker, setInsideMarker] = createSignal('jigsaw')
const [outsideMarker, setOutsideMarker] = createSignal('')
const [extraSolidBlocks, setExtraSolidBlocks] = createSignal('')
const [recursive, setRecursive] = createSignal(false)
const [autoStart, setAutoStart] = createSignal(false)
const [outsideDirections, setOutsideDirections] = createStore({
  up: true,
  down: false,
  north: false,
  south: false,
  west: false,
  east: false
})

export enum AppState {
  IDLE,
  STARTING,
  INITIALIZING,
  SCANNING,
  FINALIZING,
  RESULT
}

export enum ResultType {
  NORMAL,
  PERFECT,
  DETECTED_PATCHES,
  DETECTED_PATHS
}

const [appState, setAppState] = createSignal(AppState.IDLE)
const [startError, setStartError] = createSignal<any>()
const [recursiveRuns, setRecursiveRuns] = createSignal(0)
const [aliveCells, setAliveCells] = createSignal(0)
const [maxAliveCells, setMaxAliveCells] = createSignal(0)
const [redstoneDetected, setRedstoneDetected] = createSignal(false)
const [resultType, setResultType] = createSignal<ResultType>()
const [saves, setSaves] = createSignal<[block: string, count: number][]>()
const [downloadCb, setDownloadCb] = createSignal<(main: string, support: string) => void>()
const [mainMask, setMainMask] = createSignal('stone')
const [supportMask, setSupportMask] = createSignal('cobblestone')
const [autoDownload, setAutoDownload] = createSignal(false)
export { setAppState, setRecursiveRuns, setAliveCells, setRedstoneDetected, setResultType, setSaves, setDownloadCb }

const shouldIgnore = (n: EventTarget | null) => n instanceof HTMLInputElement;
const ondragover = (e: DragEvent) => {
  if (e.target instanceof HTMLInputElement) return
  e.preventDefault()
}
const ondrop = (e: DragEvent) => onFile(e.dataTransfer?.files, e)
const onpaste = (e: ClipboardEvent) => onFile(e.clipboardData?.files, e)
function onFile(files: FileList | undefined, event: Event) {
  if (!files && shouldIgnore(event.target)) return
  event.preventDefault()
  setFileInput(files ?? null)
}

export function App() {
  const { t } = useI18n()
  let fileSelect: HTMLInputElement
  const [changeIndicator, setChangeIndicator] = createSignal('')

  createEffect(on(fileInput, () => {
    fileSelect!.files = fileInput()
    const hasFile = fileSelect!.files?.length
    setChangeIndicator(hasFile ? new Date().toTimeString().slice(0, 8) : '')
    if (hasFile && autoStart()) {
      startWrapper()
    }
  }))

  createEffect(on(downloadCb, () => {
    if (downloadCb() && autoDownload()) {
      runDownload()
    }
  }))

  createEffect(() => {
    setMaxAliveCells(Math.max(untrack(maxAliveCells), aliveCells()))
  })

  onMount(() => {
    window.addEventListener('dragover', ondragover)
    window.addEventListener('drop', ondrop)
    window.addEventListener('paste', onpaste)
  })

  onCleanup(() => {
    window.removeEventListener('dragover', ondragover)
    window.removeEventListener('drop', ondrop)
    window.removeEventListener('paste', onpaste)
  })

  return <>
    <Header>
      <h1>{t('site.title')}</h1>
      {createLangSelect()}
    </Header>
    <div id="box">
      <div id="controls">
        <p class="muted">{t('site.description')}</p><hr />
        <div id="file-input-div" class="group">
          <input
            id="fileSelect"
            type="file"
            accept=".litematic"
            onchange={e => setFileInput(e.currentTarget.files)}
            ref={fileSelect!}
          ></input>
          <label title={t('input.file.time')}>{changeIndicator()}</label>
        </div>
        <p class="muted">{t('input.file.desc')}</p>
        <p class="muted">
          <a href="https://modrinth.com/mod/litematica" target="_blank" rel="noopener">{t('input.file.get')}</a>
        </p><hr />
        <div class="group">
          <label>{t('input.outside_directions.label')}</label>
          <For each={['up', 'down', 'north', 'south', 'west', 'east'] as const}>{side => <>
            <input
              id={`${side}OutsideCheckbox`}
              type="checkbox"
              checked={outsideDirections[side]}
              onchange={e => setOutsideDirections(side, e.currentTarget.checked)}
            ></input>
            <label for={`${side}OutsideCheckbox`}>{t(`direction.${side}`)}</label>
          </>}</For>
        </div>
        <p class="muted">{t('input.outside_directions.desc')}</p><hr />
        <div class="group">
          <label for="insideMarker">{t('input.inside_marker.label')}</label>
          <input
            id="insideMarker"
            type="text"
            placeholder="none"
            value={insideMarker()}
            onchange={e => setInsideMarker(e.currentTarget.value)}
          ></input>
        </div>
        <p class="muted">{t('input.inside_marker.desc')}</p><hr />
        <div class="group">
          <label for="outsideMarker">{t('input.outside_marker.label')}</label>
          <input
            id="outsideMarker"
            type="text"
            placeholder="none"
            value={outsideMarker()}
            onchange={e => setOutsideMarker(e.currentTarget.value)}
          ></input>
        </div>
        <p class="muted">{t('input.outside_marker.desc')}</p><hr />
        <div class="group">
          <label for="extraSolidBlocks">{t('input.extra_solid_blocks.label')}</label>
          <input
            id="extraSolidBlocks"
            type="text"
            placeholder="stone,dirt,grass_block"
            value={extraSolidBlocks()}
            onchange={e => setExtraSolidBlocks(e.currentTarget.value)}
          ></input>
        </div>
        <p class="muted">{t('input.extra_solid_blocks.desc')}</p><hr />
        <div class="group">
          <label for="recursive">{t('input.recursive.label')}</label>
          <input
            id="recursive"
            type="checkbox"
            checked={recursive()}
            onchange={e => setRecursive(e.currentTarget.checked)}
          ></input>
        </div>
        <p class="muted">{t('input.recursive.desc')}</p><hr />
        <div class="group">
          <label for="auto_start" title={t('input.auto_start.desc')}>{t('input.auto_start.label')}</label>
          <input
            id="auto_start"
            type="checkbox"
            checked={autoStart()}
            onchange={e => setAutoStart(e.currentTarget.checked)}
          ></input>
        </div>
        <button
          type="button"
          title={t('input.start.desc')}
          disabled={!canStart()}
          onclick={startWrapper}
        >{t('input.start.label')}</button>
      </div>
      <div id="panel">
        <div id="view">
          <Switch fallback={<>
            <div>{t('status.idle')}</div>
            <Show when={startError() != null}>
              <div>{t('error.label')}</div>
              <div>{(() => {
                const e = startError()
                return e instanceof WrappedTranslatable ? e.unwrap(t) : `${e}`
              })()}</div>
            </Show>
          </>}>
            <Match when={appState() === AppState.STARTING}>
              {t('status.starting')}
            </Match>
            <Match when={appState() === AppState.INITIALIZING}>
              {t('status.init')}
            </Match>
            <Match when={appState() === AppState.SCANNING}>
              <div>{t('status.scanning')}</div>
              <Show when={recursiveRuns() > 0}>
                <div>{t('running.recursive', { runs: recursiveRuns() })}</div>
              </Show>
              <div>{t('running.alives', { alives: aliveCells() })}</div>
              <div id="alive-bar" style={{
                "grid-template-columns": `${aliveCells()}fr ${Math.max(maxAliveCells(), aliveCells()) - aliveCells()}fr`
              }}>
                <div id="alive-bar-left"></div>
                <div id="alive-bar-right"></div>
              </div>
            </Match>
            <Match when={appState() === AppState.FINALIZING}>
              {t('status.finalizing')}
            </Match>
            <Match when={appState() === AppState.RESULT}>
              <div>{t('status.result')}</div>
              <Switch>
                <Match when={resultType() === ResultType.PERFECT}>
                  <div>{t('result.perfect')}</div>
                </Match>
                <Match when={resultType() === ResultType.NORMAL}>
                  <Show when={redstoneDetected()}><div>{t('result.redstone')}</div></Show>
                  <div>{t('result.saves')}</div>
                  <Show when={!!saves()?.length}>
                    <div id="saves-leaderboard">
                      <For each={saves()}>{([block, count], index) => <div
                        classList={{
                          "saves-leaderboard-item": true,
                          "saves-leaderboard-item-alt": (index() % 2) == 1
                        }}
                      >
                        <div class="saves-leaderboard-block">{`${index()}. ${block}`}</div>
                        <div class="saves-leaderboard-count">{count.toLocaleString()}</div>
                      </div>}</For>
                    </div>
                  </Show>
                </Match>
                <Match when={resultType() === ResultType.DETECTED_PATCHES}>
                  <div>{t('result.detected_patches')}</div>
                </Match>
                <Match when={resultType() === ResultType.DETECTED_PATHS}>
                  <div>{t('result.detected_paths')}</div>
                </Match>
              </Switch>
            </Match>
          </Switch>
        </div>
        <div id="output">
          <div class="group">
            <label for="mainMask">{t('input.main_mask.label')}</label>
            <input
              id="mainMask"
              type="text"
              placeholder="stone"
              value={mainMask()}
              onchange={e => setMainMask(e.currentTarget.value)}
            ></input>
          </div>
          <p class="muted">{t('input.main_mask.desc')}</p><hr />
          <div class="group">
            <label for="supportMask">{t('input.suppport_mask.label')}</label>
            <input
              id="supportMask"
              type="text"
              placeholder="cobblestone"
              value={supportMask()}
              onchange={e => setSupportMask(e.currentTarget.value)}
            ></input>
          </div>
          <p class="muted">{t('input.suppport_mask.desc')}</p><hr />
          <div class="group">
            <label for="auto_download" title={t('input.auto_download.desc')}>{t('input.auto_download.label')}</label>
            <input
              id="auto_download"
              type="checkbox"
              checked={autoDownload()}
              onchange={e => setAutoDownload(e.currentTarget.checked)}
            ></input>
          </div>
          <button
            type="button"
            title={t('input.download.desc')}
            disabled={!downloadCb()}
            onclick={() => runDownload()}
          >{t('input.download.label')}</button>
        </div>
      </div>
    </div>
  </>
}

function canStart() {
  return appState() === AppState.IDLE || appState() === AppState.RESULT
}

let lastDownloadCb: any = null
function runDownload(auto = false) {
  const cb = downloadCb()
  if (!cb) return
  if (auto && cb === lastDownloadCb) return
  lastDownloadCb = cb
  cb(completeId(mainMask() || 'stone'), completeId(supportMask() || 'cobblestone'))
}

async function startWrapper() {
  if (!canStart()) return
  batch(() => {
    setAppState(AppState.STARTING)
    setRecursiveRuns(0)
    setAliveCells(0)
    setMaxAliveCells(0)
    setRedstoneDetected(false)
    setResultType()
    setSaves()
    setDownloadCb()
  })
  try {
    await start()
    setAppState(AppState.RESULT)
  } catch (e) {
    batch(() => {
      setStartError(e)
      setAppState(AppState.IDLE)
    })
  }
}

async function start() {
  const files = fileInput()
  if (!files?.length) {
    throw tw('error.no_file')
  }

  const options: ProcessOptions = {
    outsides: unwrap(outsideDirections),
    insideMarker: completeId(insideMarker().trim()) || null,
    outsideMarker: completeId(outsideMarker().trim()) || null,
    extraSolidBlocks: parseExtraSolidBlocks(),
    recursive: recursive()
  }

  if (options.insideMarker && options.insideMarker === options.outsideMarker) {
    throw tw('error.same_marker')
  }

  if (Object.values(options.outsides).every(v => !v) && !options.outsideMarker) {
    throw tw('error.undefined_outside')
  }

  let detected = false
  for (const blob of files) {
    if (!blob) continue
    detected = true
    const name = blob.name
    if (!name.endsWith('.litematic')) {
      throw tw('error.file_type', { name })
    }

    await process(await NBT.read(blob, { strict: false }) as any, name, options)
    break
  }

  if (!detected) {
    throw tw('error.no_read')
  }
}

function parseExtraSolidBlocks() {
  const esbInput = extraSolidBlocks()
  try {
    if (esbInput.startsWith('[')) {
      const json = JSON.parse(esbInput)
      if (!Array.isArray(json)) throw tw('error.esb.not_array')
      if (!json.every(v => typeof v === 'string')) throw tw('error.esb.not_string_array')
      return json
        .map(str => completeId(str))
        .filter(v => v)
    } else {
      return esbInput
        .split(',')
        .map(str => completeId(str.trim()))
        .filter(v => v)
    }
  } catch (e) {
    throw tw('error.esb.other', { error: (e!.toString?.() || e) })
  }
}

function completeId(id: string): string {
  return !id || id.includes(':') ? id : 'minecraft:' + id
}
