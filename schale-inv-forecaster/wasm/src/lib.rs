pub mod utils;
pub mod counter;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn set_panic_hook() {
    utils::set_panic_hook();
}
