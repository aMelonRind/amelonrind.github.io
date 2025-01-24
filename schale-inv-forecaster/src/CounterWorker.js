
import init, { Board, set_panic_hook } from "../wasm/pkg/counter.js"

// const memory = await init().then(res => res.memory)

/**
 * @param {number} prog 
 * @param {number} max 
 */
function sendProgress(prog, max) {
  postMessage({ type: 'progress', progress: `${prog}/${max}` })
}
globalThis.sendProgress = sendProgress

/** @type {MessageEvent[]} */
const messageBuffer = []
onmessage = e => messageBuffer.push(e)

await init().then(() => {
  set_panic_hook()
  postMessage({ type: 'loaded' })
  while (messageBuffer.length > 0) {
    for (const e of messageBuffer.splice(0, Infinity)) {
      handleMessage(e)
    }
  }
  onmessage = handleMessage
})

function handleMessage(e) {
  try {
    /** @type {WorkerPacket} */
    const msg = e.data
    if (msg.type === 'start') {
      const sorted = msg.items.entries().filter(([, v]) => v[2] > 0).toArray().sort(([, a], [, b]) => b[0] * b[1] - a[0] * a[1])
      if (sorted.length === 0) {
        postMessage({
          type: 'result',
          key: msg.key,
          total: 0n,
          count: [null, null, null],
          time: 'zero'
        })
        return
      }
      const board = new Board(msg.board)
      for (const [, item] of sorted) {
        board.push(...item)
      }
      const start = performance.now()
      const res = board.count3()
      /** @type {(BigUint64Array | null)[]} */
      const count = [null, null, null]
      for (const [i, [ii]] of sorted.entries()) {
        count[ii] = res.get(i)
      }
      postMessage({
        type: 'result',
        key: msg.key,
        total: res.total,
        count,
        time: `${(performance.now() - start).toFixed(1)}ms`
      })
    }
  } catch (e) {
    console.error('CounterWorker Error:', e)
    postMessage({
      type: 'error',
      msg: `${e}`
    })
  }
}
