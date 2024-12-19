import init from "../wasm/pkg/conv.js"
export const memory = await init().then(res => res.memory)
export * from "../wasm/pkg/conv.js"
