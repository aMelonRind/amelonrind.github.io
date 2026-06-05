
use wasm_bindgen::prelude::*;

pub type JsResult<T> = Result<T, JsValue>;

/// for block type schematics
#[wasm_bindgen]
pub struct WasmU16Counter {
    base: Vec<u32>
}

#[wasm_bindgen]
impl WasmU16Counter {
    pub fn new(max: usize) -> WasmU16Counter {
        WasmU16Counter { base: vec![0; max] }
    }

    pub fn count(&mut self, layer: &[u16]) {
        for &n in layer {
            if n != 0 {
                self.base[n as usize] += 1;
            }
        }
    }

    pub fn ptr(&self) -> *const u32 {
        self.base.as_ptr()
    }

    pub fn len(&self) -> usize {
        self.base.len()
    }
}

/// for litematica generater
#[wasm_bindgen]
pub struct LongArrBuilder {
    bitdepth: u8,
    buf: u64,
    bufs: u8,
    index: usize,
    map: Vec<u64>,
    arr: Vec<u64>,
    total: u32,
}

#[wasm_bindgen]
impl LongArrBuilder {
    pub fn new(palettelen: u32, map: &[u16], volume: u64) -> LongArrBuilder {
        let bitdepth = 2.max(32 - u32::leading_zeros(palettelen - 1)) as u8;
        let bitmask = (1u64 << bitdepth) - 1;
        LongArrBuilder {
            bitdepth,
            buf: 0,
            bufs: 0,
            index: 0,
            map: map.iter().map(|&v| v as u64 & bitmask).collect(),
            arr: vec![0; (volume * bitdepth as u64).div_ceil(64) as usize],
            total: 0
        }
    }

    pub fn push(&mut self, layer: &[u16]) -> JsResult<()> {
        if self.index >= self.arr.len() {
            return Err(JsValue::from_str("Write index out of bounds!"));
        }
        for &v in layer {
            let p = self.map[v as usize];
            if p != 0 {
                self.total += 1;
                self.buf |= p << self.bufs;
            }
            self.bufs += self.bitdepth;
            if self.bufs >= 64 {
                if self.index >= self.arr.len() {
                    return Err(JsValue::from_str("Write index out of bounds!"));
                }
                self.arr[self.index] = self.buf;
                self.index += 1;
                self.bufs -= 64;
                self.buf = p >> (self.bitdepth - self.bufs);
            }
        }
        Ok(())
    }

    pub fn finalize(&mut self) {
        if self.bufs > 0 {
            self.arr[self.index] = self.buf;
            self.buf = 0;
            self.bufs = 0;
            self.index += 1;
        }
    }

    pub fn longarr(&self) -> *const u64 {
        self.arr.as_ptr()
    }

    pub fn len(&self) -> usize {
        self.arr.len()
    }

    pub fn total(&self) -> u32 {
        self.total
    }
}
