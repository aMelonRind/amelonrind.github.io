mod cgol;

use wasm_bindgen::prelude::*;

// mod utils;
// #[wasm_bindgen]
// pub fn set_panic_hook() {
//     utils::set_panic_hook();
// }

// #[wasm_bindgen]
// extern {
//     fn alert(s: &str);
// }

#[wasm_bindgen]
pub fn test(a: &[u32]) -> u64 {
    a.iter().map(|&v| v as u64).sum()
}
