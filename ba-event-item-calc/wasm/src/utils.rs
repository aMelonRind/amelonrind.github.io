#![allow(dead_code)]
#![macro_use]

use wasm_bindgen::prelude::JsValue;

pub type JsResult<T> = Result<T, JsValue>;

macro_rules! jserr {
    () => {
        return Err(JsValue::from_str("jserr"))
    };
    ($($arg:tt)*) => {
        return Err(JsValue::from_str(&format!($($arg)*)))
    };
}

pub fn set_panic_hook() {
  // When the `console_error_panic_hook` feature is enabled, we can call the
  // `set_panic_hook` function at least once during initialization, and then
  // we will get better error messages if our code ever panics.
  //
  // For more details see
  // https://github.com/rustwasm/console_error_panic_hook#readme
  #[cfg(feature = "console_error_panic_hook")]
  console_error_panic_hook::set_once();
}

#[inline(always)]
pub fn div_ceil_u8(value: u8, rhs: u8) -> u8 {
    (value + rhs - 1) / rhs
}

#[inline(always)]
pub fn div_ceil_u16(value: u16, rhs: u16) -> u16 {
    (value + rhs - 1) / rhs
}

#[inline(always)]
pub fn div_ceil_u32(value: u32, rhs: u32) -> u32 {
    (value + rhs - 1) / rhs
}

#[inline(always)]
pub fn div_ceil_u64(value: u64, rhs: u64) -> u64 {
    (value + rhs - 1) / rhs
}
