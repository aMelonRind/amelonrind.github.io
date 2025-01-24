#![allow(unused_macros)]
#![macro_use]

use wasm_bindgen::prelude::{ JsValue, wasm_bindgen };

pub type JsResult<T> = Result<T, JsValue>;

#[wasm_bindgen]
extern {
    #[wasm_bindgen(js_namespace = console)]
    pub fn log(s: &str);
}

macro_rules! jserr {
    () => {
        return Err(JsValue::from_str("jserr"))
    };
    ($($arg:tt)*) => {
        return Err(JsValue::from_str(&format!($($arg)*)))
    };
}

macro_rules! js_assert {
    ($cond:expr) => {
        if !$cond {
            jserr!("Assertion failed on {}", stringify!($cond))
        }
    };
    ($cond:expr, $($arg:tt)+) => {
        if !$cond {
            jserr!($($arg)*)
        }
    }
}

macro_rules! jslog {
    ($($arg:tt)*) => {
        crate::utils::log(&format!($($arg)*));
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

pub fn format_thousands<T>(num: T) -> String where T: ToString {
    let mut str: String = num.to_string();
    let len = str.len();
    let mut i = if let Some(i) = str.find('.') {
        if i + 3 < len {
            str.truncate(i + 3);
        }
        i
    } else {
        len
    };
    str.reserve_exact(i / 3 + 1);
    while i > 4 {
        i -= 3;
        str.insert(i, ',');
    }
    if i == 4 && str.chars().nth(0).is_some_and(|c| c != '-') {
        str.insert(1, ',');
    }
    str
}
