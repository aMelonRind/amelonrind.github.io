pub mod utils;
pub mod counter;

use wasm_bindgen::prelude::*;


// #[wasm_bindgen]
// extern {
//     #[wasm_bindgen(js_namespace = performance)]
//     fn now() -> f64;
//     // #[wasm_bindgen(js_namespace = console)]
//     // fn log(s: &str);
// }

#[wasm_bindgen]
pub fn set_panic_hook() {
    utils::set_panic_hook();
}
