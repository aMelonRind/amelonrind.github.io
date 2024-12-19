mod palette;
mod builders;

use wasm_bindgen::prelude::*;

pub type JsResult<T> = Result<T, JsValue>;

// mod utils;
// #[wasm_bindgen]
// pub fn set_panic_hook() {
//     utils::set_panic_hook();
// }

#[wasm_bindgen]
extern {
    // fn alert(s: &str);
    #[wasm_bindgen(js_namespace = performance)]
    fn now() -> f64;
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
pub fn test(a: &[u8]) -> u64 {
    a.iter().map(|&v| v as u64).sum()
}

#[wasm_bindgen]
#[allow(unused)]
pub fn test_overhead(arr: &[u8]) -> f64 {
    now() // around 1GB/s
}
