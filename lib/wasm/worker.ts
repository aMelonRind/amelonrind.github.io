
import type { WasmLibrary } from "./tool.ts";

export const enum MessageType {
  // pool messages
  CLEANUP,
  MESSAGE,
  // parent to worker to parent (with ticket)
  INIT,
  GET_MEMORY_LENGTH,
  GET_MEMORY,
  SET_MEMORY,
  INVOKE,
  // worker to parent
  RESOLVE_TICKET,
  REJECT_TICKET,
  INVOKE_IMPORT,
  POST_MESSAGE,
}

// prevent custom libraries from accidentally using the global postMessage
const postRootMessage = self.postMessage.bind(self)
globalThis.postMessage = postWasmMessage
self.postMessage = postWasmMessage

/**
 * default library available without an importsUrl.
 */
const defaultLibrary: WasmLibrary = {
  log: () => (...args: any[]) => console.log(...args), // void
  warn: () => (...args: any[]) => console.warn(...args), // void
  now: () => () => performance.now(), // f64
  date: () => () => BigInt(Date.now()), // i64
  time: () => () => BigInt(Date.now()), // i64
}

function postWorkerMessage(msg: any) {
  postRootMessage({ type: MessageType.MESSAGE, msg })
}

function postWasmMessage(value: any) {
  postWorkerMessage({ type: MessageType.POST_MESSAGE, value })
}

// allocate memory per worker to avoid fragmentation
const mem: WebAssembly.Memory = new WebAssembly.Memory({ initial: 1 })

// cached instance for reuse
let lastModuleId: number | null = null
let lastKey: string = ''
let lastWasm: WebAssembly.Instance | null = null

let wasm: WebAssembly.Instance | null = null

onmessage = async ({data}) => {
  switch (data.type) {
    case MessageType.CLEANUP:
      wasm = null
      postRootMessage({ type: MessageType.CLEANUP })
      break
    case MessageType.MESSAGE:
      await onWorkerMessage(data.msg)
      break
  }
}

async function onWorkerMessage(data: any) {
  try {
    switch (data.type) {
      case MessageType.INIT: {
        await init(
          data.module,
          data.moduleId,
          data.ticket,
          data.requiredPages,
          data.importsUrls,
          data.imports,
          data.proxiedImports
        )
        break
      }
      case MessageType.GET_MEMORY_LENGTH: {
        const value = mem.buffer.byteLength
        postWorkerMessage({ type: MessageType.RESOLVE_TICKET, ticket: data.ticket, value })
        break
      }
      case MessageType.GET_MEMORY: {
        const end = data.start + data.length
        if (mem.buffer.byteLength < end) {
          postWorkerMessage({
            type: MessageType.REJECT_TICKET,
            ticket: data.ticket,
            err: `Range out of bounds. (end(${end}) > byteLength${mem.buffer.byteLength})`
          })
        }
        const value = new Uint8Array(mem.buffer).slice(data.start, end)
        postWorkerMessage({ type: MessageType.RESOLVE_TICKET, ticket: data.ticket, value })
        break
      }
      case MessageType.SET_MEMORY: {
        const end = data.start + data.content.length
        if (mem.buffer.byteLength < end) {
          postWorkerMessage({
            type: MessageType.REJECT_TICKET,
            ticket: data.ticket,
            err: `Range out of bounds. (end(${end}) > byteLength${mem.buffer.byteLength})`
          })
        }
        new Uint8Array(mem.buffer).set(data.content, data.start)
        postWorkerMessage({ type: MessageType.RESOLVE_TICKET, ticket: data.ticket, value: void 0 })
        break
      }
      case MessageType.INVOKE: {
        const value = (wasm!.exports[data.func] as Function)(...data.args)
        postWorkerMessage({ type: MessageType.RESOLVE_TICKET, ticket: data.ticket, value })
        break
      }
    }
  } catch (e) {
    if (data.ticket != null) {
      postWorkerMessage({ type: MessageType.REJECT_TICKET, ticket: data.ticket, err: `Worker Error: ${e}` })
    } else {
      throw e
    }
  }
}

async function init(
  module: WebAssembly.Module,
  moduleId: number,
  ticket: number,
  requiredPages: number,
  importUrls: string[],
  imports: string[],
  proxiedImports: string[]
) {
  // init memory
  new Uint8Array(mem.buffer).fill(0)
  const grow = Math.ceil(requiredPages - mem.buffer.byteLength / 65536)
  if (grow > 0) {
    mem.grow(grow)
  }

  // init imports
  const libraries: WasmLibrary[] = await Promise.all(
    importUrls.map(url => import(/* @vite-ignore */ url).then(e => e.imports))
  )
  const fullImport: { [name: string]: Function } = {}
  for (const [index, name] of proxiedImports.entries()) {
    fullImport[name] = (...args: any[]) => postWorkerMessage({ type: MessageType.INVOKE_IMPORT, index, args })
  }
  for (const name of imports) {
    if (name in fullImport) continue
    const lib = libraries.find(l => l[name]) ?? defaultLibrary
    if (!lib?.[name]) {
      throw new Error(`Missing import for ${name}.`)
    }
    fullImport[name] = lib[name](postWasmMessage)
  }

  // use cache or instantiate
  const key = JSON.stringify([importUrls, imports, proxiedImports])
  if (lastModuleId === moduleId && lastKey === key) {
    wasm = lastWasm
  } else {
    wasm = await WebAssembly.instantiate(module, { m: fullImport, js: { mem } })
    lastModuleId = moduleId
    lastKey = key
    lastWasm = wasm
  }

  postWorkerMessage({ type: MessageType.RESOLVE_TICKET, ticket, value: void 0 })
}
