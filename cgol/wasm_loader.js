//@ts-check
import init from "./wasm/pkg/cgol.js"
export const memory = await init().then(res => res.memory)
export * from "./wasm/pkg/cgol.js"
