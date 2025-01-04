
let currentSession = new Uint16Array(1)
/** @type {'init' | 'idle' | 'running'} */
export let state = 'init'
let running = ''
export let countStart = 0
/** @type {string?} /^\d{1,5}\/\d{1,5}$/ */
export let progress = null
/** @type {Map<string, CounterResult>} */
export const results = new Map()

let worker = createWorker()

function createWorker() {
  const session = ++currentSession[0]
  state = 'init'
  const worker = new Worker('./src/CounterWorker.js', { type: 'module' })

  worker.addEventListener('message', e => {
    /** @type {WorkerPacket} */
    const msg = e.data
    if (msg.type === 'progress') {
      if (session === currentSession[0]) {
        state = 'running'
        progress = msg.progress
      }
    } else block: {
      if (msg.type === 'result') {
        const { key, total, count, time } = msg
        results.set(key, {
          total,
          //@ts-ignore
          count: count.map(v => v ?? new BigUint64Array(45)),
          time
        })
      } else if (msg.type === 'error') {
        // console.log(`Wasm counter error: ${msg.msg}`)
      } else if (msg.type === 'loaded') {
      } else break block
      if (session === currentSession[0]) {
        progress = null
        state = 'idle'
      }
    }
  })
  return worker
}

export function abortCounter() {
  if (state === 'running') {
    worker.terminate()
    worker = createWorker()
  }
}

/**
 * @param {bigint} board 
 * @param {ItemSet} itemSet 
 */
export function startCounter(board, itemSet) {
  const key = isAvailableStart(board, itemSet)
  if (key == null) return
  abortCounter()
  state = 'running'
  running = key
  countStart = performance.now()
  worker.postMessage({
    type: 'start',
    key,
    board,
    items: itemSet
  })
}

/**
 * @param {bigint} board 
 * @param {ItemSet} itemSet 
 * @returns {string?} key
 */
export function isAvailableStart(board, itemSet) {
  const key = `${board},${itemSet.map(v => v.join(',')).join(',')}`
  if (results.has(key) || (state === 'running' && running === key)) return null
  return key
}
